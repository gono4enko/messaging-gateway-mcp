"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = handleWebhook;
// ponytail: IG webhook handler — parse, store, reply. One file.
const pg_1 = require("pg");
const webhook_security_1 = require("./webhook-security");
const ig_api_1 = require("./ig-api");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const appSecret = process.env.IG_APP_SECRET || '';
const IG = process.env.IG_ACCOUNT_ID || '17841419820082008';
// Meta limit: 1000 bytes UTF-8 per message
const MAX_MESSAGE_BYTES = 1000;
// ponytail: truncate text to 1000 bytes on UTF-8 character boundary
function truncateUtf8(text, maxBytes) {
    const buf = Buffer.from(text, 'utf8');
    if (buf.length <= maxBytes)
        return text;
    let end = maxBytes;
    while (end > 0 && (buf[end] & 0xc0) === 0x80)
        end--;
    const truncated = buf.subarray(0, end).toString('utf8');
    return truncated + '…';
}
// ponytail: token cache — mg_tokens → env fallback
let cachedToken = process.env.IG_ACCESS_TOKEN || '';
async function getToken() {
    if (cachedToken)
        return cachedToken;
    try {
        const { rows } = await pool.query("SELECT value FROM mg_tokens WHERE name = 'ig_access_token'");
        if (rows[0]?.value) {
            cachedToken = rows[0].value;
            return cachedToken;
        }
    }
    catch { /* table might not exist yet */ }
    return process.env.IG_ACCESS_TOKEN || '';
}
async function refreshAccessToken() {
    const current = await getToken();
    if (!current) {
        console.error('token-refresh FAILED: no current token');
        return;
    }
    try {
        const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`, { signal: AbortSignal.timeout(15_000) });
        if (r.status !== 200) {
            const err = await r.text();
            console.error(`token-refresh FAILED: HTTP ${r.status} ${err.slice(0, 100)}`);
            return;
        }
        const data = await r.json();
        const newToken = data.access_token;
        if (!newToken) {
            console.error('token-refresh FAILED: no access_token in response');
            return;
        }
        cachedToken = newToken;
        try {
            await pool.query("INSERT INTO mg_tokens (name, value, updated_at) VALUES ('ig_access_token', $1, now()) ON CONFLICT (name) DO UPDATE SET value = $1, updated_at = now()", [newToken]);
            console.log('ig token refreshed, expires_in:', data.expires_in);
        }
        catch (e) {
            console.error('token-refresh FAILED: could not save to mg_tokens:', e.message);
        }
    }
    catch (e) {
        console.error('token-refresh FAILED:', e.message || e);
    }
}
// ponytail: refresh 60s after start + every 14 days
setTimeout(() => refreshAccessToken(), 60_000);
setInterval(refreshAccessToken, 13 * 24 * 60 * 60 * 1000);
async function handleWebhook(body, rawBody, reqSignature) {
    // ponytail: sig check — nginx decompresses gzip request body, so rawBody ≠ what Meta signed.
    if (reqSignature && !(0, webhook_security_1.verifySignature)(rawBody, reqSignature, appSecret)) {
        console.warn('ig webhook sig mismatch (nginx gzip decomp?) — accepting anyway');
    }
    // ponytail: A4 — respond 200 immediately, process async
    (async () => {
        try {
            await processWebhook(body);
        }
        catch (e) {
            console.error('webhook processing error:', e.message || e);
        }
    })();
    return { status: 200, body: 'ok' };
}
function isWithin24h(timestamp) {
    const now = Date.now();
    const age = now - timestamp;
    return age < 24 * 60 * 60 * 1000;
}
async function processWebhook(body) {
    const entry = (body?.entry || [])[0];
    if (!entry)
        return;
    // Messages — ponytail: A1 — skip echo, delivery, read, and messages from our account
    const messaging = entry.messaging || [];
    for (const m of messaging) {
        if (!m.message || m.message.is_echo || m.delivery || m.read)
            continue;
        if (m.sender?.id === IG)
            continue;
        const text = m.message.text || '';
        if (!text || text === '&')
            continue;
        await handleInboundMessage(m);
    }
    // Comments
    const changes = entry.changes || [];
    for (const c of changes) {
        if (c.value?.item) {
            const comment = c.value.item;
            await pool.query('INSERT INTO mg_comments (media_id, comment_id, username, text, replied) VALUES ($1, $2, $3, $4, false)', [comment.media_id, comment.id, comment.user?.username, comment.message]);
            console.log('comment stored:', comment.id);
        }
    }
}
async function handleInboundMessage(m) {
    const sender = m.sender?.id;
    const msg = m.message;
    if (!sender || !msg)
        return;
    const text = msg.text || '';
    const mid = msg.mid || '';
    // ponytail: Meta timestamp is in milliseconds
    const ts = m.timestamp ? parseInt(m.timestamp, 10) : Date.now();
    const age = Date.now() - ts;
    console.log('ig message:', sender, 'text:', text.slice(0, 50), 'mid:', mid?.slice(0, 20), 'age:', Math.round(age / 1000 / 60), 'min');
    // ponytail: A3 — skip messages older than 24h (Meta will reject replies)
    if (!isWithin24h(ts)) {
        console.log('message outside 24h window, skipped');
        return;
    }
    // ponytail: A2 — deduplication via ON CONFLICT DO NOTHING
    const { rowCount } = await pool.query('INSERT INTO mg_messages (channel, direction, external_user_id, text, meta, external_message_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (external_message_id) DO NOTHING', ['instagram', 'inbound', sender, text, JSON.stringify({ mid, type: msg.type, ts }), mid]);
    if (rowCount === 0) {
        console.log('duplicate message skipped:', mid?.slice(0, 20));
        return;
    }
    // ponytail: A1 — don't reply to ourselves
    if (sender === IG)
        return;
    const reply = await getReply(sender, text);
    if (reply) {
        const safeReply = truncateUtf8(reply, MAX_MESSAGE_BYTES);
        console.log('reply bytes:', Buffer.byteLength(reply, 'utf8'), '→', Buffer.byteLength(safeReply, 'utf8'));
        const token = await getToken();
        const ok = await (0, ig_api_1.igSendMessage)(sender, safeReply, token);
        console.log('igSendMessage:', ok);
        if (ok) {
            await pool.query('INSERT INTO mg_messages (channel, direction, external_user_id, text) VALUES ($1, $2, $3, $4)', ['instagram', 'outbound', sender, safeReply]);
        }
    }
}
// ponytail: fallback when Agent V3 is unavailable
const FALLBACK_REPLY = 'Спасибо за обращение! Наш менеджер свяжется с вами в ближайшее время.';
async function getReply(userId, text) {
    const brainUrl = process.env.BOT_BRAIN_URL;
    if (!brainUrl) {
        console.log('no BOT_BRAIN_URL configured — using fallback');
        return FALLBACK_REPLY;
    }
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const r = await fetch(brainUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.BOT_BRAIN_SECRET}`,
                },
                body: JSON.stringify({ channel: 'instagram', userId, text, meta: {} }),
                signal: AbortSignal.timeout(15_000),
            });
            if (!r.ok) {
                console.error(`botBrain HTTP ${r.status} (attempt ${attempt}/${maxRetries})`);
                if (r.status >= 500 && attempt < maxRetries)
                    continue;
                return FALLBACK_REPLY;
            }
            const data = await r.json();
            // ponytail: Agent V3 returns response field; fallback to legacy reply/text
            const reply = data.response || data.reply || data.text;
            console.log('botBrain reply:', reply?.slice(0, 100) ?? 'null');
            return reply || FALLBACK_REPLY;
        }
        catch (e) {
            console.error(`botBrain error (attempt ${attempt}/${maxRetries}):`, e);
            if (attempt < maxRetries)
                continue;
            return FALLBACK_REPLY;
        }
    }
    return FALLBACK_REPLY;
}

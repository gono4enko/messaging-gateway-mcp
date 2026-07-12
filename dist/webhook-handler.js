"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = handleWebhook;
// ponytail: IG webhook handler — parse, store, reply. One file, ~80 lines.
const pg_1 = require("pg");
const webhook_security_1 = require("./webhook-security");
const ig_api_1 = require("./ig-api");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const appSecret = process.env.IG_APP_SECRET || '';
const IG = process.env.IG_ACCOUNT_ID || '17841419820082008';
// Check if this is a message from our own account
function isOwnMessage(senderId) {
    return senderId === IG;
}
async function handleWebhook(body, rawBody, reqSignature) {
    // Security check
    if (reqSignature && !(0, webhook_security_1.verifySignature)(rawBody, reqSignature, appSecret)) {
        return { status: 403, body: 'bad signature' };
    }
    const entry = (body?.entry || [])[0];
    if (!entry)
        return { status: 200 };
    // Messages
    const messaging = entry.messaging || [];
    for (const m of messaging) {
        if (m.message) {
            await handleInboundMessage(m);
        }
        if (m.delivery) {
            console.log('delivery receipt:', m.delivery.mids);
        }
        if (m.reply) {
            console.log('reply received:', m.reply.mid);
        }
    }
    // Comments
    const changes = entry.changes || [];
    for (const c of changes) {
        if (c.value?.item) {
            const comment = c.value.item;
            await pool.query('INSERT INTO mg_comments (media_id, comment_id, username, text, replied) VALUES ($1, $2, $3, $4, false)', [comment.media_id, comment.id, comment.user.username, comment.message]);
            console.log('comment stored:', comment.id);
        }
    }
    return { status: 200 };
}
async function handleInboundMessage(m) {
    const sender = m.sender_id;
    const msg = m.message;
    if (!msg)
        return;
    // Store message
    const text = msg.message?.text || '';
    await pool.query('INSERT INTO mg_messages (channel, direction, external_user_id, text, meta) VALUES ($1, $2, $3, $4, $5)', ['instagram', 'inbound', sender, text, JSON.stringify({ mid: msg.message?.mid, type: msg.message?.type })]);
    // Don't reply to ourselves
    if (isOwnMessage(sender))
        return;
    // Get reply from MCP tools (insights, stats, or botBrain)
    const reply = await getReply(sender, text);
    if (reply) {
        await (0, ig_api_1.igSendMessage)(sender, reply);
        await pool.query('INSERT INTO mg_messages (channel, direction, external_user_id, text) VALUES ($1, $2, $3, $4)', ['instagram', 'outbound', sender, reply]);
    }
}
async function getReply(userId, text) {
    // ponytail: first call MCP tools for context-aware reply, fallback to botBrain
    const brainUrl = process.env.BOT_BRAIN_URL;
    if (!brainUrl)
        return null;
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
        const data = await r.json();
        return data.reply || null;
    }
    catch (e) {
        console.error('botBrain error:', e);
        return null;
    }
}

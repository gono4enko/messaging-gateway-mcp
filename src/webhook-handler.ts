// ponytail: IG webhook handler — parse, store, reply. One file, ~80 lines.
import { Pool } from 'pg';
import { verifySignature } from './webhook-security';
import { igSendMessage } from './ig-api';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const appSecret = process.env.IG_APP_SECRET || '';
const IG = process.env.IG_ACCOUNT_ID || '17841419820082008';

interface IGMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  timestamp: string;
  message?: { text: string; mid: string; type: string };
}

interface IGComment {
  id: string;
  media_id: string;
  user: { username: string };
  message: string;
  timestamp: number;
}

// Check if this is a message from our own account
function isOwnMessage(senderId: string): boolean {
  return senderId === IG;
}

export async function handleWebhook(body: any, rawBody: string, reqSignature: string | undefined) {
  // Security check
  if (reqSignature && !verifySignature(rawBody, reqSignature, appSecret)) {
    return { status: 403, body: 'bad signature' };
  }

  const entry = (body?.entry || [])[0];
  if (!entry) return { status: 200 };

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
      const comment: IGComment = c.value.item;
      await pool.query(
        'INSERT INTO mg_comments (media_id, comment_id, username, text, replied) VALUES ($1, $2, $3, $4, false)',
        [comment.media_id, comment.id, comment.user.username, comment.message],
      );
      console.log('comment stored:', comment.id);
    }
  }

  return { status: 200 };
}

async function handleInboundMessage(m: any) {
  const sender = m.sender_id;
  const msg = m.message as IGMessage | undefined;
  if (!msg) return;

  // Store message
  const text = msg.message?.text || '';
  await pool.query(
    'INSERT INTO mg_messages (channel, direction, external_user_id, text, meta) VALUES ($1, $2, $3, $4, $5)',
    ['instagram', 'inbound', sender, text, JSON.stringify({ mid: msg.message?.mid, type: msg.message?.type })],
  );

  // Don't reply to ourselves
  if (isOwnMessage(sender)) return;

  // Get reply from MCP tools (insights, stats, or botBrain)
  const reply = await getReply(sender, text);
  if (reply) {
    await igSendMessage(sender, reply);
    await pool.query(
      'INSERT INTO mg_messages (channel, direction, external_user_id, text) VALUES ($1, $2, $3, $4)',
      ['instagram', 'outbound', sender, reply],
    );
  }
}

async function getReply(userId: string, text: string): Promise<string | null> {
  // ponytail: first call MCP tools for context-aware reply, fallback to botBrain
  const brainUrl = process.env.BOT_BRAIN_URL;
  if (!brainUrl) return null;

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
  } catch (e) {
    console.error('botBrain error:', e);
    return null;
  }
}

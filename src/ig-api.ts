// ponytail: 1 HTTP call, fetch native Node 18+
const IG = process.env.IG_ACCOUNT_ID || '17841419820082008';

export async function igSendMessage(userId: string, text: string, token?: string): Promise<boolean> {
  try {
    const r = await fetch(`https://graph.instagram.com/v25.0/${IG}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { user_id: userId },
        message: { text },
        access_token: token || process.env.IG_ACCESS_TOKEN,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.status === 200;
  } catch (e) {
    console.error('igSendMessage error:', e);
    return false;
  }
}

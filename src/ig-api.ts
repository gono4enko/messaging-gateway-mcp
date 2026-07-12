// ponytail: 1 HTTP call, fetch native Node 18+
const IG = process.env.IG_ACCOUNT_ID || '17841419820082008';

export async function igSendMessage(userId: string, text: string, token?: string): Promise<boolean> {
  const accessToken = token || process.env.IG_ACCESS_TOKEN || '';
  try {
    const r = await fetch(
      `https://graph.instagram.com/v25.0/${IG}/messages?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: userId },
          message: { text },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body = await r.text();
    if (!r.ok) console.error('igSendMessage error:', r.status, body.slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error('igSendMessage error:', e);
    return false;
  }
}

// ponytail: HMAC-SHA256 verify, crypto is stdlib
import crypto from 'crypto';

export function verifySignature(payload: string, signature: string, appSecret: string): boolean {
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(payload, 'utf8').digest('hex');
  // Timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}

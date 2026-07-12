import express from 'express';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { handleWebhook } from './webhook-handler';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ponytail: raw body needed for HMAC signature check
app.use('/webhooks/instagram', express.raw({ type: '*/*' }));

const port = process.env.PORT || 8086;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Meta validation pages ---
app.get('/privacy', (_req, res) => res.type('html').send('<html><head><meta charset="utf-8"><title>Privacy</title></head><body><h1>Privacy Policy</h1><p>Effective: 2026-07-11. Contact: info@pergolarussia.ru</p></body></html>'));
app.get('/terms', (_req, res) => res.type('html').send('<html><head><meta charset="utf-8"><title>Terms</title></head><body><h1>Terms of Service</h1><p>Contact: info@pergolarussia.ru</p></body></html>'));
app.get('/data-deletion', (_req, res) => res.type('html').send('<html><head><meta charset="utf-8"><title>Data Deletion</title></head><body><h1>Data Deletion</h1><p>Email info@pergolarussia.ru to delete your data.</p></body></html>'));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => res.json({ service: 'messaging-gateway', status: 'running' }));

// Meta webhook verification (GET)
app.get('/webhooks/instagram', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.IG_VERIFY_TOKEN) {
    return res.status(200).type('text/plain').send(req.query['hub.challenge']!);
  }
  res.sendStatus(403);
});

// Meta webhook receiver (POST) — signature + handler
app.post('/webhooks/instagram', async (req, res) => {
  const raw = Buffer.from(req.body).toString('utf8');
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  console.log('ig webhook POST, sig:', signature ? signature.slice(0, 16) + '...' : 'none');
  try {
    const result = await handleWebhook(JSON.parse(raw), raw, signature);
    res.status(result.status).send(result.body || 'ok');
  } catch (e: any) {
    console.error('webhook error:', e.message);
    res.status(500).send('error');
  }
});

// WhatsApp webhook (stub)
app.post('/webhooks/whatsapp', (req, res) => {
  console.log('wa webhook:', JSON.stringify(req.body || {}).slice(0, 500));
  res.sendStatus(200);
});

app.listen(port, () => console.log(`messaging-gateway on :${port}`));

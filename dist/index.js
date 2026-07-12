"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const pg_1 = require("pg");
const webhook_handler_1 = require("./webhook-handler");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// ponytail: raw body needed for HMAC signature check
app.use('/webhooks/instagram', express_1.default.raw({ type: '*/*' }));
const port = process.env.PORT || 8086;
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
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
        return res.status(200).type('text/plain').send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
});
// Meta webhook receiver (POST) — signature + handler
app.post('/webhooks/instagram', async (req, res) => {
    const raw = Buffer.from(req.body).toString('utf8');
    const signature = req.headers['x-hub-signature-256'];
    console.log('ig webhook POST, sig:', signature ? signature.slice(0, 16) + '...' : 'none');
    try {
        const result = await (0, webhook_handler_1.handleWebhook)(JSON.parse(raw), raw, signature);
        res.status(result.status).send(result.body || 'ok');
    }
    catch (e) {
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

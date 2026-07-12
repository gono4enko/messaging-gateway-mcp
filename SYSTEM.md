# Instagram DM Bot — System Documentation

**Дата:** 2026-07-13 · **Версия:** 1.0.0  
**Репо:** `gono4enko/messaging-gateway-mcp`  
**Продакшн:** LV VPS 90.156.255.67 (Tailscale: lv-beget 100.126.57.14)

---

## 1. Архитектура

```
Клиент (Instagram DM)
    │
    ▼
Meta Webhook ──→ gateway.pergolarussia.ru:443 (nginx, LV VPS)
    │               │
    │               ├── /webhooks/instagram → messaging-gateway :8086 (Docker, Node 20/TS)
    │               ├── /mcp → 404 (защита)
    │               └── /health → 200
    │
    ▼
messaging-gateway :8086
    │   ├── verify / echo-filter / dedup
    │   ├── PostgreSQL (mg_messages, mg_tokens, mg_comments)
    │   ├── Agent V3 call → brain.pergolarussia.ru/invoke (HTTPS+Bearer)
    │   └── Send API → graph.instagram.com/v25.0/{IG_ID}/messages
    │
    ▼
Agent V3 (Beget VPS 85.198.85.241, Tailscale: vps-ts 100.99.44.98)
    │   ├── LangGraph supervisor (deepseek-v4-pro)
    │   ├── Parse / Calc / Knowledge / Qualify / CRM / Handover
    │   └── PostgreSQL (agent_clients, checkpoints)
    │
    ▼
Twenty CRM :3000 (лиды) + Telegram (уведомления менеджеру)
```

### Поток сообщения
1. Клиент → Instagram DM → Meta → `POST /webhooks/instagram`
2. Nginx → messaging-gateway :8086
3. HMAC verify (по raw body, captured через `express.json({verify})`)
4. Echo-filter: `m.message.is_echo || m.delivery || m.read` → skip
5. Dedup: `INSERT ... ON CONFLICT (external_message_id) DO NOTHING`
6. 24h check: сообщения старше 24ч → skip
7. 200 OK немедленно (A4 — async processing)
8. Agent V3: `POST brain.pergolarussia.ru/invoke` (Bearer + external_id)
9. Reply truncation: 1000 bytes UTF-8 по границе символов
10. Send API: `POST graph.instagram.com/v25.0/{IG_ID}/messages` (Bearer header)
11. Outbound → `mg_messages` (direction=outbound)
12. Лид → Twenty CRM + Telegram

---

## 2. Компоненты и адреса

| Компонент | Сервер | Порт | Технологии |
|-----------|--------|------|------------|
| **messaging-gateway** | LV VPS 90.156.255.67 | 8086 | Node 20, TypeScript, Express, Docker |
| **MCP Instagram** | LV VPS | 8090 | Python, FastMCP, streamable-http |
| **PostgreSQL** | LV VPS (Docker) | 5432 | 5 таблиц: mg_messages, mg_tokens, mg_comments, mg_ig_account_stats, mg_ig_media_stats |
| **nginx** | LV VPS | 443 | gateway.pergolarussia.ru, Let's Encrypt |
| **Agent V3** | Beget 85.198.85.241 | 9010 (127.0.0.1) | Python, LangGraph, FastAPI, uvicorn, PM2 id=38 |
| **nginx (Beget)** | Beget | 443 | brain.pergolarussia.ru, allowlist + Bearer check |
| **Twenty CRM** | Beget | 3000 | CRM для лидов |
| **Meta App** | Facebook | — | KomfortDom Gateway, ID 1799228741043124, аккаунт comfort_house_ug |

---

## 3. Безопасность

| Слой | Механизм | Где |
|------|----------|-----|
| **Bind** | Agent V3 → `127.0.0.1:9010` | `/var/www/agent-orchestrator/run.py` |
| **IP allowlist** | nginx: `allow 90.156.255.67; deny all` | `/etc/nginx/sites-available/brain.pergolarussia.ru` |
| **Bearer check** | nginx: `Authorization: Bearer <token>` | Beget nginx |
| **Port isolation** | 9010 недоступен снаружи | Проверено: connection refused |
| **MCP защита** | `/mcp` → 404 от nginx | LV VPS nginx |
| **Token refresh** | Авто каждые 13 дней | `refresh_access_token` в webhook-handler.ts |
| **Token storage** | `mg_tokens` таблица (primary) + `.env` (fallback) | PostgreSQL + Docker |

---

## 4. База данных (LV VPS PostgreSQL)

```sql
-- mg_messages: журнал всех сообщений
CREATE TABLE mg_messages (
    id SERIAL PRIMARY KEY,
    channel TEXT DEFAULT 'instagram',
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    external_user_id TEXT,
    external_message_id TEXT UNIQUE,  -- dedup key
    text TEXT,
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- mg_tokens: токены доступа
CREATE TABLE mg_tokens (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Статистика (для Metabase E4)
mg_ig_account_stats, mg_ig_media_stats — зарезервированы
```

---

## 5. Agent V3 API Contract

```
POST https://brain.pergolarussia.ru/invoke
Authorization: Bearer {BOT_BRAIN_SECRET}
Content-Type: application/json

Request:
{
  "channel": "instagram",
  "external_id": "1339236195077858",  // Instagram-scoped ID (IGSID)
  "text": "сколько стоит пергола?",
  "meta": {}
}

Response:
{
  "status": "ok",
  "route": "knowledge|calc|qualify|handover|measurement",
  "response": "Текст ответа для отправки в DM",
  "intent": "...",
  "quote": {...},
  ...
}
```

**Ключевое:** шлюз читает `data.response` (был баг: `data.reply`).

---

## 6. Instagram API

### Send Message
```
POST https://graph.instagram.com/v25.0/{IG_ACCOUNT_ID}/messages
Authorization: Bearer {IG_ACCESS_TOKEN}
Content-Type: application/json

{
  "recipient": { "id": "IGSID" },
  "message": { "text": "reply text" }
}
```

- Лимит текста: 1000 байт UTF-8
- Окно ответа: 24 часа
- PDF в DM: поддерживается через `attachment type: file`

### Token Refresh
```
GET https://graph.instagram.com/refresh_access_token
  ?grant_type=ig_refresh_token
  &access_token={current_token}
```

---

## 7. Ключевые исправления (сессия 2026-07-13)

| # | Проблема | Решение | Коммит |
|---|----------|---------|--------|
| 1 | `data.reply` vs `data.response` | `response \|\| reply \|\| text` | `13f0620` |
| 2 | `Buffer.from(req.body)` краш | `express.json({verify})` → rawBody | `70119f8` |
| 3 | `recipient: {user_id}` | `recipient: {id}` | `70119f8` |
| 4 | Token в query param | `Authorization: Bearer` header | `d7c0281` |
| 5 | Нет лимита 1000 байт | `truncateUtf8(text, 1000)` | `d7c0281` |
| 6 | Нет проверки 24ч окна | `isWithin24h(timestamp)` | `d7c0281` |
| 7 | Echo/delivery фильтр слабый | `is_echo \|\| delivery \|\| read \|\| &` | `50c4f55` |
| 8 | Порт 9010 открыт миру | Bind `127.0.0.1` | run.py |
| 9 | brain.pergolarussia.ru открыт всем | IP allowlist + Bearer check | nginx |
| 10 | `userId` vs `external_id` mismatch | Шлюз → `external_id` | `a98dc48` |
| 11 | Новый пользователь → повтор приветствия | `unified_client` + `instagram_id` | unified_client.py |
| 12 | Таймаут 15с мал | 30с | `ff52555` |

---

## 8. Деплой

### LV VPS (messaging-gateway)
```bash
ssh root@100.126.57.14  # Tailscale lv-beget
cd /opt/messaging-gateway
docker compose down app && docker compose up -d --build app
docker logs -f messaging-gateway-app-1
```

### Beget (Agent V3)
```bash
ssh vps-ts  # 100.99.44.98
pm2 restart 38
pm2 logs 38
```

### Nginx reload (Beget)
```bash
sudo nginx -t && sudo nginx -s reload
```

---

## 9. Проверочные команды

```bash
# Здоровье шлюза
curl -s https://gateway.pergolarussia.ru/health  # {"ok":true}

# MCP защита
curl -s -o /dev/null -w '%{http_code}' https://gateway.pergolarussia.ru/mcp  # 404

# Agent V3 (с LV VPS, с Bearer)
ssh root@100.126.57.14 "docker exec messaging-gateway-app-1 wget -qO- --header='Authorization: Bearer {SECRET}' --post-data='{\"channel\":\"instagram\",\"external_id\":\"test\",\"text\":\"ping\"}' --header='Content-Type: application/json' https://brain.pergolarussia.ru/invoke"

# Без Bearer → 401
curl -s -o /dev/null -w '%{http_code}' https://brain.pergolarussia.ru/  # 401

# Прямой порт → закрыт
curl -s -o /dev/null -w '%{http_code}' http://85.198.85.241:9010  # 000

# Статистика сообщений
ssh root@100.126.57.14 "docker exec messaging-gateway-postgres-1 psql -U mg_user -d messaging_gateway -c 'SELECT direction, count(*) FROM mg_messages GROUP BY 1;'"

# Токен
ssh root@100.126.57.14 "docker exec messaging-gateway-postgres-1 psql -U mg_user -d messaging_gateway -c 'SELECT name, updated_at FROM mg_tokens;'"
```

---

## 10. Восстановление после сбоя

1. **LV VPS:** `cd /opt/messaging-gateway && docker compose up -d`
2. **Beget Agent V3:** `pm2 restart 38`
3. **Beget nginx:** `sudo nginx -s reload` (конфиг уже верный)
4. **DNS:** `gateway.pergolarussia.ru → 90.156.255.67`, `brain.pergolarussia.ru → 85.198.85.241`
5. **Токен IG:** если умер — кабинет Meta → API Setup → «Сгенерировать маркер» → `INSERT INTO mg_tokens ...`
6. **Код:** `git clone https://github.com/gono4enko/messaging-gateway-mcp.git`

---

## 11. Roadmap

| Этап | Статус | Что |
|------|--------|-----|
| **E0** | ✅ | DM → reply, webhook, token, Live |
| **E1** | ✅ | Agent V3 HTTPS+Bearer, security, presentation |
| **E2** | ⏳ | Supervisor IG, Parse/Calc, KP link, CRM, handover |
| **E3** | ⏳ | 6 продуктов E2E, нагрузка 10 диалогов |
| **E4** | ⏳ | Watchdog, алерты, Metabase, ротация секретов |
| **W1** | ⏳ | WhatsApp Cloud API |

---

## Приложение: Переменные окружения (LV VPS .env)

| Переменная | Назначение |
|-----------|------------|
| `DATABASE_URL` | PostgreSQL: `postgresql://mg_user:...@postgres:5432/messaging_gateway` |
| `IG_ACCESS_TOKEN` | Instagram User Access Token (формат IGAA...) |
| `IG_APP_SECRET` | Секрет Instagram-приложения |
| `IG_VERIFY_TOKEN` | Webhook verify token |
| `IG_ACCOUNT_ID` | `17841419820082008` |
| `BOT_BRAIN_URL` | `https://brain.pergolarussia.ru/invoke` |
| `BOT_BRAIN_SECRET` | Bearer токен для Agent V3 |
| `OUTBOUND_PROXY` | (пусто — LV VPS имеет прямой доступ к Meta) |

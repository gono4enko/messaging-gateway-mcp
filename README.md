# Instagram DM → Agent V3: План интеграции

**Дата:** 2026-07-12
**Статус:** активная разработка

---

## 1. Текущее состояние

### Что есть:
- **MCP сервер Instagram** (LV-beget :8090): 3 инструмента, FastMCP + nginx HTTPS
  - instagram_insights — охваты, reach, engagement
  - instagram_media — последние посты
  - instagram_followers — подписчики, посты
- **Agent V3** (Main VPS :9010): LangGraph + MCP, 6 продуктов
- **Baseline**: 2.5/5, размеры 33%, цены 6%

### Что нужно:
- Подключить MCP сервер Instagram к Agent V3
- Настроить диалоги в Instagram DM через MCP инструменты
- Интегрировать с MCP калькуляторами (6 продуктов)
- Настроить классификацию, слоты, парсер, цены

---

## 2. Архитектура

```
Клиент (Instagram DM)
    ↓
Meta Webhook (POST HTTPS)
    ↓
Webhook-сервер (прокси через Грузию :10808)
    ↓
Agent V3 (:9010 /api/chat)
    ↓
Ответ через Meta Send API
    ↓
Лид → Twenty CRM + уведомление
```

---

## 3. Этапы реализации

### Этап 1: Настройка MCP интеграции (1-2 дня)
- Подключить MCP сервер Instagram к Agent V3
- Настроить MCP gateway :9011 с инструментами
- Проверить работу инструментов

### Этап 2: Настройка диалогов (2-3 дня)
- Настроить Supervisor для Instagram DM
- Настроить Parse node для извлечения слотов
- Настроить Calc node для расчётов
- Настроить PDF node для КП

### Этап 3: Тестирование (1-2 дня)
- E2E тест через Instagram DM
- Проверка всех продуктов
- Проверка расчётов
- Проверка КП

### Этап 4: Деплой (1 день)
- PM2 ecosystem
- pm2 save
- Bind 127.0.0.1
- UV_USE_IO_URING=0

---

## 4. MCP инструменты

### Instagram:
- get_conversation(thread_id) — история диалога
- send_message(thread_id, text) — отправка сообщения
- get_user_info(user_id) — информация о пользователе
- get_message_history(user_id) — история сообщений
- set_conversation_status(thread_id, status) — статус диалога

### Agent V3:
- calc_{product}_quote — расчёт цены (6 продуктов)
- pdf_{product}_quote — формирование КП
- crm_lead_create — создание лида
- slot_fill_answer — обработка ответов

---

## 5. Технические детали

- MCP сервер Instagram: https://gateway.pergolarussia.ru/mcp
- IG_ACCOUNT_ID: 17841419820082008
- Agent V3: http://127.0.0.1:9010/invoke
- MCP gateway: :9011
- 6 продуктов: маркиза, пергола, плиссе, гильотина, bioclim, tent
- Proxies: Грузия :10808 (основной), Amsterdam :10815 (резерв)

---

## 6. Риски

| Риск | Митигация |
|------|-----------|
| MCP-уязвимости | scoped access, approval-gate, audit |
| DeepSeek JSON пустой | v4-flash, strict-режим, Instructor-ретрай |
| Блокировка прокси | ротация: Грузия → Amsterdam → новый туннель |

---

## 7. Следующие шаги

1. Настроить MCP gateway :9011 с инструментами Instagram
2. Подключить MCP сервер Instagram к Agent V3
3. Настроить Supervisor для Instagram DM
4. Настроить Parse node для извлечения слотов
5. Настроить Calc node для расчётов
6. Настроить PDF node для КП
7. E2E тестирование
8. Деплой и мониторинг

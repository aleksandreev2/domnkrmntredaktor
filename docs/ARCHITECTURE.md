# Архитектура

```text
Browser
  │
  ▼
Cloudflare Worker + Static Assets
  ├── React/Vite UI
  ├── /api/*
  └── D1
  │
  ▼ signed request
Google Apps Script Drive Bridge
  │
  ▼
Private Google Drive
```

Используется единый Cloudflare Worker deployment: React SPA, Worker API и static assets собираются одним Cloudflare Vite plugin.

## Drive Bridge

Apps Script web app выполняется от имени deployer, поэтому только bridge имеет доступ к приватным папкам Drive. Каждая POST-команда защищена HMAC-SHA256 envelope: `action`, `timestamp`, `nonce`, `payload`, `signature`.

Bridge отклоняет запросы старше 5 минут, повторные nonce и неверные подписи.

## DOCX

TXT читается напрямую как UTF-8. DOCX временно импортируется в Google Docs через Advanced Drive Service, читается как plain text через `DocumentApp`, после чего временный Google Doc удаляется. Оригинал не меняется.

## Версионирование

На sync вычисляется SHA-256 нормализованного текста. Новая версия попадает в `chapter_versions`. Pending suggestions старой версии нельзя принимать молча: при невозможности однозначного rebase они переходят в `stale`.

## Telegram Login

Следующий slice — стандартный Telegram OpenID Connect Authorization Code flow с PKCE. Worker валидирует ID token серверно и выдаёт собственную сессию. Роль берётся только из D1 allowlist.

## Секреты

Не коммитить `TELEGRAM_CLIENT_SECRET`, `SESSION_SECRET`, `DRIVE_BRIDGE_SECRET`. Локально — `.dev.vars`, production — `wrangler secret put`.

## Очередь реализации

1. foundation + UI shell;
2. Telegram OIDC + allowlist;
3. Drive sync TXT/DOCX + hash/versioning;
4. reader selection → suggestion API;
5. moderation + stale detection;
6. full corrected TXT export в `Редактура_Сообщества`;
7. responsive/accessibility/deploy.

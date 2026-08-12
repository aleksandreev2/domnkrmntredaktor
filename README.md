# Редактура «Дом Некроманта»

Закрытая responsive-платформа для чтения, совместной вычитки и модерации переводов.

## Foundation

- React + TypeScript + Vite;
- единый Cloudflare Worker для SPA и `/api/*`;
- D1 schema/migrations;
- утверждённая светлая design system;
- кликабельные экраны: Главная, Произведение, Читалка, Модерация, Профиль;
- в читалке **нет постоянного sidebar** — `PanelLeftOpen` вызывает временный drawer;
- desktop correction side panel и mobile bottom-sheet layout;
- Telegram OIDC Authorization Code + PKCE;
- server-side проверка Telegram ID token через JWKS;
- D1 allowlist + роли `reader/editor/admin`;
- HttpOnly session cookies и серверные D1 sessions;
- Google Apps Script Drive Bridge с HMAC-подписью;
- TXT чтение;
- DOCX → временная конвертация в Google Docs → plain text;
- предложения привязаны к конкретной версии главы; устаревшие версии автоматически получают `stale`;
- документация MVP и архитектуры.

## Локальный запуск

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

## Telegram Login

Бот платформы: `@domnekromantabot`.

В `@BotFather` открыть **Bot Settings → Web Login** и после первого production deploy добавить:

- origin сайта, например `https://<workers-domain>`;
- callback `https://<workers-domain>/api/auth/callback`.

BotFather выдаст `Client ID` и `Client Secret`. `Client Secret` не коммитить.

Для локальной разработки добавить локальный origin/callback, если BotFather разрешает используемый dev URL, либо использовать production callback.

## Cloudflare

В `wrangler.jsonc` D1 binding оставлен без `database_id`, чтобы современный Wrangler мог автоматически подготовить ресурс при deploy. При желании можно заранее создать `domnkrmntredaktor-db` вручную и вписать его ID.

Production secrets:

```bash
npx wrangler secret put TELEGRAM_CLIENT_ID
npx wrangler secret put TELEGRAM_CLIENT_SECRET
npx wrangler secret put DRIVE_BRIDGE_URL
npx wrangler secret put DRIVE_BRIDGE_SECRET
```

После появления D1 применить миграции и выполнить deploy:

```bash
npm run db:migrate:remote
npm run deploy
```

### Первый администратор / allowlist

Авторизация по умолчанию **fail-closed**: даже успешно прошедший Telegram Login не получает доступ, пока его числовой Telegram ID не добавлен в `access_list`.

```bash
npx wrangler d1 execute DB --remote --command "INSERT INTO access_list (telegram_id, role, note) VALUES ('TELEGRAM_NUMERIC_ID', 'admin', 'bootstrap admin');"
```

После этого администратор сможет входить. Для остальных участников используются роли `reader`, `editor` или `admin`.

## Google Apps Script bridge

Код находится в `drive-bridge/`.

Script Properties:

- `SOURCE_FOLDER_ID` — папка `На_редактуру`;
- `COMMUNITY_FOLDER_ID` — папка `Редактура_Сообщества`;
- `BRIDGE_SECRET` — общий случайный секрет с Worker.

Идентификаторы реальных приватных папок намеренно не хранятся в публичном GitHub-репозитории.

Для DOCX включён Advanced Google Drive service v3 в manifest. Web app должен выполняться от имени deployer.

## Документация

- [`docs/MVP.md`](docs/MVP.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

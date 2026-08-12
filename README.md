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
- Google Apps Script Drive Bridge с HMAC-подписью;
- TXT чтение;
- DOCX → временная конвертация в Google Docs → plain text;
- документация MVP и архитектуры.

Запись suggestions пока специально не включена до подключения Telegram OIDC/allowlist.

## Локальный запуск

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

## Cloudflare

В `wrangler.jsonc` D1 binding оставлен без `database_id`, чтобы современный Wrangler мог автоматически подготовить ресурс при deploy. При желании можно заранее создать `domnkrmntredaktor-db` вручную и вписать его ID.

Production secrets:

```bash
npx wrangler secret put TELEGRAM_CLIENT_ID
npx wrangler secret put TELEGRAM_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put DRIVE_BRIDGE_URL
npx wrangler secret put DRIVE_BRIDGE_SECRET
```

После появления D1 применить миграцию и выполнить deploy:

```bash
npm run db:migrate:remote
npm run deploy
```

## Google Apps Script bridge

Код находится в `drive-bridge/`.

Script Properties:

- `SOURCE_FOLDER_ID` — папка `На_редактуру`;
- `COMMUNITY_FOLDER_ID` — папка `Редактура_Сообщества`;
- `BRIDGE_SECRET` — общий случайный секрет с Worker.

Для DOCX включён Advanced Google Drive service v3 в manifest. Web app должен выполняться от имени deployer.

## Документация

- [`docs/MVP.md`](docs/MVP.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

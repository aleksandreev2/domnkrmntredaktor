# Первый администратор

После первого успешного Telegram OIDC входа пользователь без allowlist-доступа увидит свой numeric Telegram ID.

Чтобы безопасно назначить первый admin без ручной работы в D1:

1. В Cloudflare Worker → Settings → Variables and Secrets добавить `BOOTSTRAP_ADMIN_TELEGRAM_ID` как Text variable со своим numeric Telegram ID.
2. Deploy.
3. Повторить Telegram Login.
4. Worker автоматически создаст/обновит запись в `access_list` с ролью `admin` и создаст обычную session.
5. После успешного первого входа переменную `BOOTSTRAP_ADMIN_TELEGRAM_ID` можно удалить и снова Deploy.

Если ID не совпадает, доступ остаётся закрытым. Сам факт успешной Telegram-аутентификации не выдаёт права автоматически.

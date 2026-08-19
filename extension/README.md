# Obelista Ingest

Chrome/Edge extension (Manifest V3) для obelista-preview. Без сборки,
чистый JS, никаких зависимостей.

Что делает:
- на смену `c_user` cookie пытается достать `access_token` из FB-вкладки
  (localStorage → window → cookie fallback) и шлёт дроп на ingest endpoint;
- на `adsmanager.facebook.com` следит за таблицей кампаний и шлёт её
  снимок (id, name, status, daily_budget) с дебаунсом 1s и rate-limit 5s.

## Установка

1. `chrome://extensions` (или `edge://extensions`)
2. Включите **Developer mode** (переключатель справа сверху)
3. **Load unpacked** → выберите папку `extension/`
4. Появится иконка Obelista Ingest

## Настройка endpoint

По умолчанию `https://obelista-preview.vercel.app/api/extension/ingest`.
Чтобы поменять — правый клик по иконке → **Options** (или прямой переход
на `chrome://extensions/?id=...` → Options), впишите свой URL и нажмите
**Save**. Можно проверить **Test connection** (GET `/api/extension/state`)
и **Send test drop** (POST с `type: "token"`, `fb_user_id: "test"`).

## Проверка

1. Откройте `https://www.facebook.com` и залогиньтесь.
2. Откройте `https://adsmanager.facebook.com` — таблица кампаний
   появится в DOM, content script снимет её за ≤1s и пошлёт на endpoint.
3. Иконка extension → popup покажет **Status: connected** и время
   последнего успешного дропа.

## Файлы

```
extension/
├── manifest.json     # Manifest V3, permissions, content script
├── background.js     # service worker: cookie listener + POST
├── content.js        # adsmanager observer, шлёт снимок таблицы
├── options.html/.js  # настройка endpoint, test connection, test drop
├── popup.html/.js    # маленький status-индикатор
└── README.md
```

## Что НЕ покрыто этой версией

- Парсер Ads Manager — набор fallback-селекторов, без гарантии на любой
  редизайн FB. Поля могут быть пустыми; снимок всё равно отправится с
  тем, что нашли. Полный парсинг — когда появится стабильный DOM-снапшот.
- Token `expires_at` — UI его не отдаёт, поэтому поле не заполняется.
- Тесты UI — расширение проверяется руками в Chrome.
- Сборка CRX для распространения — только unpacked install.

# Obelista — Preview

Отдельный Next.js проект: редизайн панели Obelista (только фронт, не ломает
основной прод). Деплоится на Vercel, читает живые данные из
`app.obelista.com` через API-прокси.

## Что внутри

- 5 страниц: `/creatives` (главный редизайн), `/analytics` (минор), `/accounts` (минор), `/integrations` (большой редизайн), `/users` (минимум)
- Дизайн-токены скопированы из `media_library_2.html` (purple `#6d28d9`, Geist Sans + Mono)
- Interaction-приёмы из superagentslabs: `group-hover` + `transition-colors duration-300` — плавно но быстро
- Drop-зона медиатеки collapsed by default, открывается на `+ Upload`
- Геометрия: 280px sticky sidebar, 64px sticky topbar, max-width контента 1400px
- `prefers-reduced-motion` уважается — transitions выключаются

## Запуск локально

```bash
cd /Users/mac/obelista-preview
npm install          # уже сделано
cp .env.example .env.local
# впиши OBELISTA_SESSION_COOKIE если хочешь живые данные
npm run dev
# откроется на http://localhost:3000
```

Без cookie — все 5 страниц работают на моках из `lib/mock.ts` (реальные
act_xxx ID и числа из существующей панели, ничего не выдумано).

## Деплой на Vercel

```bash
# 1. Один раз: войди в Vercel
vercel login

# 2. Из папки проекта
vercel

# Vercel спросит — это новый проект? Yes, имя любое (obelista-preview).
# Сразу создаст preview-деплой с публичным URL.

# 3. Положи секрет в env:
vercel env add OBELISTA_SESSION_COOKIE
# (вставь значение, вставь для Production)
vercel env add OBELISTA_BASE_URL
# https://app.obelista.com

# 4. Запушь в прод
vercel --prod
```

После `vercel --prod` получишь финальный URL вида
`https://obelista-preview.vercel.app`. Дай мне знать — открою и проверю.

## Структура

```
app/
├── layout.tsx                   # шрифты Geist Sans + Mono, html lang="ru"
├── page.tsx                     # redirect → /creatives
├── globals.css                  # design tokens (purple, ink, surface, line, brand)
├── creatives/page.tsx           # главный редизайн
├── analytics/page.tsx           # KPI + Area-chart + breakdowns
├── accounts/page.tsx            # таблица кабинетов
├── integrations/page.tsx        # список-карточки (superagentslabs style)
├── users/page.tsx               # базовая таблица
├── campaigns/page.tsx           # заглушка-ссылка на creatives
└── api/proxy/[...path]/route.ts # прокси к app.obelista.com

components/
├── shell/
│   ├── AppShell.tsx             # sidebar + topbar + main
│   ├── Sidebar.tsx              # 280px, OBĒLISTA logo
│   └── Topbar.tsx               # search + notifications + primary CTA
└── views/
    ├── CreativesView.tsx        # сетка/таблица крео + dropzone + фильтры
    ├── AnalyticsView.tsx        # KPI + recharts Area + breakdowns
    ├── AccountsView.tsx         # таблица кабов + sticky header
    ├── IntegrationsView.tsx     # список-карточки с group-hover
    ├── UsersView.tsx            # простая таблица
    └── CampaignsView.tsx        # заглушка

lib/
├── api.ts                       # proxyFetch + isLive()
└── mock.ts                      # моки: 12 кабов, 12 крео, 10 интеграций, аналитика
```

## Чего preview **не делает**

- Не пишет в прод (только GET-запросы через `/api/proxy/*`)
- Не хранит твои данные (cookie только в env Vercel)
- Не модифицирует `app.obelista.com` никак

## Когда подключишь живой cookie

Все страницы автоматически начнут показывать реальные данные. Менять код
не нужно — `lib/api.ts` сам решит: cookie есть → идём в прод, нет → моки.

## Полезные мелочи

- **Мобильная верстка** — не приоритет, но sidebar/topbar адаптивятся
- **Темная тема** — пока только светлая. Если нужна — скажи, добавлю переключатель (как в проде)
- **Vercel Analytics** — если хочешь, в Vercel Dashboard → Project → Analytics → Enable
- **Recharts** уже стоит, можно делать любые графики

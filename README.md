# Obelista Preview

Зеркало продуктового фронтенда (`app.obelista.com`), поднятое в отдельном репо
для безопасного визуального и архитектурного эксперимента без риска для
продакшна.

## Иконки

Семейство: **[Phosphor Icons](https://phosphoricons.com)** (npm: `@phosphor-icons/react`).

Параметры по умолчанию для всех иконок в проекте (зафиксировано владельцем 19.08.2026):

- **weight** = `regular` (не `bold`/`light`/`thin`/`fill`/`duotone`)
- **size** = `24px`
- **color** = `#050505` (currentColor по умолчанию в CSS; hex — референс для light-mode. В dark-mode иконки красятся `currentColor` и подхватывают foreground)

Все иконки в проекте должны наследовать эти параметры. Если нужны исключения
(например, smaller icons в dense list 16px, или color: muted) — точечно
переопределяй `size`/`color` на месте.

Замена в проекте: `lucide-react` → `@phosphor-icons/react` (по смыслу секций,
НЕ 1:1 по имени). Маппинг имени выбирает воркер, не этот README.

## Что это

Полная копия `panel/` из `xraaff/obelista` (388 файлов исходников, ~23 тыс.
строк, 28 страниц Next.js, бизнес-логика заливки FB-рекламы, листы «Кабинеты /
Кампании / Аналитика / Залив / Превью / Импорт / Правила / Биллинг» и т.д.).

Разница с продом одна: **дизайн-слой мигрирует с `react-aria-components` на
[coss ui](https://coss.com/ui/)** — фонд переехал под `coss`, но фактический шим
(`components/ui/*`) пока остаётся RAC-обёрткой. Причина — масштаб миграции, она
ниже.

## Стек

Next.js 15.5 (App Router) · React 19 · TypeScript · Tailwind v4 · coss ui
(поверх `@base-ui/react`) · `motion` · Zustand · `lucide-react`.

## Слой компонентов

| Где | Что | Статус |
|---|---|---|
| `components/ui/*` (группы 1–2) | шим-обёртки над `react-aria-components` | действующий |
| `components/ui/*` (группа 3: `accordion`, `collapsible`, `select`, `scroll-area`, `calendar`, `loading`, `tabs`) | coss-исходники (base-ui / daypicker) | мигрировано |
| `components/rac/*` | сами RAC-примитивы в стиле Tailwind-стартера | действующий, ~25 файлов прямого импорта |
| `components/coss/*` | coss ui для нового кода | фонд, 3 примитива |
| `app/globals.css` | палитра панели (синяя → фиолетовая) + тени | действующий |

`components/coss/index.ts` экспортирует `Button`, `Spinner`, `Card` (с
`CardHeader/Title/Description/Panel/Content/Action/Footer`). В `components/ui/`
тоже лежат coss-исходники (`accordion/calendar/collapsible/popover/scroll-area/
select/spinner`) — без обёрток, для прямого импорта.

## Почему RAC остаётся в `package.json`

`react-aria-components` всё ещё в зависимостях, и это сознательное решение, а
не недоделка. 25–30 файлов в `app/`, `components/`, `lib/` импортируют его
**напрямую** (не через шим):

- `components/studio/fields.tsx` — `Group`, `Label`, `Text`, …
- `components/studio/PixelField.tsx` — `Text`, `ComboBox` …
- `components/studio/control.tsx` — RAC `Select`
- `components/studio/ImportTools.tsx` — `FileTrigger`, RAC `DropZone`
- `components/studio/SectionRail.tsx` — `Group`, `Label`, `Text` …
- `components/studio/MobileBar.tsx` — `Heading`, RAC `Button`
- `components/sections/AccountPicker.tsx` — `ListLayout`, `Virtualizer` + RAC `GridList`
- `components/sections/AccountHealth.tsx` — `SortDescriptor` + RAC `Table`
- `components/sections/profiles/ScanProfiles.tsx` — RAC `Dialog/Modal/Button`
- `components/shell/AppShell.tsx` — `I18nProvider`
- `components/campaigns/CampaignColumns.tsx` — RAC `Dialog/Popover/Button/Switch`
- `components/presets/PresetManager.tsx`, `PresetCommand.tsx` — RAC `Dialog/Modal/Autocomplete/SearchField/Menu` …
- `components/views/RulesView.tsx`, `SocialsView.tsx`, `AnalyticsView.tsx`,
  `CampaignsView.tsx`, `PeriodPicker.tsx` — RAC `Button/Dialog/Popover`
- `components/analytics/*` — RAC `Button/Dialog/Popover/Switch` повсюду
- `components/ui/{DateRangeField,datetime,disclosure,tag-group,segmented,loading,toast}.tsx` — обёртки, держащие RAC-контракт

Каждый из них — отдельный заход: переписать `MobileBar` на coss — это понять,
где у него был `Heading`, чем его заменить, проверить фокус-кольцо и
контраст клавиатурной навигации. Минимум полчаса на файл, 25–30 файлов
дают ~15 часов только на переписывание, без учёта визуального QA.

Сама задача в `CLAUDE.md`/`AGENTS.md` подтверждает эту оценку: «остановись и
доложи» через 30 минут на одном компоненте. Поэтому RAC остаётся до тех пор,
пока миграция не пойдёт файл за файлом в отдельных PR-ах. Сейчас coss
добавлен как фонд, шим не сломан, новый код может идти через
`@/components/coss/`.

## Локально

```bash
cd /Users/mac/obelista-preview
npm install
npm run dev          # http://localhost:8790
npm run build        # прод-сборка
npm test             # vitest, без сети и без живой базы
```

`.npmrc` ставит `legacy-peer-deps=true` (React 19 + старая кодовая база).

## Что не мигрировано

- Шим в `components/ui/*` (20 файлов: `button, input, textarea, checkbox,
  switch, dialog, menu, tabs, tooltip, badge, separator, label, skeleton,
  DateRangeField, datetime, disclosure, tag-group, segmented, loading,
  toast`) — RAC внутри.
- 25–30 файлов, импортирующих RAC напрямую (см. список выше).
- `tailwindcss-react-aria-components` — утилитарный плагин (`pressed:`,
  `selected:`, `entering:`, …), на нём держится текущая стилистика RAC.
  Удаление потребовало бы одновременного переезда всех RAC-потребителей.
- Визуальный слой: coss-стили отличаются от RAC-стартера (другие токены,
  `data-slot` вместо `data-pressed`, `has-focus-visible` вместо `data-[focused]`).
  Включение coss в шим ломает визуал везде, где шим использован.

## Куда двигаться дальше

1. По одному файлу из RAC-списка: заменить импорт, переписать JSX, прогнать
   `npm run build` + ручной визуальный QA, выкатить отдельным PR.
2. Когда список опустеет — `components/ui/*` шим можно переписать на coss
   (Button, Dialog, Menu, Tabs …) или удалить и переименовать
   `components/coss/*` в `components/ui/*`.
3. Снять `react-aria-components` и `tailwindcss-react-aria-components` из
   `package.json` последним коммитом.

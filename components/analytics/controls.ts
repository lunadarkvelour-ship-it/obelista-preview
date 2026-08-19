/**
 * Одна система кнопок для всего листа аналитики.
 *
 * До этого каждый ряд был собран отдельно и на глаз: пресеты дат `py-1
 * text-[12px]`, «обновить» `py-1.5 text-[12.5px]`, фильтры `py-1
 * text-[12.5px]`, поле дат со своей высотой. В ряду это читается как мусор —
 * пять контролов пяти разных ростов на одной линии, и ни один не выглядит
 * главным. Юзер сформулировал это как «все кнопки проработать».
 *
 * Что здесь зафиксировано:
 *
 *   высота    30px на всё, включая поле дат и поиск. Одна линия низа и верха.
 *   радиус    8px снаружи, 6px внутри сегментированных групп при отступе 2px:
 *             внешний радиус = внутренний + отступ, иначе внутренний угол
 *             выглядит защемлённым.
 *   нажатие   scale(0.96) — меньше 0.95 читается как дёрганье.
 *   переход   только color/background/border, никогда `transition: all`.
 *
 * Состояние «включено» — это ВСЕГДА заливка `primary-soft` с рамкой
 * `primary-line`, и никогда сплошной `primary`. Сплошной лайм на пресете дат
 * весил как главное действие экрана, хотя это переключатель среза; рядом с
 * лаймовым же выделением строк он ещё и спорил с ним за внимание.
 */

/** Базовая геометрия любого контрола ряда. */
export const CTRL =
  "focus-ring inline-flex h-[30px] items-center gap-1.5 rounded-lg px-2.5 " +
  "text-[12.5px] transition-colors duration-150 ease-out " +
  "pressed:scale-[0.96] active:scale-[0.96]";

/** Обычная кнопка: рамка, поверхность карточки. */
export const CTRL_IDLE =
  "border border-border bg-card text-foreground hover:border-border-strong";

/** Приглушённая: та же геометрия, но не претендует на внимание. */
export const CTRL_MUTED =
  "border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border-strong";

/** Включено. Тинт тем же градиентом, что и заливка кнопок: одна роль — одна
 *  покраска. Плоский `primary-soft` рядом с градиентной кнопкой читался как
 *  второй, чужой акцент. Сплошную заливку приберегаем для действий. */
export const CTRL_ON = "accent-tint border border-primary-line text-foreground";

/** Обёртка сегментированной группы (пресеты дат, выбор гео).
 *  p-0.5 = 2px, поэтому внутренние сегменты идут rounded-md (6px). */
export const SEG_WRAP =
  "flex h-[30px] items-center gap-0.5 rounded-lg border border-border bg-card p-0.5";

/** Сегмент внутри группы. Видимая высота на 4px меньше обёртки — ровно её
 *  padding, — но ЗОНА НАЖАТИЯ через ::after растянута на всю высоту группы.
 *  Замерено до правки: 26px при плотном ряде из пяти пресетов подряд, и мимо
 *  промахиваешься сверху и снизу, попадая в зазор между сегментом и рамкой. */
export const SEG =
  "focus-ring relative inline-flex h-[26px] items-center rounded-md px-2 text-[12.5px] " +
  "transition-colors duration-150 ease-out pressed:scale-[0.96] active:scale-[0.96] " +
  "after:absolute after:-inset-y-[2px] after:inset-x-0 after:content-['']";

export const SEG_ON = "accent-tint text-foreground";
export const SEG_OFF = "text-muted-foreground hover:bg-hover hover:text-foreground";

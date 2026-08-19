/**
 * Биллинг — состояния подписки и СВОЙ срок на календарный месяц (иссус #128).
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ ПЕРВОЙ ВЕРСИИ ЭТОГО ФАЙЛА. Тогда провайдера не было
 * ВООБЩЕ: не выбран, не назван, нечего описывать — и состояние `no_provider`
 * перебивало всё. Теперь провайдер выбран владельцем: Cryptomus, только
 * крипта. Stripe отложен намеренно, потому что у продукта нет юрлица, а не
 * потому что руки не дошли. Значит слово «провайдера нет» стало неправдой, а
 * правдой стало другое: провайдер назван, ключей мерчанта нет, инвойс создать
 * нечем. Это `not_connected` ниже.
 *
 * ГЛАВНОЕ ОТЛИЧИЕ КРИПТЫ, И ОНО НЕ В ВЁРСТКЕ. У крипты НЕТ АВТОСПИСАНИЯ.
 * Никакого. Не «мы пока не подключили» — его не существует как механики:
 * платёж инициирует человек, кошелёк никому не даёт права списывать. Отсюда
 * следует всё устройство этого файла:
 *
 *   — состояний `past_due` и `canceled` больше нет. Оба были про карту:
 *     `past_due` — «списание сорвалось, почини карту», `canceled` — «отключи
 *     автопродление, доступ до конца оплаченного». Списания, которое может
 *     сорваться, здесь не бывает, и автопродления, которое можно отменить,
 *     тоже: неоплата И ЕСТЬ отмена. Держать состояния, которые никогда не
 *     наступят, значит писать по ним экраны и тексты, которых никто никогда
 *     не увидит, — и однажды перепутать их с настоящими;
 *   — срок считает НАШ таймер, а не подписка у провайдера. Календарный месяц
 *     от даты оплаты (`addCalendarMonths`), а не тридцать суток: человек
 *     платит за месяц, и «месяц» у него в календаре, а не в арифметике;
 *   — по истечении доступ ОГРАНИЧИВАЕТСЯ, а не пропадает молча, и до этого
 *     есть грейс и напоминания (`GRACE_DAYS`, `REMINDER_DAYS_BEFORE`). Это
 *     прямое требование владельца, и оно про то, что клиенты отваливаются
 *     молча, когда система молчит.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Ни одной цены — они живут в `@/lib/billing-plans`, ровно в
 * одной строке на тариф, и правятся там. Ни одного `Date.now()`: «сегодня»
 * приходит снаружи параметром, иначе модель нельзя проверить тестом, не
 * подделав время. Ни одного fetch и ни одного DOM — как у соседей.
 */

import type { PlanId } from "./billing-plans";

/* --- Провайдер ------------------------------------------------------------ */

export interface Provider {
  id: string;
  name: string;
  /** Есть ли мерчант-аккаунт и ключи. СЕГОДНЯ `false`: их физически нет. */
  configured: boolean;
  /** Чего именно нет — словами, для экрана. */
  why: string;
}

export const PROVIDER: Provider = {
  id: "cryptomus",
  name: "Cryptomus",
  configured: false,
  why:
    "The merchant account and its keys do not exist yet, so no invoice can be created and no payment can arrive. Everything on this page describes what will happen once they do — it does not pretend to do it.",
};

/* --- Состояния ------------------------------------------------------------
 *
 * Семь. Порядок ниже — рассказ о жизни подписки от «платить нечем» до
 * «доступ ограничен», а не порядок проверок в `billingState` (у той свой,
 * см. комментарий у неё).
 */
export type BillingStateKind =
  | "not_connected"
  | "no_subscription"
  | "trial"
  | "active"
  | "awaiting_payment"
  | "grace"
  | "restricted";

export const BILLING_STATES: readonly BillingStateKind[] = [
  "not_connected",
  "no_subscription",
  "trial",
  "active",
  "awaiting_payment",
  "grace",
  "restricted",
];

/* --- Календарь ------------------------------------------------------------
 *
 * Дни считаются в UTC и из строки `YYYY-MM-DD`, а не через локальное время
 * браузера: у человека в Бангкоке и у сервера в Европе «сегодня» разное, и
 * подписка не должна кончаться на день раньше от смены часового пояса.
 */

const DAY_MS = 86_400_000;

/** Строка вида `YYYY-MM-DD` и настоящая дата. Кривая строка — не исключение,
 *  а `false`: дата приезжает от сервера, и падать на его опечатке значит
 *  показать белый экран вместо биллинга. */
export function isDay(iso: string | null | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d;
}

function ms(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function day(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function addDays(iso: string, n: number): string {
  return day(ms(iso) + n * DAY_MS);
}

/** Целых суток между днями: положительно, если `b` позже `a`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((ms(b) - ms(a)) / DAY_MS);
}

/**
 * Плюс N КАЛЕНДАРНЫХ месяцев от даты-якоря.
 *
 * Две вещи, ради которых это своя функция, а не `setMonth`:
 *
 *  1. Конец месяца зажимается. 31 января плюс месяц — это 28 (или 29)
 *     февраля, а НЕ 3 марта, как выходит у движка дат при переполнении.
 *     Человек, заплативший 31 января, не покупал три лишних дня, и биллинг,
 *     который их дарит, ошибается в свою сторону молча.
 *  2. Счёт ВСЕГДА от исходного якоря, а не от прошлого конца периода. Иначе
 *     зажим накапливается: 31 января → 28 февраля → 28 марта → 28 апреля, и
 *     к декабрю человек, платящий 31-го, оплачивает 28-е. Поэтому второй
 *     месяц считается как `addCalendarMonths(якорь, 2)`, а не как «ещё раз
 *     плюс месяц от прошлого конца».
 */
export function addCalendarMonths(anchor: string, months: number): string {
  const [y, m, d] = anchor.split("-").map(Number);
  const целевой = new Date(Date.UTC(y, m - 1 + months, 1));
  /* Последний день целевого месяца: нулевой день следующего. */
  const последний = new Date(Date.UTC(целевой.getUTCFullYear(), целевой.getUTCMonth() + 1, 0)).getUTCDate();
  return day(Date.UTC(целевой.getUTCFullYear(), целевой.getUTCMonth(), Math.min(d, последний)));
}

/** Докуда оплачен доступ после `monthsPaid` календарных месяцев от даты
 *  первой оплаты. Отдельным именем, потому что на экране это называется
 *  «paid through», и связь «якорь → срок» должна быть видна в коде. */
export function paidThroughFrom(anchor: string, monthsPaid: number): string {
  return addCalendarMonths(anchor, monthsPaid);
}

/* --- Грейс и напоминания -------------------------------------------------- */

/** Сколько суток доступ ещё живёт после конца оплаченного срока.
 *
 *  Пять — ДОПУЩЕНИЕ (ночь 15.08, спросить было не у кого): владелец
 *  потребовал грейс, но длины не назвал. Пять суток — это выходные плюс
 *  запас: перевод в крипте подтверждается сетью не мгновенно, и человек,
 *  заплативший в пятницу вечером, не должен упереться в ограничение в
 *  субботу. Правится одной строкой. */
export const GRACE_DAYS = 5;

/** Последний день, когда доступ ещё есть после конца оплаченного срока. */
export function graceEnd(paidThrough: string): string {
  return addDays(paidThrough, GRACE_DAYS);
}

/** За сколько суток до конца срока напоминать.
 *
 *  Три напоминания, а не одно: у крипты продление РУЧНОЕ — никто не спишет
 *  за человека, и единственное письмо за сутки до конца он прочтёт в
 *  отпуске послезавтра. И не десять: напоминание, которое приходит каждый
 *  день, читается как шум и перестаёт работать ровно тогда, когда нужно. */
export const REMINDER_DAYS_BEFORE: readonly number[] = [7, 3, 1];

/** Пора ли напомнить при таком остатке суток. */
export function reminderDue(daysLeft: number): boolean {
  return REMINDER_DAYS_BEFORE.includes(daysLeft);
}

/* --- Контекст ------------------------------------------------------------- */

export interface BillingContext {
  /** Ключи мерчанта есть — можно создать инвойс. СЕГОДНЯ всегда `false`. */
  merchantConfigured: boolean;
  /** Выбранный тариф или `null`, если подписки не было. */
  plan: PlanId | null;
  /** Докуда оплачен доступ, `YYYY-MM-DD` включительно. */
  paidThrough: string | null;
  /** Последний день триала включительно. */
  trialEndsAt: string | null;
  /** Инвойс выставлен, и мы ждём подтверждения сети. У крипты это НЕ
   *  «списание в процессе»: платёж делает человек, и мы про него узнаём
   *  только от провайдера. */
  invoicePending: boolean;
  /** Сегодня, `YYYY-MM-DD`. Приходит снаружи: модель не спрашивает время
   *  сама, иначе её нельзя проверить тестом, не подделав часы. */
  today: string;
}

/** Что верно СЕГОДНЯ для любого, кто откроет лист: платить нечем, потому что
 *  ключей мерчанта нет. Не «данные не пришли» — источника у остальных полей
 *  просто не существует. */
export const NOT_CONNECTED_CONTEXT: BillingContext = {
  merchantConfigured: PROVIDER.configured,
  plan: null,
  paidThrough: null,
  trialEndsAt: null,
  invoicePending: false,
  today: "1970-01-01",
};

/**
 * Состояние подписки прямо сейчас. Порядок проверок — часть модели:
 *
 *  1. Нет ключей мерчанта — `not_connected`. Перебивает всё безусловно: без
 *     провайдера ни одно из остальных состояний не могло возникнуть, а
 *     сказать «подписки нет» значило бы намекнуть, что подписаться можно.
 *  2. Оплаченный срок ещё идёт — `active`. Проверяется РАНЬШЕ триала: если
 *     человек заплатил, не дождавшись конца триала, он платящий клиент, а
 *     не пробующий, и напоминание «твой триал кончается» ему врёт.
 *  3. Триал ещё идёт — `trial`.
 *  4. Срок кончился, но грейс не вышел — `grace`. Доступ ещё есть, и это
 *     единственное окно, в котором человека можно вернуть.
 *  5. Инвойс выставлен и ждёт сети — `awaiting_payment`. Ниже грейса
 *     намеренно: пока доступ ещё живёт, важнее сказать «срок кончился, вот
 *     сколько осталось», чем «ждём сеть» — второе не про доступ.
 *  6. Что-то из этого было и кончилось — `restricted`.
 *  7. Иначе — `no_subscription`: платить есть чем, подписки не заводили.
 */
export function billingState(ctx: BillingContext): BillingStateKind {
  if (!ctx.merchantConfigured) return "not_connected";

  const сегодня = isDay(ctx.today) ? ctx.today : null;
  const оплачен = isDay(ctx.paidThrough) ? ctx.paidThrough : null;
  const триал = isDay(ctx.trialEndsAt) ? ctx.trialEndsAt : null;

  /* Без «сегодня» сроки не сравнить ни с чем. Молча считать человека
     оплаченным нельзя, молча ограничивать — тем более: это ровно тот случай,
     когда честный ответ «инвойс ждёт» или «подписки нет». */
  if (сегодня) {
    if (оплачен && daysBetween(сегодня, оплачен) >= 0) return "active";
    if (триал && daysBetween(сегодня, триал) >= 0) return "trial";
    if (оплачен && daysBetween(сегодня, graceEnd(оплачен)) >= 0) return "grace";
  }

  if (ctx.invoicePending) return "awaiting_payment";
  if (оплачен || триал) return "restricted";
  return "no_subscription";
}

/** Сколько суток осталось до конца доступа — и `null`, когда считать нечего.
 *
 *  Считается от того же факта, что и состояние: оплаченный срок, потом
 *  триал, потом грейс. Отдельной функцией, потому что число нужно и тексту
 *  напоминания, и экрану, и оно не должно вычисляться в вёрстке дважды
 *  по-разному. */
export function daysOfAccessLeft(ctx: BillingContext): number | null {
  if (!isDay(ctx.today)) return null;
  const оплачен = isDay(ctx.paidThrough) ? ctx.paidThrough : null;
  const триал = isDay(ctx.trialEndsAt) ? ctx.trialEndsAt : null;
  if (оплачен && daysBetween(ctx.today, оплачен) >= 0) return daysBetween(ctx.today, оплачен);
  if (триал && daysBetween(ctx.today, триал) >= 0) return daysBetween(ctx.today, триал);
  if (оплачен) {
    const гр = daysBetween(ctx.today, graceEnd(оплачен));
    return гр >= 0 ? гр : null;
  }
  return null;
}

/** Текст напоминания или `null`, когда напоминать не о чем.
 *
 *  Живёт в модели, а не в письме и не в вёрстке, ровно потому, что напоминать
 *  придётся в трёх местах — на листе, письмом и в телеграме, — и три
 *  разных текста про один срок расходятся в первый же месяц. */
export function renewalNotice(ctx: BillingContext): string | null {
  const state = billingState(ctx);
  const left = daysOfAccessLeft(ctx);
  if (state === "grace") {
    return left === null
      ? "The paid period is over. Access continues through the grace window, then it is limited."
      : `The paid period is over. Access continues for ${left} more ${left === 1 ? "day" : "days"}, then it is limited until a new payment arrives.`;
  }
  if ((state === "active" || state === "trial") && left !== null && reminderDue(left)) {
    const хвост =
      state === "trial"
        ? "the trial ends. Nothing is charged on its own — crypto has no auto-charge, so the first payment is yours to make."
        : "the paid period ends. Nothing renews on its own — crypto has no auto-charge, so renewing is a payment you make.";
    return `${left} ${left === 1 ? "day" : "days"} until ${хвост}`;
  }
  return null;
}

/* --- Доступ --------------------------------------------------------------- */

/** Есть ли доступ по подписке прямо сейчас.
 *
 *  `awaiting_payment` — `false` НАМЕРЕННО, и это не строгость: если доступ
 *  ещё жив, состояние было бы `active` или `grace`, потому что срок
 *  проверяется раньше. Значит «ждём платёж» наступает ровно тогда, когда
 *  предыдущий срок уже кончился, и включать доступ до подтверждения сети
 *  значит раздавать месяцы за нажатие кнопки «я оплатил».
 *
 *  Как и в прошлой версии файла, это вопрос про ПОДПИСКУ, а не про панель:
 *  сегодня панель открыта всем, и `false` здесь не значит «человека не
 *  пускают» (см. `billingAccessLine`). */
export function billingHasAccess(state: BillingStateKind): boolean {
  switch (state) {
    case "trial":
    case "active":
    case "grace":
      return true;
    case "not_connected":
    case "no_subscription":
    case "awaiting_payment":
    case "restricted":
      return false;
  }
}

/** Строка про доступ под карточкой состояния — НЕ то же самое, что
 *  `billingHasAccess`. `not_connected` особый: подписки не может быть ни у
 *  кого, продукт сегодня никого не ограничивает, и «No access.» человеку,
 *  который прямо сейчас пользуется панелью, — видимая ложь. */
export function billingAccessLine(state: BillingStateKind): string {
  if (state === "not_connected") return "Does not limit anything today.";
  if (state === "grace") return "Access continues through the grace window.";
  if (state === "restricted") return "Access is limited, not deleted.";
  return billingHasAccess(state) ? "Access continues." : "No access.";
}

/** Что именно значит «ограничен» — вместо страшного слова список фактов.
 *
 *  Владелец потребовал: доступ ОГРАНИЧИВАЕТСЯ, а не пропадает молча. Значит
 *  надо назвать, что перестаёт работать и что остаётся; без списка каждый
 *  додумает своё, и половина решит, что у них удалили цифры. Это
 *  ДОПУЩЕНИЕ по составу (владелец назвал принцип, не список) и правится
 *  здесь одним местом. */
export const RESTRICTED_KEEPS: readonly string[] = [
  "Signing in, and every number already collected stays visible.",
  "Exporting your own data, so leaving is never blocked by an unpaid invoice.",
  "Paying to turn everything back on, from this page.",
];

export const RESTRICTED_STOPS: readonly string[] = [
  "Cloud collection pauses, so new spend and funnel numbers stop arriving.",
  "Automation rules stop watching and stop pausing anything.",
  "Uploading new campaigns is off.",
];

/* --- Подписи и объяснения -------------------------------------------------- */

export type BillingTone = "warning" | "normal";

/** Предупреждение — у состояний, которые требуют действия человека или уже
 *  что-то ограничивают. Ошибки нет ни у одного: ни одно из семи не поломка. */
export function billingStateTone(state: BillingStateKind): BillingTone {
  switch (state) {
    case "not_connected":
    case "grace":
    case "restricted":
      return "warning";
    case "no_subscription":
    case "trial":
    case "active":
    case "awaiting_payment":
      return "normal";
  }
}

export function billingStateLabel(state: BillingStateKind): string {
  switch (state) {
    case "not_connected": return "Payments not connected";
    case "no_subscription": return "No subscription";
    case "trial": return "Trial";
    case "active": return "Active";
    case "awaiting_payment": return "Waiting for payment";
    case "grace": return "Grace period";
    case "restricted": return "Limited";
  }
}

/** Глоссарий листа. Тексты намеренно называют РАЗНОЕ, что делать: заплатить /
 *  подождать сеть / продлить до даты / оплатить, чтобы включить обратно. */
export function billingStateDescription(state: BillingStateKind): string {
  switch (state) {
    case "not_connected":
      return "The payment provider is chosen — crypto through Cryptomus — but its merchant keys do not exist yet, so no invoice can be created and nothing here can charge anything. This is true for every visitor right now.";
    case "no_subscription":
      return "Payment works, but this account has no subscription. Pick a plan to start one; nothing is charged until an invoice is paid.";
    case "trial":
      return "The trial is running and the product is fully open. It does not turn into a paid month on its own — crypto cannot charge you, so the first payment is a step you take.";
    case "active":
      return "The paid period is running. It does not renew on its own: crypto has no auto-charge, so a reminder comes before it ends and renewing is a payment you make.";
    case "awaiting_payment":
      return "An invoice was created and the network has not confirmed the payment yet. Access turns on when the confirmation arrives, not when the invoice is opened — otherwise a month would cost one click on «I paid».";
    case "grace":
      return "The paid period is over, but access has not been limited yet: there is a short window to pay before it is. Nothing was taken away, and nothing will be without saying so first.";
    case "restricted":
      return "The period and the grace window are both over, so access is limited: collection is paused and rules are off. Nothing is deleted, and paying turns it all back on.";
  }
}

/* --- Инвойс --------------------------------------------------------------- */

/** Шаги, из которых состоит оплата криптой. Написаны здесь, потому что экран
 *  ожидания обязан показывать их ДО того, как ключи появятся: человек должен
 *  понимать, за чем он будет наблюдать, и почему деньги не зачисляются в ту
 *  же секунду. */
export interface InvoiceStep {
  id: string;
  title: string;
  description: string;
}

export const INVOICE_STEPS: readonly InvoiceStep[] = [
  {
    id: "create",
    title: "The invoice is created",
    description:
      "The provider issues an address and an amount for the chosen plan, and holds them for a limited time — the rate is fixed at that moment.",
  },
  {
    id: "pay",
    title: "You send the payment",
    description:
      "From any wallet, in one of the supported coins. Nothing is bound to this panel and nothing can be charged later without you.",
  },
  {
    id: "confirm",
    title: "The network confirms it",
    description:
      "Confirmation takes minutes, not seconds, and this is the part nobody controls. The page waits for the provider to say the payment landed.",
  },
  {
    id: "extend",
    title: "The period is extended",
    description:
      "A calendar month is added from the payment date. There is no auto-renewal after it: the next month is another payment you make.",
  },
];

/** Можно ли создать инвойс прямо сейчас, и если нет — почему. Одно место, из
 *  которого лист берёт и решение, и объяснение: иначе кнопка однажды станет
 *  активной, а текст рядом продолжит говорить, что оплата не подключена. */
export function invoiceReady(provider: Provider = PROVIDER): { ready: boolean; why: string } {
  return provider.configured ? { ready: true, why: "" } : { ready: false, why: provider.why };
}

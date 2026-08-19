/**
 * Тарифы и пробные периоды (иссус #128).
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ ОТ `@/lib/billing`. Там — состояния подписки и срок:
 * машина, которая одинаково работает при любой сетке цен. Здесь — сама
 * сетка: предложение владельцу, которое он правит одной строкой и которое
 * протухает раньше всего остального в этой папке. Смешать их значит каждый
 * раз при смене цены лезть в файл, где живёт логика доступа.
 *
 * ЦЕНЫ ЗДЕСЬ — ПРЕДЛОЖЕНИЕ, А НЕ РЕШЕНИЕ ВЛАДЕЛЬЦА. Он назвал их устно как
 * стартовую точку (ночь 15.08), и до его «да» это черновик. Поэтому число
 * лежит ровно в одном месте — `priceUsdMonthly` ниже, — и ни в модели
 * состояний, ни в вёрстке листа второго числа нет: тест это держит. Так
 * правка цены остаётся правкой одной строки, а не поиском по репозиторию.
 *
 * ПОЧЕМУ У ФИЧИ ЕСТЬ ПРИЗНАК `built`. Половина того, что тариф обещает
 * (трекеры, CRM, медиатека), в продукте ещё не написана — ровно это же
 * сказано на `/profile` в строках `not_wired` (`@/lib/profile`). Продать
 * человеку строку списка, за которой ничего нет, — обман, который вскроется
 * в первый же день пользования. Поэтому такие пункты не выкидываются из
 * тарифа (владелец их назвал), а помечаются и на экране видны как «ещё не
 * готово».
 */

export type PlanId = "solo" | "pro" | "team";

export interface PlanFeature {
  text: string;
  /** Написано ли это в продукте СЕГОДНЯ. `false` — пункт тарифа, за которым
   *  пока нет кода; на экране он подписан прямо, а не спрятан. */
  built: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Доллары в месяц. Единственное место в репозитории, где живёт цена. */
  priceUsdMonthly: number;
  /** Одной фразой — кому этот тариф. */
  tagline: string;
  /** Сколько соцев можно подключить. `null` — «сколько нужно команде». */
  socials: number | null;
  features: readonly PlanFeature[];
  /** Чего в тарифе НЕТ. Показывается наравне с тем, что есть: человек,
   *  который узнаёт про потолок после оплаты, считает себя обманутым. */
  missing: readonly string[];
}

export const PLANS: readonly Plan[] = [
  {
    id: "solo",
    name: "Solo",
    priceUsdMonthly: 19,
    tagline: "One person, one social profile, own numbers.",
    socials: 1,
    features: [
      { text: "One social profile connected through the Obelista app", built: true },
      { text: "Analytics: spend and funnel by source creative, with the creative tree", built: true },
      { text: "Uploading campaigns from a spec, with placements checked before Meta sees them", built: true },
      { text: "Cloud collection: numbers keep arriving while your own machine is off", built: true },
    ],
    missing: ["Automation rules", "Team members and invites", "Tracker and CRM integrations"],
  },
  {
    id: "pro",
    name: "Pro",
    priceUsdMonthly: 39,
    tagline: "A buyer running a fleet: several profiles and rules that watch them.",
    socials: 5,
    features: [
      { text: "Up to five social profiles", built: true },
      { text: "Everything in Solo: analytics, creative tree, uploading, cloud collection", built: true },
      { text: "Automation rules: a metric crosses a threshold, the ad set is paused without you", built: true },
      { text: "Tracker integration: registrations and deposits counted by the tracker, not guessed", built: false },
      { text: "CRM integration: contact and deposit statuses next to the creative that brought them", built: false },
    ],
    missing: ["Team members and invites", "Shared media library"],
  },
  {
    id: "team",
    name: "Team",
    priceUsdMonthly: 49,
    tagline: "Several people in one workspace with a shared library.",
    socials: null,
    features: [
      { text: "As many social profiles as the team needs", built: true },
      { text: "Everything in Pro, including automation rules", built: true },
      { text: "Team members: invite by link, each with their own sign-in", built: true },
      { text: "All integrations, trackers and CRM included", built: false },
      { text: "Shared media library: creatives uploaded once, used by everyone", built: false },
    ],
    missing: [],
  },
];

export function planById(id: PlanId): Plan {
  const p = PLANS.find((x) => x.id === id);
  /* Не `?? PLANS[0]`: молчаливая подмена тарифа — это молчаливая подмена
     цены. Пусть падает здесь, а не показывает человеку чужие деньги. */
  if (!p) throw new Error(`неизвестный тариф: ${id}`);
  return p;
}

/** Цена строкой. Формат живёт ЗДЕСЬ же, рядом с числом, и по той же причине:
 *  «$19» и «19 USD/mo» на двух экранах — это два решения о цене, принятых в
 *  разных файлах. Вёрстка листа зовёт эту функцию и не знает ни числа, ни
 *  валюты. */
export function planPriceLine(plan: Plan): string {
  return `$${plan.priceUsdMonthly} / month`;
}

/** Сколько соцев словами — «5» и «as many as you need» в одной колонке
 *  таблицы не уживаются, а `null` в вёрстке превращается в пустую клетку. */
export function planSocialsLine(plan: Plan): string {
  if (plan.socials === null) return "As many as the team needs";
  return plan.socials === 1 ? "One social profile" : `Up to ${plan.socials} social profiles`;
}

/* --- Пробные периоды ------------------------------------------------------
 *
 * Их ДВА, и они разные не по щедрости, а по механике оплаты. Карта умеет
 * автосписание — значит триал можно дать длинный, привязав карту и списав в
 * конце. Крипта автосписания не умеет вовсе (см. `@/lib/billing`), привязать
 * нечего, и длинный триал без предоплаты — это просто бесплатный месяц для
 * любого, кто заводит новую почту.
 */

export type TrialId = "card" | "crypto";

export interface Trial {
  id: TrialId;
  days: number;
  title: string;
  /** Что человек отдаёт на входе. */
  requires: string;
  /** Чем кончается триал сам по себе. */
  ending: string;
  /** Можно ли им воспользоваться СЕГОДНЯ. */
  available: boolean;
  /** Почему нельзя — пусто, когда можно. */
  why: string;
}

/** Карточный триал длиннее и с привязкой; криптовый короче и без предоплаты.
 *  Оба сегодня недоступны, но по РАЗНЫМ причинам, и на экране это должно
 *  читаться как две разные причины, а не одна общая «пока нельзя». */
export const TRIALS: readonly Trial[] = [
  {
    id: "card",
    days: 14,
    title: "Card trial",
    requires: "A card bound up front",
    ending: "The first month is charged automatically when the trial ends, unless it was cancelled before.",
    available: false,
    why:
      "Cards go through Stripe, and Stripe needs a legal entity. There is none yet — the paperwork waits until it is clear whether the product flies. This is a deliberate postponement, not an unfinished screen.",
  },
  {
    id: "crypto",
    days: 5,
    title: "Crypto trial",
    requires: "Nothing up front — no prepayment, no binding",
    ending: "Access is limited when the trial ends, until the first invoice is paid. Nothing is charged on its own: crypto has no auto-charge.",
    available: false,
    why:
      "Crypto payments go through Cryptomus, and there is no merchant account and no keys yet. Until they exist, no invoice can be created — so a trial that ends in an invoice cannot be started honestly either.",
  },
];

export function trialById(id: TrialId): Trial {
  const t = TRIALS.find((x) => x.id === id);
  if (!t) throw new Error(`неизвестный триал: ${id}`);
  return t;
}

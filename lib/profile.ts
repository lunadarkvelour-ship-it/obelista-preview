/**
 * Профиль человека — модель листа `/profile` (иссус #127).
 *
 * ЧТО ЭТО ЗА МЕСТО. Не «настройки панели» и не «список кабов»: это лист про
 * САМОГО ЧЕЛОВЕКА — кто он в этом воркспейсе, что у него уже подключено, чем
 * с ним связаться, и двери в соседние листы (`/billing`, `/settings`).
 *
 * ГРАНИЦА С #88. Там карточка «Referral coupon» и пункт меню `billing` жили в
 * листе аккаунта; ветка не влита, `components/views/AccountView.tsx` в `main`
 * не существует. Значит купон и дверь в биллинг переезжают СЮДА и живут
 * ровно в одном месте — делать их дважды владелец запретил прямо в #127.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Ни одного fetch и ни одного DOM: модель чистая, как у
 * соседей (`@/lib/billing`, `@/lib/rules`), и проверяется тестом в одиночку.
 * Лист (`components/views/ProfileView.tsx`) сам ходит за данными и передаёт
 * их сюда фактами, а не наоборот.
 *
 * ГЛАВНОЕ ЧЕСТНОЕ МЕСТО ФАЙЛА. Сервер профиля не существует: в `panel/app/api`
 * только `fb` и `snapshot`, у демона ручек `/profile*` нет ни одной, и бэкенд
 * этой задачей не трогается намеренно. Поэтому дозаполненный профиль здесь
 * НИКУДА НЕ УЕЗЖАЕТ — он лежит черновиком в этом браузере, и лист обязан
 * сказать это словами. Черновик — не «сохранение с задержкой»: на другой
 * машине его не будет, и обещать обратное значило бы соврать ровно тем
 * способом, который в этой панели запрещён (см. `PROFILE_DRAFT_NOTICE`).
 */

/* --- Поля профиля ---------------------------------------------------------
 *
 * Ровно то, что владелец назвал в #127: имя, соцсети, контакты. Ни одного
 * поля «оплата», «карта», «кошелёк» — деньги живут на `/billing` и в этот
 * файл не заглядывают.
 */

export type ProfileFieldId =
  | "display_name"
  | "telegram"
  | "contact_email"
  | "site"
  | "facebook"
  | "instagram";

/** Вид поля решает, как его проверять и как показывать. Строкой, а не
 *  булевыми флажками: флажков было бы три штуки на одно поле. */
export type ProfileFieldKind = "text" | "email" | "telegram" | "url";

export interface ProfileField {
  id: ProfileFieldId;
  kind: ProfileFieldKind;
  /** Подпись поля на экране. */
  label: string;
  /** Зачем это поле нам и человеку — одной фразой под полем. Пустых подсказок
   *  не бывает: поле без объяснения человек пропускает. */
  hint: string;
  placeholder: string;
}

export const PROFILE_FIELDS: readonly ProfileField[] = [
  {
    id: "display_name",
    kind: "text",
    label: "Display name",
    hint: "How you are addressed in the panel and in letters. Not a login — signing in stays by email.",
    placeholder: "Ivan",
  },
  {
    id: "contact_email",
    kind: "email",
    label: "Contact email",
    hint: "Where product letters go. Can differ from the address you sign in with.",
    placeholder: "you@example.com",
  },
  {
    id: "telegram",
    kind: "telegram",
    label: "Telegram",
    hint: "The fastest way to reach you, and the same handle a referral payout is arranged through.",
    placeholder: "@handle",
  },
  {
    id: "site",
    kind: "url",
    label: "Website",
    hint: "Your own site or landing page, if there is one.",
    placeholder: "https://example.com",
  },
  {
    id: "facebook",
    kind: "url",
    label: "Facebook",
    hint: "Your personal page. This is not an ad profile — those live on Profiles.",
    placeholder: "https://facebook.com/…",
  },
  {
    id: "instagram",
    kind: "url",
    label: "Instagram",
    hint: "Your personal page, same as above.",
    placeholder: "https://instagram.com/…",
  },
];

/** Значения полей. Частичная запись намеренно: незаполненное поле — это
 *  ОТСУТСТВИЕ значения, а не пустая строка. Разница видна в подсчёте
 *  заполненности ниже и в том, что пустую строку не нужно валидировать. */
export type ProfileValues = Partial<Record<ProfileFieldId, string>>;

/* --- Проверка значений ----------------------------------------------------
 *
 * Проверяем ровно то, что можем проверить не выходя из браузера: форму
 * записи. Существование телеграм-хендла или живость сайта отсюда не
 * проверяются и не изображаются проверенными.
 */

/** Телеграм в одну форму: `@handle`. На вход принимаем и `t.me/handle`, и
 *  ссылку целиком, и голый хендл — человек копирует откуда придётся, и
 *  ругаться на это вместо нормализации значит заставлять его чинить строку
 *  руками. */
export function normalizeTelegram(raw: string): string {
  const s = raw.trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?t(elegram)?\.me\//i, "");
  const handle = s.replace(/^@/, "").trim();
  return handle ? "@" + handle : "";
}

const TELEGRAM_HANDLE = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** Почта проверяется грубо и намеренно: единственная настоящая проверка
 *  почты — письмо на неё, а сложная регулярка отвергает живые адреса и учит
 *  человека, что панель придирается. Здесь ловится только заведомо не адрес:
 *  без «собаки», без домена, с пробелом внутри. */
export function looksLikeEmail(raw: string): boolean {
  const s = raw.trim();
  if (/\s/.test(s)) return false;
  const m = s.match(/^[^@]+@([^@]+)$/);
  return !!m && m[1].includes(".") && !m[1].startsWith(".") && !m[1].endsWith(".");
}

/** Ссылка приводится к виду со схемой: человек пишет `example.com`, а в
 *  `href` такой адрес браузер прочтёт как ОТНОСИТЕЛЬНЫЙ путь панели и уведёт
 *  на `/accounts/example.com`. Дописываем `https://` сами, а не отвергаем. */
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : "https://" + s;
}

export function looksLikeUrl(raw: string): boolean {
  const s = normalizeUrl(raw);
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Ошибка поля или `null`. Пустое поле ошибкой НЕ считается: профиль
 *  дозаполняется по желанию, обязательных полей в нём нет ни одного —
 *  войти человек уже смог, и требовать от него телеграм задним числом
 *  значит поставить забор посреди работающего продукта. */
export function profileFieldError(kind: ProfileFieldKind, raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  switch (kind) {
    case "text":
      return s.length > 64 ? "Too long — 64 characters at most." : null;
    case "email":
      return looksLikeEmail(s) ? null : "This does not look like an email address.";
    case "telegram":
      return TELEGRAM_HANDLE.test(normalizeTelegram(s))
        ? null
        : "A Telegram handle is 5–32 characters: letters, digits and underscore.";
    case "url":
      return looksLikeUrl(s) ? null : "This does not look like a link.";
  }
}

/** Значение в том виде, в каком его стоит хранить и показывать. */
export function normalizeProfileValue(kind: ProfileFieldKind, raw: string): string {
  switch (kind) {
    case "telegram":
      return normalizeTelegram(raw);
    case "url":
      return normalizeUrl(raw);
    default:
      return raw.trim();
  }
}

/** Насколько профиль дозаполнен. Считаем ЗАПОЛНЕННЫЕ поля, а не «проценты
 *  готовности человека»: число тут нужно ровно для одной фразы «3 of 6», и
 *  придумывать вес полей значило бы придумывать, что важнее — сайт или
 *  инстаграм. Такого решения владелец не принимал. */
export function profileFilled(values: ProfileValues): number {
  return PROFILE_FIELDS.filter((f) => (values[f.id] || "").trim().length > 0).length;
}

/* --- Черновик в браузере --------------------------------------------------
 *
 * Единственное место, где дозаполненный профиль сегодня может лежать. Ключ и
 * чтение/запись — здесь, чтобы «где лежит черновик» было одним фактом кода, а
 * не строкой, продублированной в компоненте.
 */

export const PROFILE_DRAFT_KEY = "obelista.profile.draft";

/** Что лист обязан сказать над формой. Не «сохранено», не «синхронизируется»
 *  — ровно то, что происходит на самом деле. */
export const PROFILE_DRAFT_NOTICE =
  "There is no profile endpoint on the server yet, so nothing here is sent anywhere. What you fill in is kept in this browser only — another machine, another browser or cleared site data means an empty form again.";

/** Минимум от `Storage`, который нам нужен. Свой интерфейс вместо `Storage`,
 *  чтобы тест подсовывал обычный объект, а не изображал браузер. */
export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Черновик из хранилища. Мусор в ключе — это `{}`, а не исключение:
 *  испорченный черновик не повод уронить лист, который и без него работает. */
export function readProfileDraft(store: DraftStore | null | undefined): ProfileValues {
  if (!store) return {};
  let raw: string | null = null;
  try {
    raw = store.getItem(PROFILE_DRAFT_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out: ProfileValues = {};
    for (const f of PROFILE_FIELDS) {
      const v = (data as Record<string, unknown>)[f.id];
      if (typeof v === "string" && v.trim()) out[f.id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeProfileDraft(store: DraftStore | null | undefined, values: ProfileValues): void {
  if (!store) return;
  const out: ProfileValues = {};
  for (const f of PROFILE_FIELDS) {
    const v = (values[f.id] || "").trim();
    if (v) out[f.id] = v;
  }
  try {
    store.setItem(PROFILE_DRAFT_KEY, JSON.stringify(out));
  } catch {
    /* Приватный режим и переполненное хранилище бросают. Черновик — не то,
       ради чего стоит показывать человеку красную плашку. */
  }
}

/* --- Кто вошёл ------------------------------------------------------------
 *
 * НАЙДЕНО РЕВИЗИЕЙ, А НЕ ПРИДУМАНО. Задача просила начать с того, что бэкенд
 * уже отдаёт и нигде не показано — так мы однажды потеряли ключ приёма воронки
 * (ручка отдавала настоящий ключ, а `grep funnel_key` по всей панели давал
 * НОЛЬ, и владелец трижды спрашивал, куда его вставлять). Тем же способом
 * нашлись две вещи:
 *
 *   • `/auth/me` отдаёт `expires_at` — срок сессии. `lib/auth` его разбирает,
 *     а на экранах панели его не показывает НИКТО. Человеку неоткуда узнать,
 *     когда его выкинет и не оставил ли он себя вошедшим на чужой машине.
 *
 *   • `/auth/me` отдаёт `gate: false` вместе с `user: null` и `note` там, где
 *     входа на установке нет вовсе (локальная база без единой учётки). Панель
 *     это поле не разбирала, ответ приезжал общим `ok: false`, и лист профиля
 *     ВЕЧНО показывал «Asking the server who is signed in…». Сервер отвечал
 *     сразу и внятно — ответ было некуда положить.
 *
 * Отсюда четыре состояния вместо двух, и каждое лечится по-своему: подождать,
 * войти, завести первую учётку, поднять демона.
 */

export type WhoState =
  /** Спросили и ждём ответа. Единственное состояние, которое проходит само. */
  | "asking"
  /** Сервер назвал человека. */
  | "signed_in"
  /** Входа на этой установке нет вовсе: спрашивать некого. */
  | "no_gate"
  /** Гейт есть, но нас не пустили: сессия кончилась или её не было. */
  | "signed_out"
  /** Спросить не удалось — демон выключен или сеть. */
  | "unreachable";

export interface Who {
  state: WhoState;
  /** Заголовок листа: имя, почта или честная строка про состояние. */
  title: string;
  /** Вторая строка: подробность или объяснение. */
  detail: string;
}

/** Что показать в шапке профиля.
 *
 *  `ответ` — то, что вернул `auth.me()`; `null` — ещё не отвечал. `сломалось`
 *  — запрос вообще не доехал (исключение), и это НЕ «не вошёл»: неотличимые на
 *  экране, они лечатся по-разному — там войти, здесь поднять демона.
 */
export function ктоВошёл(
  ответ: WhoAnswer | null,
  сломалось = false,
): Who {
  if (сломалось) {
    return {
      state: "unreachable",
      title: "Profile",
      detail: "Could not ask the server who is signed in. Nothing is wrong with your "
        + "account — the panel could not reach the collector.",
    };
  }
  if (!ответ) {
    return { state: "asking", title: "Profile", detail: "Asking the server who is signed in…" };
  }
  if (ответ.ok) {
    return {
      state: "signed_in",
      title: ответ.user.name || ответ.user.email,
      detail: ответ.user.email,
    };
  }
  /* `gate === false` — это ответ, а не отказ. Сравнение строгое: `undefined`
     значит «демон старше контракта», и выдать за него «входа нет» значило бы
     сказать человеку, что защиты не существует, ничего про неё не зная. */
  if (ответ.gate === false) {
    return {
      state: "no_gate",
      title: "No sign-in on this installation",
      detail: ответ.note
        ? ответ.note
        : "This installation does not ask for a login at all, so there is no account to show.",
    };
  }
  return {
    state: "signed_out",
    title: "Not signed in",
    detail: "The server did not recognise this browser. Signing in again brings the "
      + "profile back.",
  };
}

/** Ровно то, что нужно `ктоВошёл` от `auth.me()`. Отдельным типом, чтобы модель
 *  не зависела от клиентского модуля целиком и проверялась без сети. */
export type WhoAnswer =
  | { ok: true; user: { email: string; name: string; ws: number }; expiresAt?: string | null }
  | { ok: false; gate?: boolean; note?: string };

/* --- Срок сессии ---------------------------------------------------------- */

/** Сколько сессия ещё живёт, словами. `null` — сказать нечего.
 *
 *  СРОК СКОЛЬЗЯЩИЙ, и молчать об этом нельзя: гейт продлевает его при каждом
 *  обращении панели (`core/auth._продлить`, не чаще раза в час), поэтому
 *  «до 14 сентября» у работающего человека почти всегда означает «тридцать дней
 *  от последнего захода», а не приближающийся конец. Без этой оговорки дата
 *  читается как обратный отсчёт и пугает на ровном месте.
 *
 *  Просроченную дату не прячем: сессия могла кончиться в соседней вкладке, и
 *  честная строка объясняет, почему панель вдруг начала отказывать. */
export function сессияДо(iso?: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const день = new Date(t).toISOString().slice(0, 10);
  if (t <= now) {
    return `This browser's session expired on ${день}. Signing in again starts a new one.`;
  }
  const дней = Math.round((t - now) / 86_400_000);
  return `Signed in on this browser until ${день} (${дней} day${дней === 1 ? "" : "s"}). `
    + "The clock restarts every time you use the panel.";
}

/* --- Интеграции -----------------------------------------------------------
 *
 * «Меню с АКТУАЛЬНЫМИ интеграциями» из #127. Ключевое слово — актуальными:
 * строка про то, что подключено, обязана приезжать из живого источника, а не
 * из списка в этом файле. Поэтому здесь только СБОРКА строк из фактов,
 * которые лист принёс с сервера.
 */

/** Три состояния, и третье — главное честное.
 *
 *  `connected` / `none` — про подключение, которое существует и у которого
 *  есть ответ «да» или «нет». `not_wired` — про интеграцию, которой в
 *  продукте ещё нет ни в каком виде: нажать нечего, спрашивать сервер не о
 *  чем. Показывать такую строку как «не подключено» было бы обещанием, что
 *  подключить МОЖНО, — той же неправдой, что «подписки нет» на листе, где
 *  оплата ещё не подключена (`not_connected` в `@/lib/billing`). */
export type IntegrationStatus = "connected" | "none" | "not_wired";

export interface IntegrationRow {
  id: string;
  title: string;
  /** Что это даёт человеку — словами, а не названием протокола. */
  description: string;
  status: IntegrationStatus;
  /** Строка состояния: «3 of 7 connected», «not connected», «not built yet». */
  detail: string;
  /** Куда идти управлять. `null` у `not_wired` всегда: вести некуда. */
  href: string | null;
}

/** Факты, которые лист приносит с сервера. `null` значит «спросить не
 *  удалось» — отдельно от нуля: ноль подключённых соцев и упавший запрос
 *  выглядят на экране одинаково, если их не разделить здесь. */
export interface IntegrationFacts {
  /** Сколько соцев подключено и сколько всего известно панели. */
  socials: { connected: number; total: number } | null;
  /** Номер воркспейса из `/auth/me`. `null` — не спросили или не вошли. */
  ws: number | null;
}

/** Строки меню интеграций.
 *
 *  Первые две — настоящие, из живых ручек.
 *
 *  ТРЕКЕРОВ, CRM И АНТИДЕТЕКТА ЗДЕСЬ НЕТ НАМЕРЕННО, хотя тарифы на
 *  `/billing` их обещают. Им посвящён отдельный лист `/integrations` (#126,
 *  `@/lib/integrations`), и он знает про каждого вендора то, чего профиль
 *  знать не может: настроен ли он, отвечает ли, чего не хватает для
 *  подключения. Второй список тех же подключений в профиле — это второй
 *  ответ на один вопрос, и расходиться они начнут в первый же день. Дорога
 *  туда есть, и она в дверях ниже (`PROFILE_DOORS`), а не строкой-двойником
 *  здесь.
 *
 *  Медиатека остаётся: её нет ни в одном листе, и молчать о ней после того,
 *  как её пообещал тариф, значит отправить человека искать несуществующую
 *  кнопку. */
export function integrationRows(facts: IntegrationFacts): IntegrationRow[] {
  const s = facts.socials;
  return [
    {
      id: "meta_profiles",
      title: "Meta profiles",
      description:
        "Facebook profiles connected through the Obelista app: ad accounts, pages and Instagram come from them.",
      status: s && s.connected > 0 ? "connected" : s ? "none" : "none",
      detail: s
        ? s.connected > 0
          ? `${s.connected} of ${s.total} connected`
          : s.total > 0
            ? `none of ${s.total} connected`
            : "nothing connected yet"
        : "could not ask the server",
      href: "/socials",
    },
    {
      id: "workspace",
      title: "Workspace",
      description:
        "Your own space: ad accounts, creatives and numbers live in it and are not visible to anyone else.",
      status: facts.ws === null ? "none" : "connected",
      detail: facts.ws === null ? "not signed in" : `workspace #${facts.ws}`,
      href: "/accounts",
    },
    {
      id: "media_library",
      title: "Media library",
      description: "Shared storage for creatives so a team uploads from one place instead of each own folder.",
      status: "not_wired",
      detail: "not built yet",
      href: null,
    },
  ];
}

/* --- Двери --------------------------------------------------------------
 *
 * #127 просит из профиля переход в `/billing` и `/settings`. Первый лист
 * существует, второго нет ни в каком виде — каталога `panel/app/settings`
 * в дереве нет.
 */

export interface Door {
  id: string;
  title: string;
  description: string;
  /** `null` — листа ещё нет. Ссылка в никуда хуже её отсутствия: она врёт
   *  про то, что у панели есть, и ловится тестом ниже по файловой системе,
   *  ровно как в `leaves.test.ts`. */
  href: string | null;
  /** Почему двери нет — показывается вместо ссылки. */
  missingWhy?: string;
}

export const PROFILE_DOORS: readonly Door[] = [
  {
    id: "integrations",
    title: "Integrations",
    description:
      "Trackers and CRM: what is configured, what is not answering, and what each one asks for.",
    href: "/integrations",
  },
  {
    id: "billing",
    title: "Billing",
    description: "Plans, what each one turns on, and how long the current period runs.",
    href: "/billing",
  },
  {
    id: "settings",
    title: "Settings",
    description: "Panel settings: appearance, notifications, data.",
    href: null,
    missingWhy:
      "There is no settings page yet — this door opens once one exists. It is not linked to an empty screen in the meantime.",
  },
];

/* --- Реферальный купон (#129) --------------------------------------------
 *
 * Владелец назвал условия дословно, и они СОСТАВНЫЕ. Записаны здесь, потому
 * что человек, создающий купон, обязан прочитать их ДО, а не узнать при
 * отказе в выплате.
 */

export const REFERRAL_TERMS: readonly string[] = [
  "The person you bring connects at least three social profiles through OAuth.",
  "They use the product for fourteen days without a break.",
  "They pass the anti-fraud check: one person — one workspace — one card or wallet.",
];

/** Что человек получает. Одна строка, правится одной строкой — как и цены на
 *  `/billing`. */
export const REFERRAL_REWARD =
  "A one-off payout of 20% of the referred client's first subscription payment, arranged through Telegram @obelista.";

/** Может ли купон быть выдан прямо сейчас.
 *
 *  Единственный вход — есть ли сервер, который свяжет приведённого с
 *  приводящим. Купон без такой связи это просто строка символов: он никого
 *  ни к кому не привяжет, а выглядеть будет как рабочий. Поэтому кнопка на
 *  листе не «пока не работает», а честно объясняет, чего нет. */
export interface ReferralState {
  canIssue: boolean;
  why: string;
}

export function referralState(serverReady: boolean): ReferralState {
  if (!serverReady) {
    return {
      canIssue: false,
      why:
        "A coupon is issued by the server: it is what ties the person who came to the person who brought them. That endpoint does not exist yet, so nothing here can create a real code — and a code that ties nobody to nobody would look exactly like a working one.",
    };
  }
  return { canIssue: true, why: "" };
}

/** Сегодня сервера купонов нет ни в каком виде — как `NO_PROVIDER_CONTEXT` у
 *  биллинга, один факт в одном месте вместо литерала `false` по компоненту. */
export const REFERRAL_SERVER_READY = false;

/**
 * Подключения — модель контракта листа `/integrations` (иссус #126).
 *
 * Лист про то, откуда приезжает воронка: трекеры, CRM и источник, который
 * присылает её из браузера. Подключение любого из них описывается ОДНИМ
 * объектом `Vendor` и рисуется одной карточкой. Прибить карточку к имени
 * вендора нельзя ни разу: спека §1 обещает тройку трекеров и больше, и девять
 * мест, которые придётся переписать на четвёртом, — это ровно та беда, ради
 * которой заведён `core/antidetect.py` (иссус #26).
 *
 * ЧЕСТНОСТЬ ЗДЕСЬ — НЕ ВЕЖЛИВОСТЬ, А ПРЕДМЕТ РАБОТЫ. Живых подключений к
 * большинству этих трекеров нет: у половины нет даже адаптера в движке, а у
 * панели нет НИ ОДНОЙ ручки, куда сохранить адрес и ключ (`panel/app/api` —
 * это `fb` и `snapshot`, больше там ничего). Карточка, которая выглядит
 * рабочей и ничего не делает, хуже отсутствующей: человек вводит ключ,
 * получает зелёную галочку и ждёт воронку, которой неоткуда взяться.
 * Поэтому здесь нет ни одного поля ввода — есть перечень того, что вендор
 * спросит, и явный список того, чего для подключения не хватает СЕГОДНЯ
 * (`missingToConnect`).
 *
 * Модель отделена от вида по образцу `@/lib/rules` и `@/lib/billing`:
 * компонент только читает её и не решает заново, чем «не отвечает»
 * отличается от «не настроено». Чистые функции, ни сети, ни DOM.
 */

/* --- Состояние подключения -------------------------------------------------
 *
 * Три состояния, и третье обязано существовать ОТДЕЛЬНО от второго. «Не
 * отвечает» и «не настроено» — разные беды, и чинит их человек по-разному:
 * первое — поднять трекер, продлить ключ, разобраться с сетью; второе —
 * впервые сходить за ключом в чужую панель. Слить их в одно «не работает»
 * значит на каждой поломке начинать с вопроса, а был ли вообще ключ.
 */

export type ConnStateKind = "not_configured" | "connected" | "unreachable";

/** Канонический порядок трёх состояний: и глоссарий листа, и тест ходят по
 *  нему, а не по порядку в JSX. */
export const CONN_STATES: readonly ConnStateKind[] = [
  "not_configured",
  "connected",
  "unreachable",
];

/** Тон для цвета. Отдельный тип от состояния нарочно: раскраска — решение
 *  вида, и один источник правды здесь лучше россыпи `if` по компоненту. */
export type ConnTone = "muted" | "ok" | "error";

export function connStateTone(state: ConnStateKind): ConnTone {
  switch (state) {
    // Не настроено — не поломка: у нового человека не настроено ВСЁ, и
    // красный экран на первом открытии панели не сообщает ему ничего.
    case "not_configured": return "muted";
    case "connected": return "ok";
    case "unreachable": return "error";
  }
}

export function connStateLabel(state: ConnStateKind): string {
  switch (state) {
    case "not_configured": return "Not connected";
    case "connected": return "Connected";
    case "unreachable": return "Connected, not responding";
  }
}

/* Расшифровки трёх состояний ЗДЕСЬ БОЛЬШЕ НЕТ (#157). Она жила глоссарием
 * внизу листа и объясняла словами то, что написано на пилюле: «Not connected»
 * не нуждается в абзаце. Различие «не отвечает» / «не настроено» от этого не
 * пропало — оно держится тем, ради чего заведено: разными подписями, разными
 * тонами и разной строкой `connCheckLine`, и всё три проверены тестами. */

/** Последняя проверка связи. `ok: false` — не «ошибка вообще», а именно
 *  «сходили и не получили годного ответа»; причину несёт `reason` словами
 *  того, кто отвечал, а не нашим общим «ошибка». */
export interface ConnCheck {
  at: string;
  ok: boolean;
  reason?: string;
}

export interface ConnContext {
  /** Настройки вендора лежат на сервере (адрес, ключ — всё, что он просит).
   *  Сегодня `false` у всех: хранить их физически негде. */
  configured: boolean;
  lastCheck?: ConnCheck;
}

/**
 * Состояние подключения прямо сейчас.
 *
 * Порядок проверок — это и есть модель. Сначала «есть ли что проверять»:
 * без сохранённых настроек ходить некуда, и любой провал проверки в этом
 * случае был бы провалом нашего собственного пустого запроса, а не чужого
 * трекера.
 */
export function connState(ctx: ConnContext): ConnStateKind {
  if (!ctx.configured) return "not_configured";
  if (ctx.lastCheck && !ctx.lastCheck.ok) return "unreachable";
  return "connected";
}

/**
 * Строка под состоянием: когда проверяли и чем кончилось.
 *
 * ПОЧЕМУ ЭТО СТРОКА, А НЕ ЧЕТВЁРТОЕ СОСТОЯНИЕ. «Настройки сохранены, но ни
 * разу не проверены» — это правда, и молчать о ней нельзя. Но покрасить её
 * красным «не отвечает» значит соврать в другую сторону: свежесохранённый
 * трекер получил бы тревогу на ровном месте, а ложная тревога учит выключать
 * сторожа — та же мысль записана в шапке сторожа мёртвого вендора в
 * `lib/__tests__/`. Состояний остаётся три, как договорено, а неуверенность
 * живёт текстом рядом с ними.
 */
export function connCheckLine(ctx: ConnContext): string {
  if (!ctx.configured) return "Nothing stored yet.";
  if (!ctx.lastCheck) return "Stored, never checked — the panel has not confirmed it answers.";
  if (ctx.lastCheck.ok) return `Answered on the last check, ${ctx.lastCheck.at}.`;
  return `Last check failed, ${ctx.lastCheck.at}: ${ctx.lastCheck.reason || "no reason was returned."}`;
}

/* --- Воронка ---------------------------------------------------------------
 *
 * Канон движка — `core/sources/base.py:CANON`. Порядок и имена совпадают с
 * ним намеренно: подпись на экране обязана называться так же, как колонка в
 * `funnel_daily`, иначе разговор «у тебя РД, а у меня repeat» стоит часа на
 * каждой сверке.
 */

export type FunnelStep = "sub" | "contact" | "checkout" | "ftd" | "rd" | "revenue";

export const FUNNEL_STEPS: readonly FunnelStep[] = [
  "sub", "contact", "checkout", "ftd", "rd", "revenue",
];

export const FUNNEL_LABEL: Record<FunnelStep, string> = {
  sub: "subscription",
  contact: "contact",
  checkout: "checkout",
  ftd: "first deposit",
  rd: "repeat deposit",
  revenue: "revenue",
};

/** Чего вендор НЕ отдаёт — из того, что отдаёт. Считается, а не пишется
 *  руками во втором списке: два списка расходятся, один — нет.
 *
 *  Молчаливый ноль хуже отсутствия (иссус #24, пункт 2): шаг, которого у
 *  трекера нет, обязан выглядеть на экране прочерком, а не честным нулём. */
export function funnelMissing(gives: readonly FunnelStep[]): FunnelStep[] {
  return FUNNEL_STEPS.filter((s) => !gives.includes(s));
}

/* --- Чем сшивается с нашими данными --------------------------------------- */

/** `core/sources/base.py:join_by`. keine отдаёт имя объявления, Keitaro и
 *  Binom — subid из url_params. Для человека это не деталь: от join_by
 *  зависит, обязан ли он положить макрос в ссылку. */
export type JoinBy = "ad_name" | "subid";

export const JOIN_LABEL: Record<JoinBy, string> = {
  ad_name: "by ad name",
  subid: "by sub id from the link",
};

export const JOIN_HINT: Record<JoinBy, string> = {
  ad_name: "The tracker reports the ad name, and it must match the name the upload gave the ad.",
  subid: "The tracker never sees Facebook names — only what the link's url_params carried. A sub id macro has to be in the link, or nothing joins.",
};

/* --- Что вендор спрашивает ------------------------------------------------- */

/** Одно поле настройки. `key` — тот самый ключ, который ждёт адаптер движка
 *  (`Keitaro(settings)`, `Binom(settings)`), а не придуманное нами имя: с
 *  ним человек и разработчик говорят об одном и том же. */
export interface CredentialField {
  key: string;
  label: string;
  /** `secret` рисуется иначе и никогда не попадает в адрес запроса и в лог. */
  kind: "url" | "secret" | "text";
  required: boolean;
  hint: string;
}

/* --- Готовность движка -----------------------------------------------------
 *
 * Три степени, и они не про вид, а про то, доедет ли введённый ключ хоть
 * куда-нибудь. Разница между «адаптер написан, но не влит» и «адаптера нет»
 * для человека тоже настоящая: первое чинится мержем, второе — работой.
 */
export type EngineSupport = "shipped" | "written" | "none";

export const ENGINE_SUPPORT_LABEL: Record<EngineSupport, string> = {
  shipped: "Adapter in the engine",
  written: "Adapter written, not merged",
  none: "No adapter yet",
};

/* --- Вендор ---------------------------------------------------------------- */

export interface Vendor {
  /** Устойчивый ключ: им же зовётся адаптер движка (`core/sources/<id>.py`). */
  id: string;
  name: string;
  /** Монограмма для плитки. ПОЧЕМУ НЕ ЛОГОТИП: чужого логотипа у нас нет ни
   *  одного, а нарисованный «похожий» — это выдуманный товарный знак на
   *  экране арендатора. Монограмма ничего не обещает и не устаревает. */
  mark: string;
  /** Раздел листа. Не «тип вендора»: тип — дело адаптера, а раздел — место. */
  section: SectionId;
  /** Короткая подпись под именем: чем эта штука является. Пусто там, где мы
   *  честно не знаем — выдумывать классификацию по названию нельзя. */
  kindLabel?: string;
  /** Одна строка: что подключение даёт в работе. */
  summary: string;
  support: EngineSupport;
  /** ПОЧЕМУ именно такая готовность — с номером иссуса или именем файла.
   *  Без этого «нет адаптера» читается как «забыли», а не как решение. */
  supportNote: string;
  joinBy?: JoinBy;
  /** Шаги воронки, которые вендор реально отдаёт. `undefined` — не «ноль», а
   *  «неизвестно, пока адаптер не написан». */
  gives?: readonly FunnelStep[];
  /** Что он спросит. Пустой список — либо спрашивать нечего, либо
   *  ещё неизвестно (нет адаптера); который из двух — говорит `fieldsNote`. */
  fields: readonly CredentialField[];
  fieldsNote: string;
  /* Признака «живёт на машине оператора» здесь больше нет (#157): его носил
     единственный вендор — антидетект, — и вместе с его разделом он уехал с
     листа целиком. Почему уехал и что нужно тому, кто вернёт, записано в
     `integrations-registry.ts`. */
  /** Это подключение работает КЛЮЧОМ, КОТОРЫЙ ВЫДАЁМ МЫ, и его надо показать
   *  прямо в карточке: скопировать, перевыпустить, увидеть, идут ли события.
   *
   *  Признаком на вендоре, а не условием по его имени в разметке: карточка не
   *  знает ни одного имени вендора, и это правило иссуса #126, проверяемое
   *  тестом. Второй такой источник получит блок ключа, дописав сюда одну
   *  строку в своём модуле.
   *
   *  Отдельной карточки под ключ НЕТ намеренно: ключ — часть подключения, а
   *  два места про одно подключение это тот самый разъезд, при котором человек
   *  видит две карточки об одном и не понимает, какая настоящая. */
  issuesKey?: boolean;
}

/* --- Разделы --------------------------------------------------------------- */

export type SectionId = "trackers";

/** Раздел листа. Вендоры приезжают отдельным модулем и здесь не
 *  перечисляются: добавление трекера не должно трогать этот файл вообще. */
export interface Section {
  id: SectionId;
  title: string;
  blurb: string;
  vendors: readonly Vendor[];
}

/* --- Чего не хватает СЕГОДНЯ ------------------------------------------------
 *
 * Это и есть предмет иссуса: «форма честно говорит чего не хватает». Список
 * собирается из фактов, а не пишется в каждой карточке заново, — иначе один
 * вендор однажды скажет «всё готово», потому что его текст забыли поправить.
 */

/** Что панель умеет со своей стороны. Сегодня — ничего: в `panel/app/api`
 *  лежат `fb/callback` и `snapshot`, ручек подключений там нет. */
export interface PanelBackend {
  /** Есть куда сохранить настройки вендора. */
  store: boolean;
  /** Есть кому сходить и проверить связь. Без этого «подключено» и «не
   *  отвечает» неразличимы физически, а не «пока не показываются». */
  check: boolean;
}

export const PANEL_BACKEND: PanelBackend = { store: false, check: false };

/**
 * Чего не хватает, чтобы этот вендор реально заработал. Пустой список
 * означает «можно подключать прямо сейчас» — и сегодня он не пуст ни у
 * одного вендора.
 */
export function missingToConnect(v: Vendor, backend: PanelBackend = PANEL_BACKEND): string[] {
  const out: string[] = [];
  if (v.support === "none") {
    out.push(
      `No adapter for ${v.name} in the engine. Correct credentials would still read nothing: something has to know how to ask this source for a report and how to map its answer onto the funnel.`,
    );
  }
  if (v.support === "written") {
    out.push(
      `The ${v.name} adapter is written but not merged, so the engine cannot load it yet.`,
    );
  }
  if (!backend.store && v.fields.length > 0) {
    out.push(
      "The panel has nowhere to store an address or a key: no integrations endpoint exists, and secrets must never be kept in the browser.",
    );
  }
  if (!backend.check) {
    out.push(
      "Nothing checks the connection, so the panel cannot tell «connected» from «not responding» on its own.",
    );
  }
  return out;
}

/**
 * Контекст любого вендора СЕГОДНЯ — одинаковый и пустой.
 *
 * Это не заглушка «данные ещё не пришли» и не фикстура: источника у контекста
 * попросту нет. Сохранённых настроек не существует, потому что их негде
 * хранить (`PANEL_BACKEND.store === false`), а проверок не существует,
 * потому что некому ходить. Отдельной константой — чтобы в тот день, когда
 * ручка появится, правилось место, которое СОБИРАЕТ контекст, а не карточка.
 */
export const NO_BACKEND_CONTEXT: ConnContext = { configured: false };

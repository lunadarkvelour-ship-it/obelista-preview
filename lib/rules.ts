/**
 * Автоправила — модель контракта из спеки (`docs/superpowers/specs/
 * 2026-08-09-obelista-product-design.md` §7) и иссуса #25.
 *
 * Правило = срез (кабинет / кампания / адсет / объявление) + условие на
 * метрику за окно (спенд, CPL, лиды) + действие (ТОЛЬКО `pause`) + период
 * проверки серверным воркером. Разгон бюджета, включение и создание — вне
 * контракта на этапах 1-3, и это не забывчивость, а прямой запрет спеки.
 *
 * Серверного воркера СЕГОДНЯ не существует — он стартует после #22 (облако).
 * Поэтому этот файл не ходит никуда за данными: здесь только типы и чистые
 * функции над ними, тестируемые без DOM и без сети, ровно как `heat.ts` и
 * `account-rows.ts`. Лист (`RulesView.tsx`) обязан описывать состояние честно
 * уже сейчас — не «правило работает», а «правило не может сработать, пока нет
 * сервера», и эта модель — единственное место, где это решается, а не
 * россыпь `if` по компоненту.
 */

/* --- Действие ------------------------------------------------------------
 *
 * Ровно два литерала, и ни одним больше. До 15.08 здесь стоял один `pause`:
 * спека §7 запрещала «разгон бюджета, включение и создание». Владелец 15.08
 * развернул половину этого запрета дословно: «гибкие условия тушения И
 * ВКЛЮЧЕНИЯ, на все три уровня. Только pause и resume». Включение вернулось,
 * потому что правило, умеющее только тушить, — это ловушка в одну сторону:
 * ночью потушило, а разжигать наутро человеку руками, по одному объекту.
 *
 * Что НЕ вернулось и не вернётся: разгон бюджета, создание — и удаление.
 * Про удаление владелец сказал отдельно и жёстко: «УДАЛЯТЬ НИКОГДА — ни
 * кнопки, ни кода, ни на всякий случай». Поэтому здесь union из двух
 * литералов, а не строка: `tsc --noEmit` укажет на третий вариант сам,
 * компилятором, а не договорённостью между людьми, которую на ревью не
 * заметят. Тест `rules.test.ts` держит и набор, и запрет.
 */

/** Оба разрешённых действия. Третьего не бывает. */
export type RuleAction = "pause" | "resume";

/** Список для UI (чипы в предложении правила) — длина всегда 2. */
export const RULE_ACTIONS: readonly RuleAction[] = ["pause", "resume"];

export const RULE_ACTION_LABEL: Record<RuleAction, string> = {
  pause: "Pause",
  resume: "Resume",
};

/** Что действие ДЕЛАЕТ с объектом, словами последствия, а не команды. Стоит
 *  в блоке «что произойдёт» до сохранения — человек должен прочитать исход
 *  раньше, чем правило впервые сработает. */
export const RULE_ACTION_OUTCOME: Record<RuleAction, string> = {
  pause: "stops spending; it stays in the account, nothing is deleted",
  resume: "starts spending again on its existing budget, unchanged",
};

/** Рантайм-страж для данных, пришедших не из TypeScript (JSON с сервера,
 *  когда он появится). Тип защищает код, который мы пишем сами; данные
 *  снаружи типов не видят и обязаны быть проверены явно. */
export function isRuleAction(v: unknown): v is RuleAction {
  return v === "pause" || v === "resume";
}

/* --- Срез ------------------------------------------------------------- */

/** На каком уровне дерева Меты стоит правило. */
export type RuleScope = "account" | "campaign" | "adset" | "ad";

export const RULE_SCOPES: readonly RuleScope[] = ["account", "campaign", "adset", "ad"];

export const RULE_SCOPE_LABEL: Record<RuleScope, string> = {
  account: "ad account",
  campaign: "campaign",
  adset: "ad set",
  ad: "ad",
};

/* --- Условие ------------------------------------------------------------ */

/** Метрика, которую правило меряет за окно. */
export type RuleMetric = "spend" | "cpl" | "leads";

export const RULE_METRICS: readonly RuleMetric[] = ["spend", "cpl", "leads"];

export const RULE_METRIC_LABEL: Record<RuleMetric, string> = {
  spend: "spend",
  cpl: "CPL",
  leads: "leads",
};

/** Деньги — у spend и cpl, leads — голое число. Раздельно от лейбла: единица
 *  измерения нужна для форматирования суммы, а не для подписи метрики. */
export const RULE_METRIC_UNIT: Record<RuleMetric, "" | "$"> = {
  spend: "$",
  cpl: "$",
  leads: "",
};

/** В какую сторону сравниваем намеренное значение с порогом. */
export type RuleComparator = "gte" | "lte";

export const RULE_COMPARATORS: readonly RuleComparator[] = ["gte", "lte"];

/** Словами, а не знаком. `>=` в предложении, которое человек читает вслух,
 *  спотыкает его ровно на том месте, где важнее всего не ошибиться. */
export const RULE_COMPARATOR_LABEL: Record<RuleComparator, string> = {
  gte: "at least",
  lte: "at most",
};

const COMPARATOR_WORD = RULE_COMPARATOR_LABEL;

export interface RuleCondition {
  metric: RuleMetric;
  comparator: RuleComparator;
  value: number;
  /** Окно, за которое считается метрика, в часах. */
  windowHours: number;
}

/** Условие человеческими словами — для превью и глоссария. Чистая функция:
 *  не форматирует даты и не знает про конкретное правило, только про само
 *  условие. */
export function describeCondition(c: RuleCondition): string {
  const unit = RULE_METRIC_UNIT[c.metric];
  return `${RULE_METRIC_LABEL[c.metric]} ${COMPARATOR_WORD[c.comparator]} ${unit}${c.value} over ${c.windowHours}h`;
}

/** Период проверки словами. `checkIntervalMin` — минуты, потому что так его
 *  и будет отдавать сервер; часы удобны только глазам. */
export function formatCheckInterval(min: number): string {
  if (min < 60) return `every ${min} min`;
  const hours = min / 60;
  return `every ${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

/* --- Правило -------------------------------------------------------------
 *
 * `enabled` — свойство САМОГО правила (настройка, которую хранит будущий
 * сервер), а не факт из окружения. Всё, что зависит от текущего момента
 * (жив ли движок, есть ли путь тушения, что намерили в последней проверке),
 * живёт в `RuleRunContext` ниже и приходит отдельно — это разные источники
 * правды, и смешивать их в одном объекте значит на каждое обновление статуса
 * переписывать хранимую настройку.
 */
export interface Rule {
  id: string;
  /** Человеческое имя — им же подписывается срабатывание в журнале. */
  name: string;
  scope: RuleScope;
  /** id объекта Меты, на который смотрит правило (act_id/campaign/adset/ad —
   *  конкретный вид зависит от `scope`). */
  targetId: string;
  /** Имя цели глазами человека — то, что стоит во фразе правила.
   *
   *  ХРАНИТСЯ СНИМКОМ РЯДОМ С id, а не спрашивается заново при каждом показе,
   *  и это сознательный выбор с известной ценой. Правила лежат в localStorage
   *  (`rules-store`) и рисуются без сети; перезапрос имени означал бы вызов на
   *  каждую карточку — или пустое место, когда демон недоступен. Плата за
   *  снимок одна: после переименования объекта в Мете имя устареет. Поэтому
   *  карточка правила показывает id РЯДОМ с именем — тогда расхождение видно
   *  человеку, а не спрятано.
   *
   *  Каталог для выбора есть: `GET /rule_targets` (`core/rule_targets.py`),
   *  панель зовёт его из `lib/rule-targets.ts`. Здесь до 16.08 стояло «каталога
   *  кампаний у панели нет и не будет до появления ручки» — ручку к тому
   *  моменту уже написали, и неправда в комментарии пережила свой предмет.
   *
   *  Необязательное — если имени нет, фраза честно показывает id, а не
   *  выдуманное название. */
  targetName?: string;
  condition: RuleCondition;
  action: RuleAction;
  checkIntervalMin: number;
  /** У внешнего клиента правила по умолчанию выключены (спека §7) —
   *  включаются по одному. Выключенное правило — не поломка, см. состояние
   *  `off` ниже. */
  enabled: boolean;
}

/* --- Состояния -------------------------------------------------------------
 *
 * Восемь, ровно эти, и они не взаимозаменяемы. Самое важное здесь —
 * `confirming`: у Меты чтение отстаёт от записи (живой замер #9, коммит
 * `7a0e2597` — первое чтение сразу после PAUSED вернуло ACTIVE, верный статус
 * пришёл со второго примерно через две секунды). Правило, которое потушит
 * объект и тут же прочитает статус, решит, что не сработало, и полезет
 * тушить снова. `confirming` существует, чтобы этот момент физически не мог
 * быть прочитан как `failed` — не соглашением, а тем, что для этого перехода
 * в коде ниже нет пути.
 */
export type RuleStateKind =
  | "off"
  | "no_engine"
  | "waiting"
  | "ok"
  | "confirming"
  | "fired"
  | "failed"
  | "unrunnable";

/** Канонический порядок восьми состояний — тот же, что в контракте иссуса.
 *  Ключ для двух вещей разом: тест проверяет, что набор не разъехался с
 *  типом, а глоссарий листа рисует их в этом порядке, не завися от того, в
 *  каком порядке их перечислили в JSX. */
export const RULE_STATES: readonly RuleStateKind[] = [
  "off",
  "no_engine",
  "waiting",
  "ok",
  "confirming",
  "fired",
  "failed",
  "unrunnable",
];

/** Всё, что вокруг правила меняется независимо от его собственных настроек:
 *  жив ли движок, годна ли цель для тушения, и что случилось на последней
 *  проверке. Сегодня это ниоткуда не приезжает по-настоящему (движка нет),
 *  но форма зафиксирована здесь, а не придумывается заново там, где правило
 *  впервые понадобится читать по-настоящему. */
export interface RuleRunContext {
  /** Сервер, который проверяет правила по расписанию, поднят. СЕГОДНЯ всегда
   *  `false` для любого правила — воркер физически не существует (#25
   *  стартует после #22, облако). Параметр всё равно на входе: когда воркер
   *  появится, менять придётся то, что СОБИРАЕТ контекст, а не эту модель. */
  engineRunning: boolean;
  /** Есть ли у цели живой путь тушения: токен приложения на этот каб, и сам
   *  каб виден хотя бы одному подключённому соцу (контур из иссуса #35).
   *  `false` значит «физически не может сработать», а не «пока не собрались
   *  руки включить». */
  runnable: boolean;
  /** Причина `runnable === false` словами: «нет токена» / «каб не виден ни с
   *  одного подключённого соца» — не техническая, а такая, которую поймёт
   *  байер. */
  unrunnableReason?: string;
  lastCheckedAt?: string;
  nextCheckAt?: string;
  /** Намеренное значение метрики на последней проверке — для `ok`. */
  lastValue?: number;
  /** Тушение отправлено, повторное чтение ещё не подтвердило статус — см.
   *  комментарий про `confirming` выше. */
  pausePending?: boolean;
  /** Последнее подтверждённое срабатывание — для журнала. */
  lastFired?: { at: string; metric: RuleMetric; value: number };
  /** Причина отказа тушения словами Меты, а не общим «ошибка». */
  failureReason?: string;
}

/**
 * Состояние правила прямо сейчас. Порядок проверок — это и есть модель, не
 * технические детали:
 *
 *  1. `off` — выключено самим правилом. Перебивает вообще всё: это решение
 *     владельца, а не диагноз, и оно не должно теряться за более «интересным»
 *     фактом из контекста.
 *  2. `unrunnable` — цель физически недостижима. Проверяется РАНЬШЕ движка
 *     нарочно: движка сегодня нет вообще ни у одного правила, и если бы
 *     `no_engine` стоял раньше, `unrunnable` было бы невозможно увидеть на
 *     экране никогда — а он обязан объяснять причину уже сегодня (иссус #35).
 *  3. `no_engine` — цель годна, но проверять её некому. Это состояние
 *     СЕГОДНЯ у всех оставшихся правил разом.
 *  4. `confirming` — тушение отправлено, второе чтение ещё не пришло.
 *     Проверяется раньше `failed`/`fired`, чтобы конфликтующий контекст
 *     (устаревшая причина отказа плюс свежий `pausePending`) не читался как
 *     неудача — то самое обещание из шапки этого файла.
 *  5. `failed` → `fired` → `ok` — итог последней завершённой проверки.
 *  6. `waiting` — ничего из вышеперечисленного: включено, годно, движок
 *     работает, и это первая проверка или отметок ещё не было.
 */
export function ruleState(rule: Rule, ctx: RuleRunContext): RuleStateKind {
  if (!rule.enabled) return "off";
  if (!ctx.runnable) return "unrunnable";
  if (!ctx.engineRunning) return "no_engine";
  if (ctx.pausePending) return "confirming";
  if (ctx.failureReason) return "failed";
  if (ctx.lastFired) return "fired";
  if (ctx.lastCheckedAt) return "ok";
  return "waiting";
}

/** Можно ли включить правило прямо сейчас.
 *
 *  Не про то, работает ли оно уже (это отвечает `ruleState`), а про момент
 *  ВКЛЮЧЕНИЯ. Отсутствие движка не мешает: правила готовят заранее, до
 *  переезда (#22/#25) это единственный способ ими пользоваться, и спека §7
 *  прямо предполагает, что внешний клиент включает их по одному ДО того, как
 *  что-либо начнёт срабатывать. А вот без живого пути тушения включать
 *  нечего — переключатель встанет в «включено», но правило будет лгать самим
 *  этим фактом, ровно как каб без опрашивающего токена (иссус #35). */
export function canEnable(rule: Rule, ctx: RuleRunContext): boolean {
  return ctx.runnable;
}

/** Короткая подпись — то, что стоит рядом с точкой состояния.
 *
 *  Действие вторым параметром, потому что три подписи из восьми зависят от
 *  него: правило на включение, сработав, показывает «Resumed», а не
 *  «Paused». Подпись «Paused» на правиле, которое объект РАЗЖИГАЕТ, читается
 *  ровно наоборот смыслу — а состояние в списке человек читает быстрее, чем
 *  само правило. Дефолт `pause` оставлен, чтобы глоссарий и старые вызовы
 *  работали без изменений. */
export function ruleStateLabel(state: RuleStateKind, action: RuleAction = "pause"): string {
  const done = action === "pause" ? "Paused" : "Resumed";
  switch (state) {
    case "off": return "Off";
    case "no_engine": return "No engine";
    case "waiting": return "Waiting";
    case "ok": return "Checked";
    case "confirming": return "Confirming";
    case "fired": return done;
    case "failed": return `${RULE_ACTION_LABEL[action]} failed`;
    case "unrunnable": return "Can't run";
  }
}

/** Развёрнутое объяснение — глоссарий листа и подсказки. Формулировки
 *  описывают, ЧТО лист покажет по каждому состоянию, когда данные появятся —
 *  это не отчёт о том, что уже нарисовано (данных нет), а честный контракт
 *  на будущее, который тесты держат зафиксированным. */
export function ruleStateDescription(state: RuleStateKind, action: RuleAction = "pause"): string {
  const verb = action === "pause" ? "paused" : "resumed";
  const call = action === "pause" ? "pause" : "resume";
  switch (state) {
    case "off":
      return "Disabled on purpose. New rules start here, and staying off is not a fault.";
    case "no_engine":
      return "No server is running the scheduled checks yet, so this rule cannot fire no matter how it's configured. This applies to every rule right now.";
    case "waiting":
      return "Enabled and able to run. Shows the time of the next scheduled check once the engine is live.";
    case "ok":
      return "Checked on schedule; the condition was not met. Shows when it last checked and the value it measured.";
    case "confirming":
      return `Just ${verb} the target; waiting for a second read to confirm the status stuck. Meta's read can lag its write by a couple of seconds, so this is not a failure.`;
    case "fired":
      return `${verb === "paused" ? "Paused" : "Resumed"} and confirmed by a second read. Logged with the rule, the metric, and the value that triggered it.`;
    case "failed":
      return `The ${call} call did not go through. Shows Meta's own reason instead of a generic error.`;
    case "unrunnable":
      return "Can never run for this target: no live app token for the ad account, or the account isn't visible from any connected profile.";
  }
}

/* --- Пять корзин: то, что человек читает списком --------------------------
 *
 * Владелец просил дословно: «Состояние каждого правила видно списком:
 * работает, ждёт условия, сработало, выключено». Это четыре слова, а
 * состояний восемь — и остальные четыре не выкидываются, а сворачиваются:
 * восемь нужны механизму (`confirming` против `failed` — вопрос второго
 * чтения у Меты), четыре нужны глазу, когда правил станет тридцать.
 *
 * Корзин всё-таки ПЯТЬ, а не четыре, и лишняя добавлена сознательно.
 * `no_engine`, `unrunnable` и `failed` некуда положить честно: в «работает»
 * они соврут (не работают), в «выключено» тоже (никто их не выключал —
 * сломано снаружи). Пятая корзина «нужно внимание» — это ровно те правила,
 * по которым человеку есть что сделать руками, и она обязана быть отдельной
 * строкой фильтра, а не пряткой внутри чужой.
 */

export type RuleBucket = "working" | "waiting" | "fired" | "off" | "attention";

export const RULE_BUCKETS: readonly RuleBucket[] = [
  "working",
  "waiting",
  "fired",
  "off",
  "attention",
];

export const RULE_BUCKET_LABEL: Record<RuleBucket, string> = {
  working: "Working",
  waiting: "Waiting",
  fired: "Fired",
  off: "Off",
  attention: "Needs attention",
};

/** Однострочное объяснение корзины — под фильтром, чтобы «Working» и
 *  «Waiting» не приходилось различать догадкой. */
export const RULE_BUCKET_HINT: Record<RuleBucket, string> = {
  working: "checked on schedule, condition not met yet",
  waiting: "enabled and armed, no check has run yet",
  fired: "acted on the target, or confirming that it stuck",
  off: "switched off by you; it never checks anything",
  attention: "cannot work as configured — needs a hand",
};

export function ruleBucket(state: RuleStateKind): RuleBucket {
  switch (state) {
    case "ok": return "working";
    case "waiting": return "waiting";
    // `confirming` живёт с `fired`, а не отдельно: для человека объект уже
    // тронут, и вторая проверка Меты — наша кухня, а не его новость.
    case "fired":
    case "confirming": return "fired";
    case "off": return "off";
    case "no_engine":
    case "unrunnable":
    case "failed": return "attention";
  }
}

/** Тон для цвета. Отдельный тип от `RuleStateKind` нарочно: раскраска — это
 *  решение вида, а не часть модели, и держать её общей функцией здесь, а не
 *  разбросанной по JSX, значит один источник правды на "что каким цветом". */
export type RuleTone = "muted" | "warning" | "error" | "progress" | "normal";

export function ruleStateTone(state: RuleStateKind): RuleTone {
  switch (state) {
    case "off": return "muted";
    case "no_engine":
    case "unrunnable": return "warning";
    case "failed": return "error";
    // `confirming` — НЕ error. Красный здесь читался бы как «не сработало» в
    // те самые секунды, когда Мета просто ещё не отдала верное чтение.
    case "confirming": return "progress";
    case "fired":
    case "ok":
    case "waiting": return "normal";
  }
}

/** Причина `unrunnable` словами — с защитой на случай, если контекст её не
 *  принёс. Фолбэк не короче и не глаже настоящей причины: он честно называет
 *  оба живых сценария иссуса #35 вместо голого «недоступно». */
export function unrunnableReasonText(ctx: RuleRunContext): string {
  return (
    ctx.unrunnableReason ||
    "No live path to this target: either the app token is missing, or the ad account isn't visible from any connected profile."
  );
}

/** Причина `failed` словами Меты — тоже с фолбэком, тоже не словом «ошибка»:
 *  это ровно то, чего просит иссус #35 избегать. */
export function failureReasonText(ctx: RuleRunContext): string {
  return ctx.failureReason || "Meta did not return a reason for the failed pause call.";
}

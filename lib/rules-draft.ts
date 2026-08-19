/**
 * Правило как ФРАЗА, а не как форма.
 *
 * Требование владельца дословно: «правило должно читаться человеком вслух как
 * фраза, а не собираться из выпадашек, в которых он потеряется. Условие,
 * уровень, действие, что произойдёт — видно ДО сохранения, а не после
 * срабатывания».
 *
 * Отсюда устройство файла. Предложение здесь собирается один раз и отдаётся
 * КУСКАМИ (`RuleSentenceSegment[]`): часть кусков — простой текст, часть —
 * «слоты», то есть места, которые в конструкторе становятся чипами, а в
 * списке правил просто выделены. Из-за этого порядок слов физически один и
 * тот же в трёх местах — в конструкторе, в карточке правила и в тестах, — и
 * не может разъехаться правкой в одном из них. Была бы вёрстка предложения в
 * JSX, а его текстовый пересказ рядом в `describe*()`, они разъехались бы в
 * первый же день, и человек читал бы вслух одно, а сохранял другое.
 *
 * Второй файл-сосед — `rules.ts`: там модель (действия, состояния, восемь
 * состояний и пять корзин). Здесь — только черновик, слова и проверки перед
 * сохранением. Ни сети, ни DOM: всё чистые функции, тестируемые в node.
 */

import {
  RULE_ACTION_LABEL,
  RULE_ACTION_OUTCOME,
  RULE_COMPARATOR_LABEL,
  RULE_METRIC_LABEL,
  RULE_METRIC_UNIT,
  RULE_SCOPE_LABEL,
  formatCheckInterval,
  type Rule,
  type RuleAction,
  type RuleComparator,
  type RuleMetric,
  type RuleScope,
} from "./rules";

/* --- Черновик ------------------------------------------------------------ */

/**
 * То, что человек набрал, но ещё не сохранил.
 *
 * Отличается от `Rule` двумя вещами, и обе намеренные: нет `id` (его выдаёт
 * хранилище) и `value` может быть `null` — «ещё не введено». Пустое поле
 * порога и порог, равный нулю, — РАЗНЫЕ вещи: «CPL at least $0» верно всегда
 * и потушит всё на первой же проверке, а «порог не введён» — просто
 * незаконченный черновик. Свалив их в одно число, мы бы получили правило,
 * которое молча тушит парк, потому что человек не дошёл до последнего поля.
 */
export interface RuleDraft {
  name: string;
  action: RuleAction;
  scope: RuleScope;
  targetId: string;
  /** Человеческое имя цели — им подписывается фраза. Пустое = цель не выбрана. */
  targetName: string;
  metric: RuleMetric;
  comparator: RuleComparator;
  value: number | null;
  windowHours: number;
  checkIntervalMin: number;
}

/** Заготовка нового правила.
 *
 *  Пороги нарочно не подставлены: подставленный порог человек не читает, а
 *  соглашается с ним — и правило уезжает с чужой цифрой. Всё остальное
 *  (окно, период, метрика) — самый частый случай, и его менять не обязательно. */
export function blankDraft(action: RuleAction = "pause"): RuleDraft {
  return {
    name: "",
    action,
    scope: "adset",
    targetId: "",
    targetName: "",
    metric: "cpl",
    comparator: action === "pause" ? "gte" : "lte",
    value: null,
    windowHours: 24,
    checkIntervalMin: 30,
  };
}

/** Черновик из существующего правила — для «Edit». */
export function draftFromRule(rule: Rule, targetName = ""): RuleDraft {
  return {
    name: rule.name,
    action: rule.action,
    scope: rule.scope,
    targetId: rule.targetId,
    targetName: targetName || rule.targetName || rule.targetId,
    metric: rule.condition.metric,
    comparator: rule.condition.comparator,
    value: rule.condition.value,
    windowHours: rule.condition.windowHours,
    checkIntervalMin: rule.checkIntervalMin,
  };
}

/** Черновик существующего правила из самого правила — обратная сторона:
 *  готовое правило, которое можно сохранить. `id` даёт хранилище. */
export function ruleFromDraft(draft: RuleDraft, id: string, enabled = false): Rule {
  return {
    id,
    name: draft.name.trim() || sentenceText(sentenceSegments(draft)),
    scope: draft.scope,
    targetId: draft.targetId,
    targetName: draft.targetName.trim() || undefined,
    condition: {
      metric: draft.metric,
      comparator: draft.comparator,
      value: draft.value ?? 0,
      windowHours: draft.windowHours,
    },
    action: draft.action,
    checkIntervalMin: draft.checkIntervalMin,
    enabled,
  };
}

/* --- Варианты для чипов ---------------------------------------------------
 *
 * Списки короткие нарочно. Окно «за 37 часов» никому не нужно, а выпадашка
 * на сорок пунктов — это ровно то, в чём владелец боялся потеряться. Всё,
 * что вне списка, вводится числом в двух местах, где число действительно
 * бывает любым: порог и — при желании — имя.
 */

/** Окна ТОЛЬКО СУТКАМИ, и это ограничение движка, а не вкус формы.
 *
 *  Наша разбивка дневная: строка на день, внутридневного разреза нет вовсе.
 *  Окно в шесть часов пришлось бы спрашивать у Меты вызовом на КАЖДОЕ правило
 *  на КАЖДОЙ проверке — в тот самый общий бюджет приложения, который уже
 *  ограничивает всё остальное. Поэтому движок принимает только кратное 24 (от
 *  24 до 168) и на некратное отвечает отказом с человеческим текстом, а НЕ
 *  молчаливым округлением: округлить значит выдать человеку правило «за сутки»
 *  под видом «за 6 часов».
 *
 *  Здесь этого отказа человек не встретит вовсе: список предлагает то, что
 *  движок примет. Форма, из которой можно выбрать заведомо отвергаемое
 *  значение, — это ошибка, устроенная нами и обнаруженная человеком.
 *
 *  Часы 1/3/6/12 стояли тут до 15.08, когда воркера не существовало и
 *  проверить их было некому. */
export const RULE_WINDOWS: readonly number[] = [24, 48, 72, 168];

export function windowLabel(hours: number): string {
  if (hours === 1) return "the last hour";
  if (hours < 24) return `the last ${hours} hours`;
  if (hours === 24) return "the last 24 hours";
  const days = hours / 24;
  if (Number.isInteger(days)) return days === 7 ? "the last 7 days" : `the last ${days} days`;
  return `the last ${hours} hours`;
}

export const RULE_INTERVALS: readonly number[] = [15, 30, 60, 180, 360, 720, 1440];

/** Значение порога словами: доллары там, где деньги, голое число у лидов. */
export function valueLabel(metric: RuleMetric, value: number | null): string {
  if (value === null) return "…";
  const unit = RULE_METRIC_UNIT[metric];
  return `${unit}${value}`;
}

/* --- Предложение ---------------------------------------------------------- */

/** Место в предложении, которое можно менять. Ровно восемь — столько же,
 *  сколько решений в правиле, и ни одного скрытого. */
export type RuleSentenceSlot =
  | "action"
  | "scope"
  | "target"
  | "metric"
  | "window"
  | "comparator"
  | "value"
  | "interval";

export interface RuleSentenceSegment {
  text: string;
  /** Есть — кусок редактируемый (чип), нет — просто слова между чипами. */
  slot?: RuleSentenceSlot;
  /** Слот, который ещё не заполнен: рисуется пунктиром и не даёт сохранить. */
  missing?: boolean;
}

/**
 * Одна фраза, из которой состоит весь лист.
 *
 *   Pause the ad set “Rome_CPL” when its CPL over the last 24 hours
 *   is at least $12, checked every 30 min.
 *
 * Порядок слов подобран так, чтобы фраза читалась вслух ОДНИМ дыханием и
 * отвечала на четыре вопроса владельца ровно в том порядке, в каком он их
 * задаёт: что сделаю → с чем → при каком условии → как часто проверяю.
 * «its» перед метрикой стоит не для красоты: без него «the ad set Rome CPL
 * when CPL» читается как две разные вещи, и глаз теряет, чей это CPL.
 */
export function sentenceSegments(draft: RuleDraft): RuleSentenceSegment[] {
  const target = draft.targetName.trim();
  return [
    { text: RULE_ACTION_LABEL[draft.action], slot: "action" },
    { text: " the " },
    { text: RULE_SCOPE_LABEL[draft.scope], slot: "scope" },
    { text: " " },
    target
      ? { text: `“${target}”`, slot: "target" }
      : { text: "(pick one)", slot: "target", missing: true },
    { text: " when its " },
    { text: RULE_METRIC_LABEL[draft.metric], slot: "metric" },
    { text: " over " },
    { text: windowLabel(draft.windowHours), slot: "window" },
    { text: " is " },
    { text: RULE_COMPARATOR_LABEL[draft.comparator], slot: "comparator" },
    { text: " " },
    draft.value === null
      ? { text: valueLabel(draft.metric, null), slot: "value", missing: true }
      : { text: valueLabel(draft.metric, draft.value), slot: "value" },
    { text: ", checked " },
    { text: formatCheckInterval(draft.checkIntervalMin), slot: "interval" },
    { text: "." },
  ];
}

/** Та же фраза строкой — для `aria-label`, для имени правила по умолчанию и
 *  для тестов. Именно строкой, а не пересказом: другой текст здесь означал бы
 *  два источника правды об одном правиле. */
export function sentenceText(segments: RuleSentenceSegment[]): string {
  return segments.map((s) => s.text).join("");
}

/** Короткий путь: черновик → фраза строкой. */
export function draftSentence(draft: RuleDraft): string {
  return sentenceText(sentenceSegments(draft));
}

/** Фраза готового правила. Имя цели правило ХРАНИТ (`Rule.targetName`) —
 *  снимком, сделанным в момент выбора в пикере; параметром его можно
 *  перебить свежим, когда вызывающий знает более новое. Без имени в фразе
 *  честно стоит id, а не выдуманное название.
 *
 *  До 16.08 здесь стояло «имя цели правило не хранит (у него только id)» —
 *  неправда с того дня, как поле завели, и она пережила его на неделю. */
export function ruleSentence(rule: Rule, targetName?: string): string {
  return draftSentence(draftFromRule(rule, targetName));
}

/* --- Что произойдёт ------------------------------------------------------- */

export type RuleIssueKind = "blocker" | "warning";

export interface RuleIssue {
  kind: RuleIssueKind;
  text: string;
}

/**
 * Проверки ДО сохранения. Делятся на две породы, и разница не косметическая:
 * `blocker` не даёт сохранить (правило неполное), `warning` сохранить даёт,
 * но вслух говорит, чем это кончится.
 *
 * Предупреждения здесь — не придирки, а два реальных способа выстрелить себе
 * в ногу этим механизмом:
 *
 *  1. Порог, которому условие удовлетворяет ВСЕГДА («spend at least $0»).
 *     Такое правило срабатывает на первой же проверке по всему, на что
 *     наведено. Для `pause` это тушение парка одним нажатием.
 *  2. Период проверки длиннее окна («меряю за час, смотрю раз в сутки»).
 *     Правило переступает через собственное окно и пропускает ровно то, ради
 *     чего заведено. Молча, без единой ошибки.
 */
export function draftIssues(draft: RuleDraft): RuleIssue[] {
  const out: RuleIssue[] = [];

  if (!draft.targetId.trim() || !draft.targetName.trim()) {
    out.push({
      kind: "blocker",
      text: `Pick the ${RULE_SCOPE_LABEL[draft.scope]} this rule watches.`,
    });
  }

  if (draft.value === null) {
    out.push({ kind: "blocker", text: "Set the number the metric is compared against." });
  } else if (draft.value < 0) {
    out.push({ kind: "blocker", text: "A threshold below zero can never be crossed." });
  } else if (
    (draft.comparator === "gte" && draft.value === 0) ||
    (draft.comparator === "lte" && draft.metric !== "leads" && draft.value === 0)
  ) {
    /* «at least 0» верно всегда; «at most $0» по деньгам верно для любого
       объекта, который сегодня ещё не тратил, — то есть почти для всех с
       утра. У лидов «at most 0» — наоборот, самое осмысленное правило на
       свете: «нет лидов — туши», и предупреждать о нём было бы шумом. */
    out.push({
      kind: "warning",
      text: `${RULE_METRIC_LABEL[draft.metric]} ${RULE_COMPARATOR_LABEL[draft.comparator]} ${valueLabel(draft.metric, 0)} is true almost always — this would fire on the first check.`,
    });
  }

  if (draft.checkIntervalMin > draft.windowHours * 60) {
    out.push({
      kind: "warning",
      text: `Checked less often than the window it measures (${formatCheckInterval(draft.checkIntervalMin)} over ${windowLabel(draft.windowHours)}) — it can step over what it is meant to catch.`,
    });
  }

  return out;
}

export function canSave(draft: RuleDraft): boolean {
  return !draftIssues(draft).some((i) => i.kind === "blocker");
}

/**
 * «Что произойдёт» — блок, который человек читает ДО сохранения.
 *
 * Три строки постоянные и одна переменная, и постоянные важнее. Вторая — про
 * повторное чтение статуса: живой замер #9 (коммит `7a0e2597`) показал, что
 * чтение у Меты отстаёт от записи, первое чтение сразу после PAUSED вернуло
 * ACTIVE. Человеку это надо знать не как деталь реализации, а как обещание:
 * «правило не полезет делать то же самое второй раз, увидев старое чтение».
 * Третья — про границы: удаления нет ни в каком виде, и сказать это надо
 * ДО сохранения, а не в подписи мелким шрифтом.
 */
export function outcomeLines(draft: RuleDraft): string[] {
  const target = draft.targetName.trim() || `the ${RULE_SCOPE_LABEL[draft.scope]}`;
  return [
    `When the condition is met, ${target} ${RULE_ACTION_OUTCOME[draft.action]}.`,
    `It acts once, then re-reads the status a moment later to confirm it stuck — Meta's read lags its own write, and a rule that trusted the first read would act twice.`,
    `Every firing is logged with this rule, the metric and the value that crossed the line, and one press undoes it.`,
    `A rule can only pause and resume. It never deletes anything, never changes a budget, never creates.`,
  ];
}

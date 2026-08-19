"use client";

/* Лист «Автоправила» — правило как ФРАЗА, а не как форма.
 *
 * Требование владельца 15.08 дословно: «правило должно читаться человеком
 * вслух как фраза, а не собираться из выпадашек, в которых он потеряется.
 * Условие, уровень, действие, что произойдёт — видно ДО сохранения, а не
 * после срабатывания. Состояние каждого правила видно списком: работает,
 * ждёт условия, сработало, выключено».
 *
 * Три решения раскладки следуют прямо из этих слов:
 *
 *  1. Конструктора-формы нет. Есть одна строка текста, в которой восемь слов
 *     кликабельны. Порядок слов приходит из `sentenceSegments()` — одного
 *     места на весь продукт, поэтому карточка правила, конструктор и тесты
 *     физически не могут показать разный порядок. Форма «поле — подпись» на
 *     восемь строк давала бы то же самое дерево решений, но читать её вслух
 *     нельзя, а ошибку в ней видно только после срабатывания.
 *  2. Блок «что произойдёт» стоит ПОД фразой в конструкторе, а не в подсказке
 *     после сохранения. Он говорит исход словами последствия («перестанет
 *     тратить»), а не команды («pause»), и там же — два способа выстрелить
 *     себе в ногу, которые проверяются до кнопки: порог, верный всегда, и
 *     период проверки длиннее окна.
 *  3. Список правил сгруппирован не по алфавиту, а по тому, что с правилом
 *     не так: сначала требующие руки, потом сработавшие, потом рабочие,
 *     потом выключенные. Правил у байера будет тридцать, и открывать он этот
 *     лист будет ровно с вопросом «что сломалось».
 *
 * УДАЛЕНИЯ ЗДЕСЬ НЕТ ВООБЩЕ. Ни кнопки удаления правила, ни действия
 * удаления объекта: правило умеет ровно pause и resume, а лишнее правило
 * выключают. Владелец: «УДАЛЯТЬ НИКОГДА — ни кнопки, ни кода, ни на всякий
 * случай».
 *
 * Чего этот лист СЕГОДНЯ не делает и не притворяется, что делает: правила
 * никуда не уезжают — они живут в localStorage этого браузера, и лист говорит
 * об этом первой же плашкой (`STORAGE_NOTE` в `@/lib/rules-store`).
 *
 * ПРИЧИНА У ЭТОГО ДРУГАЯ, ЧЕМ БЫЛО НАПИСАНО ЗДЕСЬ ДО 16.08. Строка «сервера,
 * который проверял бы условие, не существует, ручки под правила в демоне нет»
 * протухла: движок написан (`core/rules.py`, #141 — хранение, замер по нашей
 * базе, тушение, откат), и обе ручки в демоне есть
 * (`scripts/analytics_daemon.py:2435` — `/rules`, `:2440` — `/rules/log`).
 * Не сделано другое, и это работа отдельного куска: ЭТОТ ЛИСТ к ним не
 * подключён — он ни разу не зовёт ни одну из них, поэтому правила остаются
 * черновиками в браузере. Плашка ниже говорит про ДЕПЛОЙ («until a server is
 * deployed»), и вот это по-прежнему правда: облако (#22) не выкачено, а
 * состояние движка панель не спрашивает, потому что не ходит в `/rules`.
 */

import * as React from "react";
import { Button as RacButton, Dialog, DialogTrigger } from "react-aria-components";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Popover } from "@/components/rac/Popover";
import {
  ChevronDown,
  Info,
  Pencil,
  Plus,
  ScrollText,
  TriangleAlert,
} from "lucide-react";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import { Switch } from "@/components/coss";
import { Expandable } from "@/components/ui/disclosure";
import {
  RULE_ACTIONS,
  RULE_ACTION_LABEL,
  RULE_BUCKETS,
  RULE_BUCKET_HINT,
  RULE_BUCKET_LABEL,
  RULE_COMPARATORS,
  RULE_COMPARATOR_LABEL,
  RULE_METRICS,
  RULE_METRIC_LABEL,
  RULE_METRIC_UNIT,
  RULE_SCOPES,
  RULE_SCOPE_LABEL,
  RULE_STATES,
  canEnable,
  ruleBucket,
  ruleState,
  ruleStateDescription,
  ruleStateLabel,
  ruleStateTone,
  unrunnableReasonText,
  type Rule,
  type RuleAction,
  type RuleBucket,
  type RuleComparator,
  type RuleMetric,
  type RuleRunContext,
  type RuleScope,
  type RuleTone,
} from "@/lib/rules";
import {
  RULE_INTERVALS,
  RULE_WINDOWS,
  blankDraft,
  canSave,
  draftFromRule,
  draftIssues,
  outcomeLines,
  ruleFromDraft,
  sentenceSegments,
  windowLabel,
  type RuleDraft,
  type RuleSentenceSegment,
} from "@/lib/rules-draft";
import {
  STORAGE_NOTE,
  addRule,
  loadRules,
  nextRuleId,
  replaceRule,
  saveRules,
  setRuleEnabled,
  stubRunContext,
} from "@/lib/rules-store";
import { formatCheckInterval } from "@/lib/rules";
import {
  canRevert, logLine, revertLabel, revertState, showRevert, sortLog, type RuleLogEntry,
} from "@/lib/rules-log";
import {
  fetchRuleTargets,
  targetLabel,
  type RuleTarget,
} from "@/lib/rule-targets";
import { cn } from "@/lib/utils";

/* --- Цвет ---------------------------------------------------------------- */

/** Цвет по тону состояния. Один источник на весь лист: строку «какой тон
 *  каким классом» не разбрасываем по JSX, иначе confirming рано или поздно
 *  где-нибудь получит случайный красный оттенок мимо `ruleStateTone`. */
const TONE_CLASS: Record<RuleTone, { dot: string; text: string; border: string; bg: string }> = {
  muted: { dot: "bg-ghost", text: "text-muted-foreground", border: "border-border", bg: "bg-card" },
  warning: { dot: "bg-warning", text: "text-warning", border: "border-warning/30", bg: "bg-warning-soft" },
  error: { dot: "bg-destructive", text: "text-destructive", border: "border-destructive/35", bg: "bg-destructive-soft" },
  // Primary/blue, а не жёлтый и не красный: confirming — рабочий процесс, не
  // предупреждение и не отказ. Свой оттенок нужен, чтобы отличаться от обоих.
  progress: { dot: "bg-primary-ink", text: "text-primary-ink", border: "border-primary-line", bg: "bg-primary-soft" },
  // «Обычный» в буквальном смысле — без спецэффекта: fired/ok/waiting не
  // требуют внимания, и красить их всё равно во что-то значит обесценить
  // цвет у warning/error, ради которых он вообще есть.
  normal: { dot: "bg-muted-foreground", text: "text-foreground", border: "border-border", bg: "bg-card" },
};

function StateDot({ tone }: { tone: RuleTone }) {
  return <span aria-hidden className={cn("size-2.5 flex-none rounded-full", TONE_CLASS[tone].dot)} />;
}

/**
 * Тон ПОДЛОЖКИ карточки — не всегда тот же, что тон состояния.
 *
 * Расходятся они ровно в одном месте, и это находка смотрелки: сегодня
 * `no_engine` у ВСЕХ правил разом, и лист превращался в сплошную жёлтую
 * стену. Жёлтым на ней становились и те два правила, которые сломаны
 * по-настоящему (`failed`, `unrunnable`), — то есть цвет переставал
 * что-либо значить именно там, ради чего он есть.
 *
 * Общий факт «движка нет» уже сказан баннером сверху, один раз и крупно.
 * В карточке от него остаются точка и подпись предупреждающего цвета, а
 * подложка — обычная. Модель (`ruleStateTone`) при этом не трогается: она
 * описывает СОСТОЯНИЕ, а это решение вида про одну конкретную страницу.
 */
function surfaceTone(state: Parameters<typeof ruleStateTone>[0]): RuleTone {
  return state === "no_engine" ? "normal" : ruleStateTone(state);
}

/* --- Чипы предложения -----------------------------------------------------
 *
 * Чип — это слово фразы, которое можно поменять. Выглядит он как слово с
 * подчёркиванием, а не как поле ввода: у поля есть рамка, отступы и высота,
 * и восемь полей подряд перестают быть предложением ещё до того, как человек
 * дочитает его до конца. Мягкая подложка акцентом даёт понять, что тут можно
 * нажать, не разрывая строку.
 */

const CHIP =
  "inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border border-primary-line bg-primary-soft px-1.5 py-px align-baseline font-medium text-primary-ink transition-colors hover:bg-primary-soft/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Незаполненный чип — пунктиром и предупреждающим цветом. Пустое место во
 *  фразе обязано быть видно с расстояния: это то, из-за чего кнопка «Save»
 *  не нажимается. */
const CHIP_MISSING =
  "inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border border-dashed border-warning/60 bg-warning-soft px-1.5 py-px align-baseline font-medium text-warning transition-colors hover:bg-warning-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

interface ChoiceOption {
  id: string;
  label: string;
  /** Одна строка пояснения в меню — там, где выбор неочевиден («at least»
   *  против «at most», окно против периода). */
  hint?: string;
}

function ChoiceChip({
  label,
  title,
  options,
  onChange,
}: {
  label: string;
  title: string;
  options: ChoiceOption[];
  onChange: (id: string) => void;
}) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger className={CHIP} aria-label={title}>
        {label}
        <ChevronDown className="size-3 opacity-60" strokeWidth={2} aria-hidden />
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4}>
          <BaseMenu.Popup
            className={cn(
              "z-50 min-w-[150px] rounded-lg border border-border bg-popover p-1 text-popover-foreground",
              "shadow-lg/5 outline-none",
              "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
              "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
              "transition-all duration-150",
              "font-sans max-h-[inherit] overflow-auto empty:text-center empty:pb-2",
            )}
          >
            {options.map((o) => (
              <BaseMenu.Item
                key={o.id}
                onClick={() => onChange(o.id)}
                label={o.label}
                className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-hover data-[highlighted]:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 font-normal truncate"
              >
                <div className="flex flex-col">
                  <span>{o.label}</span>
                  {o.hint ? <span className="text-2xs text-muted-foreground">{o.hint}</span> : null}
                </div>
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

/** Поле, притворяющееся словом. Ширина считается по содержимому — иначе во
 *  фразе зияет дыра шириной с поле ввода, и предложение перестаёт читаться
 *  как предложение. */
function InlineInput({
  value,
  onChange,
  placeholder,
  label,
  prefix,
  missing,
  inputMode,
  min = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  prefix?: string;
  missing?: boolean;
  inputMode?: "decimal";
  min?: number;
}) {
  const width = Math.max(min, (value || placeholder).length) + 1;
  return (
    <span className={missing ? CHIP_MISSING : CHIP}>
      {prefix ? <span aria-hidden>{prefix}</span> : null}
      <input
        aria-label={label}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: `${width}ch` }}
        className="bg-transparent font-medium outline-none placeholder:text-warning/70"
      />
    </span>
  );
}

/* --- Чип выбора цели ------------------------------------------------------
 *
 * ПОЧЕМУ СВОЙ ЧИП, А НЕ `components/rac/ComboBox`. Готовый комбобокс — это поле
 * с рамкой, высотой и подписью; восемь таких подряд перестают быть
 * предложением ещё до того, как человек дочитает его до конца, а требование
 * владельца дословно — «правило должно читаться вслух как фраза». Поэтому
 * снаружи это то же слово с подчёркиванием, что и остальные семь чипов, а
 * поиск живёт внутри поповера.
 *
 * ИМЯ И id СТАВЯТСЯ ОДНИМ ДЕЙСТВИЕМ, и это главное свойство. До пикера они
 * задавались двумя независимыми полями — «Meta id» под фразой и свободный
 * текст в самой фразе, — то есть правило штатно могло звать один объект и
 * называться именем другого, без единой ошибки на экране.
 *
 * СПИСОК НЕ ФИЛЬТРУЕТСЯ ЗДЕСЬ: поиск уезжает параметром `q` на сервер, потому
 * что до нас доезжает только `limit` строк. Отбор по приехавшему искал бы по
 * началу алфавита — человек набирал бы имя своей кампании и получал пусто при
 * живой кампании.
 */

const PICKER_DEBOUNCE_MS = 250;

function TargetPicker({
  scope,
  targetId,
  targetName,
  onPick,
}: {
  scope: RuleScope;
  targetId: string;
  targetName: string;
  onPick: (t: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<RuleTarget[]>([]);
  const [truncated, setTruncated] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  /* Отказ ручки показывается словами на месте списка. Пустой список вместо
     ошибки читался бы как «у тебя нет кампаний» — то есть как факт о парке
     человека, которого мы не знаем. */
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      setError(null);
      fetchRuleTargets({ level: scope, q: q.trim() || null, signal: ac.signal })
        .then((page) => {
          setRows(page.rows);
          setTruncated(page.truncated);
        })
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name === "AbortError") return;
          setRows([]);
          setTruncated(false);
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => setBusy(false));
    }, q ? PICKER_DEBOUNCE_MS : 0);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [open, scope, q]);

  const chosen = targetName.trim();
  const label = chosen ? `“${chosen}”` : "(pick one)";

  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <RacButton
        className={chosen ? CHIP : CHIP_MISSING}
        aria-label={`Choose the ${RULE_SCOPE_LABEL[scope]} this rule watches`}
      >
        {label}
        <ChevronDown className="size-3 opacity-60" strokeWidth={2} aria-hidden />
      </RacButton>
      <Popover className="w-80">
        <Dialog className="flex max-h-80 flex-col outline-none">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${RULE_SCOPE_LABEL[scope]}s by name`}
              aria-label={`Search ${RULE_SCOPE_LABEL[scope]}s by name`}
              className="h-8 w-full rounded-md border border-border bg-input px-2 text-xs outline-none focus-visible:border-focus"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-1">
            {error ? (
              <p className="px-2 py-3 text-2xs leading-relaxed text-warning">{error}</p>
            ) : busy && rows.length === 0 ? (
              <p className="px-2 py-3 text-2xs text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="px-2 py-3 text-2xs leading-relaxed text-muted-foreground">
                {q.trim()
                  ? `No ${RULE_SCOPE_LABEL[scope]} matches “${q.trim()}”.`
                  : `Nothing collected at this level yet.`}
              </p>
            ) : (
              rows.map((t) => (
                <RacButton
                  key={`${t.level}:${t.id}`}
                  onPress={() => {
                    onPick({ id: t.id, name: targetLabel(t) });
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors",
                    "hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                    t.id === targetId && "bg-primary-soft"
                  )}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {targetLabel(t)}
                    </span>
                    {/* Личный кабинет назван вслух. Каталог их не прячет
                        намеренно, а срез правила потом сам их отсеет — человек
                        должен понимать это ДО того, как удивится. */}
                    {t.personal ? (
                      <span className="flex-none text-2xs text-warning">personal</span>
                    ) : null}
                    {t.status ? (
                      <span className="flex-none text-2xs text-faint">{t.status}</span>
                    ) : null}
                  </span>
                  {/* id виден в списке, а не только после выбора: имена в Мете
                      повторяются, и различить два «Rome_CPL» больше нечем. */}
                  <span className="font-mono text-2xs text-faint">
                    {t.id}
                    {t.act_id && t.act_id !== t.id ? ` · ${t.act_id}` : ""}
                  </span>
                </RacButton>
              ))
            )}
          </div>
          {/* «Показано не всё» — словами и только когда это правда. Признак
              приходит от сервера: своего предела у панели нет, иначе он
              разъедется с серверным и соврёт «всё влезло» на урезанном списке. */}
          {truncated ? (
            <p className="border-t border-border px-2 py-1.5 text-2xs text-warning">
              Showing the first matches only — narrow the search to see the rest.
            </p>
          ) : null}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/* --- Фраза ---------------------------------------------------------------- */

/** Фраза только для чтения — в карточке правила и в примерах.
 *
 *  Слова-решения выделены, связки приглушены: так строку можно и прочитать
 *  вслух целиком, и выхватить глазом «Pause … ad set … CPL … $12», когда
 *  правил тридцать и читать их подряд никто не станет. */
export function RuleSentence({
  segments,
  className,
}: {
  segments: RuleSentenceSegment[];
  className?: string;
}) {
  return (
    <p className={cn("text-sm leading-relaxed text-muted-foreground", className)}>
      {segments.map((s, i) =>
        s.slot ? (
          <span
            key={i}
            className={cn("font-medium", s.missing ? "text-warning" : "text-foreground")}
          >
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </p>
  );
}

/* --- Лист ----------------------------------------------------------------- */

export function RulesView() {
  const [rules, setRules] = React.useState<Rule[]>([]);
  /* Приехало ли чтение из хранилища. Без этого «правил нет» и «ещё не
     читали» выглядят одинаково — на первом кадре сервера список пуст всегда,
     и пустое состояние мигало бы у человека с десятью правилами. */
  const [loaded, setLoaded] = React.useState(false);
  const [draft, setDraft] = React.useState<RuleDraft | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [bucket, setBucket] = React.useState<RuleBucket | "all">("all");

  React.useEffect(() => {
    setRules(loadRules());
    setLoaded(true);
  }, []);

  const commit = React.useCallback((next: Rule[]) => {
    setRules(next);
    saveRules(next);
  }, []);

  const ctx = stubRunContext();
  const counts = countByBucket(rules, ctx);
  const shown = sortForReading(
    rules.filter((r) => bucket === "all" || ruleBucket(ruleState(r, ctx)) === bucket),
    ctx
  );

  function startNew() {
    setEditingId(null);
    setDraft(blankDraft());
  }

  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setDraft(draftFromRule(rule));
  }

  function save(d: RuleDraft) {
    if (editingId) {
      const old = rules.find((r) => r.id === editingId);
      commit(replaceRule(rules, ruleFromDraft(d, editingId, old?.enabled ?? false)));
    } else {
      // Новое правило сохраняется ВЫКЛЮЧЕННЫМ. Спека §7: у внешнего клиента
      // правила по умолчанию выключены и включаются им по одному — правило,
      // включающееся самим фактом сохранения, срабатывает раньше, чем автор
      // успел его перечитать.
      commit(addRule(rules, ruleFromDraft(d, nextRuleId(rules), false)));
    }
    setDraft(null);
    setEditingId(null);
  }

  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "flex flex-col gap-5 py-5")}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-semibold">Automation rules</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            One rule is one sentence: what to do, to which campaign, ad set or ad, on what
            condition, and how often to check. A rule can pause and resume — nothing else.
            It never changes a budget, never creates, and never deletes anything.
          </p>
        </div>
        {draft ? null : (
          <RacButton
            onPress={startNew}
            className="inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-lg border border-primary-line bg-primary-soft px-3 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-soft/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            New rule
          </RacButton>
        )}
      </header>

      <EngineNotice />

      {draft ? (
        <RuleComposer
          draft={draft}
          editing={!!editingId}
          onChange={setDraft}
          onSave={save}
          onCancel={() => {
            setDraft(null);
            setEditingId(null);
          }}
        />
      ) : null}

      {/* До чтения хранилища не рисуем НИЧЕГО вместо списка. Ни фильтра, ни
          «правил нет»: на сервере правил нет всегда, и любая из этих двух
          картинок — утверждение о парке правил, которого мы ещё не знаем.
          Пустая пауза в четверть кадра честнее мигающего «No rules yet» у
          человека с десятью правилами. */}
      {!loaded ? null : rules.length === 0 ? (
        <EmptyRules onNew={startNew} />
      ) : (
        <section className="flex flex-col gap-3">
          <BucketFilter value={bucket} counts={counts} total={rules.length} onChange={setBucket} />
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
              No rules in “{bucket === "all" ? "all" : RULE_BUCKET_LABEL[bucket]}”.
            </p>
          ) : (
            shown.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                ctx={ctx}
                onEdit={() => startEdit(rule)}
                onToggle={(on) => commit(setRuleEnabled(rules, rule.id, on))}
              />
            ))
          )}
        </section>
      )}

      <Journal />
      <StateGlossary />
    </div>
  );
}

/* --- Порядок и счёт ------------------------------------------------------- */

/** Сначала то, по чему человеку есть что сделать. Алфавит и время создания
 *  здесь не помогают вообще: лист открывают с вопросом «что сломалось», а не
 *  «что я заводил в прошлый вторник». */
const READING_ORDER: RuleBucket[] = ["attention", "fired", "working", "waiting", "off"];

export function sortForReading(list: readonly Rule[], ctx: RuleRunContext): Rule[] {
  return [...list].sort(
    (a, b) =>
      READING_ORDER.indexOf(ruleBucket(ruleState(a, ctx))) -
      READING_ORDER.indexOf(ruleBucket(ruleState(b, ctx)))
  );
}

function countByBucket(list: readonly Rule[], ctx: RuleRunContext): Record<RuleBucket, number> {
  const out = { working: 0, waiting: 0, fired: 0, off: 0, attention: 0 } as Record<RuleBucket, number>;
  for (const r of list) out[ruleBucket(ruleState(r, ctx))] += 1;
  return out;
}

function BucketFilter({
  value,
  counts,
  total,
  onChange,
}: {
  value: RuleBucket | "all";
  counts: Record<RuleBucket, number>;
  total: number;
  onChange: (b: RuleBucket | "all") => void;
}) {
  const items: { id: RuleBucket | "all"; label: string; hint: string; n: number }[] = [
    { id: "all", label: "All", hint: "every rule you have", n: total },
    ...RULE_BUCKETS.map((b) => ({
      id: b as RuleBucket | "all",
      label: RULE_BUCKET_LABEL[b],
      hint: RULE_BUCKET_HINT[b],
      n: counts[b],
    })),
  ];
  const active = items.find((it) => it.id === value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
      {items.map((it) => (
        <RacButton
          key={String(it.id)}
          onPress={() => onChange(it.id)}
          aria-label={`${it.label}: ${it.hint}`}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            value === it.id
              ? "border-primary-line bg-primary-soft text-primary-ink"
              : "border-border bg-card text-muted-foreground hover:bg-hover",
            // Пустая корзина не прячется: «сработавших ноль» — это ответ, и
            // исчезающий фильтр отвечал бы на него пустым местом.
            it.n === 0 && value !== it.id && "opacity-60"
          )}
        >
          <span>{it.label}</span>
          <span className="font-mono text-2xs tabular-nums">{it.n}</span>
        </RacButton>
      ))}
      </div>
      {/* Пояснение выбранной корзины строкой, а не всплывающей подсказкой:
          «Working» и «Waiting» различаются одним словом, и догадываться, чем
          именно, человек не должен. */}
      <p className="text-2xs text-faint">{active?.hint}</p>
    </div>
  );
}

/* --- Карточка правила ------------------------------------------------------ */

export function RuleCard({
  rule,
  ctx,
  onEdit,
  onToggle,
}: {
  rule: Rule;
  ctx: RuleRunContext;
  onEdit?: () => void;
  onToggle?: (on: boolean) => void;
}) {
  const state = ruleState(rule, ctx);
  const tone = ruleStateTone(state);
  const t = TONE_CLASS[tone];
  const surface = TONE_CLASS[surfaceTone(state)];
  const segments = sentenceSegments(draftFromRule(rule));
  const enableable = canEnable(rule, ctx);
  const label = ruleStateLabel(state, rule.action);
  const bucket = RULE_BUCKET_LABEL[ruleBucket(state)];

  return (
    <article className={cn("rounded-xl border px-4 py-3", surface.border, surface.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <StateDot tone={tone} />
          <span className={cn("text-xs font-medium", t.text)}>{label}</span>
          {/* Корзина — только когда она добавляет слово. «Off · Off» и
              «Waiting · Waiting» человек читает как шум и перестаёт читать
              вообще, а вместе с ними и «Confirming · Fired», ради которого
              подпись корзины и нужна. */}
          {bucket !== label ? <span className="text-2xs text-faint">· {bucket}</span> : null}
        </div>
        <div className="flex flex-none items-center gap-2">
          {onEdit ? (
            <RacButton
              onPress={onEdit}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Pencil className="size-3.5" strokeWidth={1.8} aria-hidden />
              Edit
            </RacButton>
          ) : null}
          {/* Выключатель — единственный способ остановить правило, и он же
              единственная замена кнопке удаления, которой здесь нет. */}
          <Switch
            checked={rule.enabled}
            disabled={!enableable}
            onCheckedChange={(on) => onToggle?.(on)}
            aria-label={rule.enabled ? "Turn this rule off" : "Turn this rule on"}
          />
        </div>
      </div>

      <RuleSentence segments={segments} className="mt-2" />

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-faint">
        {/* ЧИТАЕМОЕ ИМЯ ПЕРЕД id, а не голый номер. Фраза выше уже называет
            цель, но карточку читают глазами по этой строке, и «120210…» в ней
            не опознаётся никак. id остаётся рядом нарочно: имя — снимок на
            момент выбора, и после переименования в Мете разойдётся с ним. */}
        <span>
          {rule.targetName ? (
            <>
              {rule.targetName}{" "}
              <span className="font-mono text-faint">{rule.targetId}</span>
            </>
          ) : (
            <span className="font-mono">{rule.targetId || "no id"}</span>
          )}
        </span>
        <span>{formatCheckInterval(rule.checkIntervalMin)}</span>
        <span>
          last check{" "}
          {ctx.lastCheckedAt ? (
            <time dateTime={ctx.lastCheckedAt}>{stamp(ctx.lastCheckedAt)}</time>
          ) : (
            "——"
          )}
          {/* ЧТО НАМЕРИЛИ, а не только когда смотрели. Без этого «проверено» —
              пустое слово: человек всё равно идёт выяснять, близко ли значение
              к порогу, и правило, которое вот-вот сработает, ничем не отличается
              от того, что и близко не подошло. Показываем ровно то, что
              прислал воркер, — своей оценки «близко/далеко» здесь нет: порог
              сравнения живёт в самом правиле, а не в подписи под ним. */}
          {ctx.lastValue !== undefined ? (
            <span className="text-muted-foreground">
              {" "}· {RULE_METRIC_LABEL[rule.condition.metric]} {ctx.lastValue}
            </span>
          ) : null}
        </span>
        {/* КОГДА ПРОВЕРЯТ СНОВА — единственное поле контекста, которое панель
            обязана показать и не может вывести сама: интервал правила это
            намерение, а расписание знает воркер. Прочерк здесь значит «воркер
            не сказал», и подставлять вместо него «через N минут» по интервалу
            нельзя — это была бы наша догадка с видом обещания. */}
        <span>
          next check{" "}
          {ctx.nextCheckAt ? (
            <time dateTime={ctx.nextCheckAt}>{stamp(ctx.nextCheckAt)}</time>
          ) : (
            "——"
          )}
        </span>
        <span>
          {ctx.lastFired
            ? `fired at ${ctx.lastFired.value} ${RULE_METRIC_LABEL[ctx.lastFired.metric]}`
            : "never fired"}
        </span>
      </div>

      {/* Почему правило не может сработать — прямо в карточке, а не в
          глоссарии внизу: причина относится к ЭТОМУ правилу, и искать её на
          другом экране человек не станет. */}
      {state === "unrunnable" ? <CardNote text={unrunnableReasonText(ctx)} /> : null}
      {state === "no_engine" ? (
        <CardNote text="No server runs the scheduled checks yet, so this rule cannot fire — however it is configured." />
      ) : null}
    </article>
  );
}

/** Отметка времени человеческим видом и БЕЗ пересчёта в местную зону.
 *  Правило проверяется сервером, и «09:00 UTC» — то, что видно в его логах;
 *  тихо переведя это в зону браузера, мы бы развели показания панели и
 *  журнала, а сверять их придётся именно в тот момент, когда что-то пошло
 *  не так. */
function stamp(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

function CardNote({ text }: { text: string }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 border-t border-border pt-2 text-2xs leading-relaxed text-muted-foreground">
      <Info className="mt-px size-3.5 flex-none" strokeWidth={1.8} aria-hidden />
      <span>{text}</span>
    </p>
  );
}

/* --- Конструктор ----------------------------------------------------------- */

export function RuleComposer({
  draft,
  editing,
  onChange,
  onSave,
  onCancel,
}: {
  draft: RuleDraft;
  editing?: boolean;
  onChange: (d: RuleDraft) => void;
  onSave: (d: RuleDraft) => void;
  onCancel: () => void;
}) {
  const set = (patch: Partial<RuleDraft>) => onChange({ ...draft, ...patch });
  const segments = sentenceSegments(draft);
  const issues = draftIssues(draft);
  const ok = canSave(draft);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-heading text-sm font-semibold">
        {editing ? "Edit rule" : "New rule"}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Read it out loud before you save it. Every highlighted word is a choice.
      </p>

      {/* Сама фраза. Крупнее остального листа нарочно: это главный объект
          экрана, и человек должен читать её, а не искать среди подписей. */}
      <p className="mt-3 text-base leading-loose text-muted-foreground">
        {composerNodes(segments, draft, set)}
      </p>

      {/* ПОЛЯ «Meta id» ЗДЕСЬ БОЛЬШЕ НЕТ. Номер объекта выбирается вместе с
          именем в самой фразе (`TargetPicker`) и показывается ниже, рядом с
          выбранным именем, — а не набирается руками из Ads Manager.
          Осталось имя ПРАВИЛА: это не имя цели, а подпись, которой правило
          назовётся в журнале, и по умолчанию ею становится сама фраза. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Rule name (optional)</span>
          <input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="the sentence above"
            className="h-8 w-56 rounded-md border border-border bg-input px-2 text-xs outline-none focus-visible:border-focus"
          />
        </label>
        {/* id ВЫБРАННОЙ ЦЕЛИ на виду, хотя человек его и не вводит. Имя мы
            храним снимком (см. `Rule.targetName`), и после переименования в
            Мете оно устареет; видимый id — то, чем это расхождение можно
            заметить и проверить в Ads Manager. */}
        {draft.targetId ? (
          <span className="font-mono text-2xs text-faint">{draft.targetId}</span>
        ) : null}
      </div>

      <Outcome draft={draft} issues={issues} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <RacButton
          isDisabled={!ok}
          onPress={() => onSave(draft)}
          className={cn(
            "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            ok
              ? "cursor-pointer bg-primary text-primary-foreground hover:bg-primary-hover"
              : "cursor-default bg-secondary text-faint"
          )}
        >
          {editing ? "Save changes" : "Save — it starts off"}
        </RacButton>
        <RacButton
          onPress={onCancel}
          className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-border px-3.5 text-sm text-muted-foreground transition-colors hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Cancel
        </RacButton>
        {!ok ? (
          <span className="text-2xs text-warning">
            Fill the highlighted words first.
          </span>
        ) : null}
      </div>
    </section>
  );
}

/** Фраза конструктора целиком.
 *
 *  Единственная хитрость — знак препинания, стоящий сразу за чипом: он
 *  уезжает на перенос вместе с чипом. Одинокая точка в начале строки видна
 *  первой и разваливает ровно то впечатление, ради которого фраза и
 *  собрана. Проверено смотрелкой: до этой правки «every 30 min» и точка
 *  расходились по разным строкам. */
function composerNodes(
  segments: RuleSentenceSegment[],
  draft: RuleDraft,
  set: (patch: Partial<RuleDraft>) => void
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let carried = 0; // сколько символов начала текущего текста уже уехали с чипом

  segments.forEach((s, i) => {
    if (!s.slot) {
      const text = s.text.slice(carried);
      carried = 0;
      if (text) out.push(<span key={i}>{text}</span>);
      return;
    }
    const next = segments[i + 1];
    const tail = next && !next.slot ? /^[,.]/.exec(next.text)?.[0] : undefined;
    carried = tail ? tail.length : 0;
    out.push(
      <span key={i} className="whitespace-nowrap">
        {renderSlot(s, draft, set)}
        {tail}
      </span>
    );
  });

  return out;
}

/** Кусок фразы → контрол. Switch по слоту, а не по индексу: порядок слов
 *  живёт в `sentenceSegments`, и добавление слова туда не должно требовать
 *  правки здесь. */
function renderSlot(
  s: RuleSentenceSegment,
  draft: RuleDraft,
  set: (patch: Partial<RuleDraft>) => void
): React.ReactNode {
  if (!s.slot) return <span>{s.text}</span>;

  switch (s.slot) {
    case "action":
      return (
        <ChoiceChip
          label={s.text}
          title="What the rule does"
          options={RULE_ACTIONS.map((a) => ({
            id: a,
            label: RULE_ACTION_LABEL[a],
            hint: a === "pause" ? "stops it spending" : "starts it spending again",
          }))}
          onChange={(v) => set({ action: v as RuleAction })}
        />
      );
    case "scope":
      return (
        <ChoiceChip
          label={s.text}
          title="Which level it watches"
          options={RULE_SCOPES.map((sc) => ({ id: sc, label: RULE_SCOPE_LABEL[sc] }))}
          onChange={(v) => set({ scope: v as RuleScope })}
        />
      );
    case "target":
      /* Имя И id ставятся одним действием — см. шапку `TargetPicker`. Свободный
         ввод имени, стоявший здесь раньше, не трогал id вовсе: правило могло
         звать один объект и называться именем другого. */
      return (
        <TargetPicker
          scope={draft.scope}
          targetId={draft.targetId}
          targetName={draft.targetName}
          onPick={(t) => set({ targetId: t.id, targetName: t.name })}
        />
      );
    case "metric":
      return (
        <ChoiceChip
          label={s.text}
          title="Which metric it measures"
          options={RULE_METRICS.map((m) => ({ id: m, label: RULE_METRIC_LABEL[m] }))}
          onChange={(v) => set({ metric: v as RuleMetric })}
        />
      );
    case "window":
      return (
        <ChoiceChip
          label={s.text}
          title="The window the metric is measured over"
          options={RULE_WINDOWS.map((h) => ({ id: String(h), label: windowLabel(h) }))}
          onChange={(v) => set({ windowHours: Number(v) })}
        />
      );
    case "comparator":
      return (
        <ChoiceChip
          label={s.text}
          title="Which way the value is compared"
          options={RULE_COMPARATORS.map((c) => ({
            id: c,
            label: RULE_COMPARATOR_LABEL[c],
            hint: c === "gte" ? "fires when it goes up to that" : "fires when it drops to that",
          }))}
          onChange={(v) => set({ comparator: v as RuleComparator })}
        />
      );
    case "value": {
      const unit = RULE_METRIC_UNIT[draft.metric];
      return (
        <InlineInput
          value={draft.value === null ? "" : String(draft.value)}
          onChange={(v) => {
            const clean = v.replace(/[^\d.]/g, "");
            set({ value: clean === "" ? null : Number(clean) });
          }}
          placeholder="…"
          label="The number the metric is compared against"
          prefix={unit || undefined}
          inputMode="decimal"
          missing={draft.value === null}
          min={2}
        />
      );
    }
    case "interval":
      return (
        <ChoiceChip
          label={s.text}
          title="How often the rule is checked"
          options={RULE_INTERVALS.map((m) => ({ id: String(m), label: formatCheckInterval(m) }))}
          onChange={(v) => set({ checkIntervalMin: Number(v) })}
        />
      );
  }
}

/** «Что произойдёт» — до сохранения, а не после срабатывания. */
function Outcome({
  draft,
  issues,
}: {
  draft: RuleDraft;
  issues: ReturnType<typeof draftIssues>;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-elevated px-3 py-2.5">
      <div className="text-xs font-medium">What will happen</div>
      <ul className="mt-1.5 flex flex-col gap-1">
        {outcomeLines(draft).map((line, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-1.5 size-1 flex-none rounded-full bg-muted-foreground" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {issues.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
          {issues.map((issue, i) => (
            <li
              key={i}
              className={cn(
                "flex items-start gap-1.5 text-xs leading-relaxed",
                issue.kind === "blocker" ? "text-warning" : "text-warning"
              )}
            >
              <TriangleAlert className="mt-px size-3.5 flex-none" strokeWidth={1.8} aria-hidden />
              <span>
                {issue.kind === "blocker" ? null : (
                  <span className="font-medium">Heads up: </span>
                )}
                {issue.text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* --- Плашки и хвосты листа -------------------------------------------------- */

/** Баннер сверху, один раз, крупно. Не про конкретное правило — про то, что
 *  СЕГОДНЯ верно для всех них разом: воркера нет, и включённый тумблер
 *  ничего не запускает. Молчать об этом значило бы рисовать рабочий механизм
 *  там, где его физически нет. */
function EngineNotice() {
  return (
    /* ТОН СПОКОЙНЫЙ, А НЕ ТРЕВОЖНЫЙ, и это не смягчение правды. Тревожный цвет
       обещает, что случилось что-то внезапное и человек может это починить;
       здесь ни того, ни другого: воркера ещё не написали, состояние постоянное,
       и от владельца не зависит ничего. Янтарная плашка, висящая на каждом
       заходе месяцами, приучает не читать янтарные плашки — и тогда настоящая
       авария на соседнем листе пройдёт мимо глаз. Сам факт остаётся дословно и
       уходит только вместе с причиной. */
    <div role="status" className="rounded-lg border border-border bg-elevated px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 flex-none text-muted-foreground" strokeWidth={1.8} aria-hidden />
        <div className="min-w-0">
          <div className="text-xs font-medium">The automation engine is not running</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Nothing checks a metric or acts on an object today, no matter what a rule&apos;s own
            switch says. A rule turned on right now reads{" "}
            <span className="font-medium text-foreground">{ruleStateLabel("no_engine")}</span>, not{" "}
            {ruleStateLabel("waiting").toLowerCase()} — this holds for every rule until a server is
            deployed to run the scheduled checks. {STORAGE_NOTE}
          </p>
        </div>
      </div>
    </div>
  );
}

export function EmptyRules({ onNew }: { onNew: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm font-medium">No rules yet</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
        A rule is one sentence, and it always reads the same way:
      </p>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Pause</span> the{" "}
        <span className="font-medium text-foreground">ad set</span>{" "}
        <span className="font-medium text-foreground">“Rome_CPL”</span> when its{" "}
        <span className="font-medium text-foreground">CPL</span> over{" "}
        <span className="font-medium text-foreground">the last 24 hours</span> is{" "}
        <span className="font-medium text-foreground">at least</span>{" "}
        <span className="font-medium text-foreground">$12</span>, checked{" "}
        <span className="font-medium text-foreground">every 30 min</span>.
      </p>
      <RacButton
        onPress={onNew}
        className="mt-4 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-primary-line bg-primary-soft px-3 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-soft/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Plus className="size-4" strokeWidth={2} aria-hidden />
        Write your first rule
      </RacButton>
    </section>
  );
}

/** Журнал авто-действий: что правило сделало, по какой цифре — и как вернуть.
 *
 *  ПОЧЕМУ ЖУРНАЛ НЕ «ЛОГ ДЛЯ ОТЛАДКИ». Прямое требование владельца: правило
 *  потушило объект — человек видит ЧТО, КОГДА и ПО КАКОЙ ЦИФРЕ и возвращает
 *  обратно ОДНИМ нажатием, не разбираясь в Ads Manager. Без последнего
 *  автоматика превращается в то, с чем спорят руками.
 *
 *  ПУСТОЙ ОН СЕГОДНЯ ЧЕСТНО, а не «пока не подключили»: ни одного авто-действия
 *  не происходило, потому что происходить нечему — воркера нет. Секция стоит
 *  всё равно, чтобы место, где это будет видно, было названо ДО первого
 *  срабатывания, а не после.
 *
 *  Слова и правила отката живут в `lib/rules-log`, здесь только показ. Кнопка
 *  называется тем, что СДЕЛАЕТ («Turn back on»), а не словом «откатить»: на
 *  правиле-тушителе и правиле-включателе «Revert» читается одинаково и не
 *  говорит, что произойдёт. */
function Journal({ entries = [], rules = [], onRevert }: {
  entries?: readonly RuleLogEntry[];
  rules?: readonly Rule[];
  onRevert?: (id: string) => void;
}) {
  const rows = sortLog(entries);
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5">
        <ScrollText className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden />
        <h2 className="font-heading text-sm font-semibold">Action log</h2>
        {rows.length ? (
          <span className="text-2xs text-faint">
            {rows.length === 1 ? "1 action" : `${rows.length} actions`}
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Nothing has ever fired: no rule has run, because no engine has run. When one does,
          every pause and resume lands here with the rule that did it, the metric and the value
          that crossed the line — and one press puts the object back the way it was.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {rows.map((e) => {
            const line = logLine(e, rules.find((r) => r.id === e.ruleId));
            const st = revertState(e);
            return (
              <li
                key={e.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-border bg-elevated px-3 py-2"
              >
                <span className="text-xs font-medium text-foreground">{line.what}</span>
                {/* Причина стоит РЯДОМ с действием, а не под курсором: «почему
                    потушено» — первый вопрос, и ради него не открывают
                    подсказку. */}
                <span className="text-2xs text-muted-foreground">{line.why}</span>
                <span className="text-2xs text-faint">by {line.by}</span>
                <time dateTime={e.at} className="text-2xs text-faint">{stamp(e.at)}</time>

                <div className="ml-auto flex items-center gap-2">
                  {/* Отказ Меты — её словами. «Ошибка» здесь не сообщает
                      ничего: причина отказа и есть то, что решает, пробовать
                      снова или идти руками. */}
                  {st === "failed" && e.undoError ? (
                    <span className="text-2xs text-destructive">{e.undoError}</span>
                  ) : null}
                  {st === "done" && e.undoneAt ? (
                    <span className="text-2xs text-success">
                      put back {stamp(e.undoneAt)}
                    </span>
                  ) : !showRevert(e) ? (
                    /* Прежний статус неизвестен — кнопки НЕТ ВОВСЕ, а не
                       погашенная: погашенная обещает, что действие существует
                       и когда-нибудь станет доступным. Вернуть вслепую хуже,
                       чем не вернуть. */
                    <span
                      className="text-2xs text-faint"
                      title="We do not know what this object's status was before the rule fired, so there is nothing to restore it to."
                    >
                      cannot be undone
                    </span>
                  ) : (
                    <RacButton
                      isDisabled={!canRevert(e) || !onRevert}
                      onPress={() => onRevert?.(e.id)}
                      className={cn(
                        "focus-ring rounded-md border border-border px-2 py-1 text-2xs",
                        "text-muted-foreground transition-colors duration-150",
                        "hover:bg-hover hover:text-foreground disabled:opacity-50",
                      )}
                    >
                      {revertLabel(st, e.statusBefore)}
                    </RacButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Глоссарий восьми состояний. Не таблица «ваших правил» — таблица того, что
 *  ЗНАЧАТ восемь возможных состояний. Свёрнут: человеку с работающими
 *  правилами он не нужен каждый день, а на первом знакомстве — нужен весь. */
export function StateGlossary({ defaultOpen }: { defaultOpen?: boolean }) {
  return (
    <Expandable
      defaultOpen={defaultOpen}
      summary={
        <span className="text-sm font-medium">
          How rule states work{" "}
          <span className="text-xs font-normal text-muted-foreground">
            — eight states, five buckets
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-2 px-3 pb-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          A rule is in exactly one state at a time. The list above groups them into the five
          buckets you actually act on:{" "}
          {RULE_BUCKETS.map((b) => RULE_BUCKET_LABEL[b]).join(", ")}.
        </p>
        {RULE_STATES.map((state) => {
          const tone = ruleStateTone(state);
          const t = TONE_CLASS[tone];
          const label = ruleStateLabel(state);
          const bucket = RULE_BUCKET_LABEL[ruleBucket(state)];
          return (
            <div key={state} className={cn("rounded-lg border px-3 py-2.5", t.border, t.bg)}>
              <div className="flex items-center gap-1.5">
                <StateDot tone={tone} />
                <span className={cn("text-xs font-medium", t.text)}>{label}</span>
                {bucket !== label ? (
                  <span className="text-2xs text-faint">· {bucket}</span>
                ) : null}
                <code className="ml-auto font-mono text-2xs text-faint">{state}</code>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {ruleStateDescription(state)}
              </p>
            </div>
          );
        })}
      </div>
    </Expandable>
  );
}

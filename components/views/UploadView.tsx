"use client";

/* Лист «Аплоад» — два экрана.
 *
 *  КАРТА: строка — настройка, столбец — группа. Группы широкие и их мало,
 *  настроек много и они узкие, поэтому матрица лежит именно так: колонка
 *  читается сверху вниз как связка целиком, строка — как сравнение одной
 *  настройки через все группы.
 *
 *  НАСТРОЙКА: карта уходит совсем, остаётся одна группа с шагами. Секции здесь
 *  НЕ переписаны — это те же компоненты, что и в конструкторе, подменена только
 *  форма под ними (`FormScopeProvider`). Поэтому «в аплоаде настройки беднее»
 *  невозможно: поле физически одно на оба листа.
 */

import * as React from "react";
import { useMemo } from "react";
import { ArrowLeft, ArrowRight, BookmarkPlus, Check, ChevronDown, ChevronsDownUp, CopyCheck, CopyPlus, Layers, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/coss";
import { SelectField } from "@/components/studio/control";
import { FormScopeProvider } from "@/components/studio/form-scope";
import { PresetManager } from "@/components/presets/PresetManager";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import { EDITOR_STEPS, SECTIONS, majoritySection, sectionKey } from "@/lib/upload-map";
import {
  commonPixels, linkOf, membersByStatus, missingOf, nCabs, nGroups, nObjects, nSocials,
  objectsOfGroup, pixelOf, resolveSnapshotMember, tailOf,
} from "@/lib/groups";
import { AttentionChips } from "@/components/sections/health-bits";
import { Goal } from "@/components/sections/Goal";
import { Structure } from "@/components/sections/Structure";
import { Budget } from "@/components/sections/Budget";
import { Targeting } from "@/components/sections/Targeting";
import { Placements } from "@/components/sections/Placements";
import { PageOffer } from "@/components/sections/PageOffer";
import { Creatives } from "@/components/sections/Creatives";
import { Naming } from "@/components/sections/Naming";
import { Launch } from "@/components/sections/Launch";
import { Notes } from "@/components/sections/Notes";
import type { CabGroup, GroupMember, SnapshotAccount } from "@/lib/types";
import { cn } from "@/lib/utils";

const BODY: Record<string, React.ComponentType> = {
  goal: Goal,
  structure: Structure,
  budget: Budget,
  targeting: Targeting,
  placements: Placements,
  page: PageOffer,
  creatives: Creatives,
  naming: Naming,
  launch: Launch,
  notes: Notes,
};

export function UploadView() {
  const groups = useStore((s) => s.cabGroups);
  const active = useStore((s) => s.activeGroup);
  const group = groups.find((g) => g.id === active) || null;

  if (!groups.length) return <NoGroups />;
  return group ? <Editor group={group} /> : <MapScreen />;
}

/* ─────────────────────────── карта ─────────────────────────── */

function MapScreen() {
  const router = useRouter();
  const groups = useStore((s) => s.cabGroups);
  const snapshot = useStore((s) => s.snapshot);
  const setActive = useStore((s) => s.setActiveGroup);
  const patchForm = useStore((s) => s.patchGroupForm);
  const [row, setRow] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  const forms = useMemo(() => groups.map((g) => g.form), [groups]);
  /** Секции, одинаковые у ВСЕХ групп, уезжают в полосу сверху: пять одинаковых
   *  ячеек в сетке не несут информации, а место занимают. */
  const same = useMemo(
    () =>
      groups.length > 1
        ? SECTIONS.filter((s) => new Set(forms.map((f) => sectionKey(s, f))).size === 1)
        : [],
    [groups.length, forms]
  );
  const sameIds = new Set(same.map((s) => s.id));
  const shown = showAll ? SECTIONS : SECTIONS.filter((s) => !sameIds.has(s.id));

  const totalCabs = groups.reduce((n, g) => n + g.members.length, 0);
  const totalObjects = groups.reduce((n, g) => n + objectsOfGroup(g), 0);
  /* Не число «сколько не готово», а ЧТО ИМЕННО не готово в каждой группе.
     Числом это стояло здесь раньше, рядом с выключенной кнопкой, и вместе они
     давали тупик: человек видит «1 group not ready», жмёт «Build prompt» и не
     получает ничего — ни перехода, ни причины, ни адреса, куда идти чинить. */
  const blocked = useMemo(
    () => groups.map((g) => ({ g, missing: missingOf(g, snapshot) })).filter((x) => x.missing.length),
    [groups, snapshot]
  );

  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-5")}>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-3.5 py-2.5">
          <h1 className="font-heading text-sm font-semibold">Upload</h1>
          {!!same.length && (
            <Button variant="ghost" size="xs" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "differences only" : `all ${SECTIONS.length}`}
            </Button>
          )}
          <span className="tnum ml-auto text-xs text-muted-foreground">
            {nGroups(groups.length)} · {nCabs(totalCabs)} · {nObjects(totalObjects)}
          </span>
          {row && (
            <Button variant="ghost" size="xs" onClick={() => setRow(null)}>
              clear
            </Button>
          )}
        </header>

        {!!same.length && !showAll && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3.5 py-2">
            <span className="microlabel text-2xs text-faint">same in all groups</span>
            {same.map((s) => {
              const sum = s.summary(forms[0]);
              return (
                <span
                  key={s.id}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {s.label.toLowerCase()} <b className="font-medium text-foreground">{sum.v}</b>
                </span>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto">
          <div
            className="grid min-w-max"
            style={{ gridTemplateColumns: `112px repeat(${groups.length}, minmax(150px, 1fr))` }}
          >
            {/* шапка */}
            <div className="border-b border-border-strong" />
            {groups.map((g) => {
              const missing = missingOf(g, snapshot);
              return (
                /* Не одна кнопка на всю ячейку, как было: внутрь встали
                   действия над группой, а кнопка в кнопке — невалидная
                   разметка, при которой внешняя съедает нажатия внутренней. */
                <div key={g.id} className="relative border-b border-l border-border-strong">
                  <button
                    onClick={() => setActive(g.id)}
                    className="w-full px-3 py-2.5 pr-20 text-left transition-colors duration-150 hover:bg-hover"
                  >
                    <div className="truncate text-sm font-medium">{g.name}</div>
                    <div className="tnum truncate text-2xs text-muted-foreground">
                      {nCabs(g.members.length)} ·{" "}
                      {nSocials(new Set(g.members.map((m) => m.profile)).size)}
                    </div>
                    <div className="mt-1.5 flex gap-0.5" aria-hidden>
                      {SECTIONS.map((s) => (
                        <span
                          key={s.id}
                          className={cn(
                            "size-1.5 rounded-[1px]",
                            missing.length && isMissingSection(s.id, missing)
                              ? "bg-destructive"
                              : "bg-muted-foreground/35"
                          )}
                        />
                      ))}
                    </div>
                    {/* Не блокирует, поэтому отдельно от красных точек выше:
                        каб на ревью у Меты / с непонятным статусом / которого
                        нет в снапшоте — то, о чём молчал buildBundle, считая
                        группу тихо готовой. */}
                    <AttentionChips st={membersByStatus(g, snapshot)} className="mt-1.5" />
                  </button>
                  <GroupActions group={g} stayOnMap className="absolute right-1.5 top-1.5" />
                </div>
              );
            })}

            {/* строки */}
            {shown.map((s) => {
              const hot = row === s.id;
              return (
                <React.Fragment key={s.id}>
                  <button
                    onClick={() => setRow(hot ? null : s.id)}
                    className={cn(
                      "flex items-center justify-end gap-2 border-b border-border px-3 py-2 text-right transition-colors duration-150",
                      hot ? "text-primary-ink" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="microlabel text-2xs">{s.label.toLowerCase()}</span>
                    <span
                      className={cn("h-3 w-0.5 rounded-full", hot ? "bg-primary" : "bg-transparent")}
                    />
                  </button>
                  {groups.map((g) => {
                    const sum = s.summary(g.form);
                    const eq =
                      groups.length > 1 &&
                      groups.filter((x) => sectionKey(s, x.form) === sectionKey(s, g.form)).length >
                        groups.length / 2;
                    return (
                      <button
                        key={g.id + s.id}
                        onClick={() => setActive(g.id)}
                        className={cn(
                          "min-w-0 border-b border-l border-border px-3 py-2 text-left transition-colors duration-150 hover:bg-hover",
                          hot && "bg-primary-soft"
                        )}
                      >
                        <div
                          className={cn(
                            "truncate text-[13px]",
                            eq ? "text-faint" : "text-foreground"
                          )}
                        >
                          {sum.v}
                        </div>
                        {hot && sum.n && (
                          <div className="truncate text-2xs text-muted-foreground">{sum.n}</div>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {row && (
          <div className="flex flex-wrap items-center gap-2 border-t border-primary-line bg-primary-soft px-3.5 py-2 text-xs">
            <span className="font-medium">{SECTIONS.find((s) => s.id === row)?.label}</span>
            <span className="text-muted-foreground">across all groups</span>
            <Button
              variant="outline"
              size="xs"
              className="ml-auto"
              onClick={() => {
                const sec = SECTIONS.find((s) => s.id === row);
                if (!sec) return;
                const patch = majoritySection(sec, forms);
                if (!patch) return;
                for (const g of groups) patchForm(g.id, patch);
              }}
            >
              Align to majority
            </Button>
          </div>
        )}

        <footer className="flex flex-col gap-2 border-t border-border px-3.5 py-2.5">
          {/* ПОЧЕМУ КНОПКА НЕ РАБОТАЕТ — ЗДЕСЬ, А НЕ В ГОЛОВЕ У ЧЕЛОВЕКА.
              Раньше на этом месте стояло «N groups not ready» и выключенная
              кнопка рядом. Куда идти чинить и что именно чинить — не говорил
              никто, а сама кнопка при этом выглядела рабочей (см. `.accent-fill`
              в globals.css). Строка группы кликабельна: она и есть дорога к
              починке. */}
          {!!blocked.length && (
            <div className="rounded-lg border border-destructive/30 bg-destructive-soft px-2.5 py-2">
              <p className="text-2xs font-medium text-destructive">
                Not ready — the prompt is blocked until this is filled in
              </p>
              <div className="mt-1 flex flex-col gap-0.5">
                {blocked.map(({ g, missing }) => (
                  <button
                    key={g.id}
                    onClick={() => setActive(g.id)}
                    className="focus-ring rounded text-left text-2xs text-destructive/90 transition-colors duration-150 hover:text-destructive"
                  >
                    <b className="font-medium">{g.name}</b> — {missing.join(", ")}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="tnum text-xs text-muted-foreground">
              Will create {nObjects(totalObjects)} across {nCabs(totalCabs)}
              {blocked.length > 0 && ` · ${nGroups(blocked.length)} not ready`}
            </span>
            {/* Дальше по пути стоит превью с кнопкой копирования — но пускать
                туда неготовую связку незачем: единственное, что там можно
                сделать, всё равно запрещено. */}
            <Button
              className="ml-auto"
              disabled={blocked.length > 0}
              onClick={() => router.push("/preview")}
            >
              Build prompt
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Продублировать и удалить группу.
 *
 *  ЗАЧЕМ ОТДЕЛЬНЫЙ КОМПОНЕНТ И ПОЧЕМУ ОН ВООБЩЕ ПОЯВИЛСЯ. Обе операции жили в
 *  сторе (`duplicateCabGroup`, `deleteCabGroup`) с тестами и без единой кнопки:
 *  `AccountsView` их даже доставал из стора и не вызывал. То есть для человека
 *  их не существовало — группу нельзя было ни размножить, ни выбросить, и
 *  оставалось только заводить её заново с листа кабинетов. Словами владельца:
 *  «группы заливок, которые я создаю, нельзя ни продублировать, ни удалить».
 *
 *  Кнопки видны ВСЕГДА, а не по наведению: жалоба была именно на то, что
 *  действия не найти, а спрятанное по hover не находится и не существует на
 *  тачскрине.
 *
 *  Удаление — в два нажатия, без диалога. Группа несёт связку целиком и три
 *  десятка кабинетов, отменить её удаление нечем; диалог же ради этого тянуть
 *  дороже, чем взвести кнопку на несколько секунд. */
function GroupActions(
  { group, stayOnMap, className }: { group: CabGroup; stayOnMap?: boolean; className?: string },
) {
  const duplicate = useStore((s) => s.duplicateCabGroup);
  const remove = useStore((s) => s.deleteCabGroup);
  const setActive = useStore((s) => s.setActiveGroup);
  const [armed, setArmed] = React.useState(false);

  /* Взвод сам спадает: кнопка «точно?», оставшаяся на экране навсегда, рано или
     поздно ловит случайное нажатие — и это ровно то, от чего она заведена. */
  React.useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  const кнопка =
    "focus-ring grid size-7 flex-none place-items-center rounded-md text-muted-foreground " +
    "transition-colors duration-150 hover:bg-hover hover:text-foreground";

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <button
        type="button"
        onClick={() => {
          duplicate(group.id);
          /* Со списка групп остаёмся в списке: копия видна там же, рядом.
             Стор уводит в её настройку, и это верно, когда дублируешь ИЗ
             настройки, — но не когда смотришь карту. */
          if (stayOnMap) setActive(null);
        }}
        title={`Duplicate “${group.name}” with all its settings`}
        aria-label={`Duplicate ${group.name}`}
        className={кнопка}
      >
        <CopyPlus className="size-3.5" strokeWidth={1.6} aria-hidden />
      </button>
      {armed ? (
        <button
          type="button"
          onClick={() => remove(group.id)}
          title={`Delete “${group.name}” — this cannot be undone`}
          className="focus-ring h-7 flex-none rounded-md border border-destructive/40 bg-destructive-soft px-1.5
                     text-2xs font-medium text-destructive transition-colors duration-150 hover:bg-destructive/15"
        >
          delete?
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          title={`Delete “${group.name}”`}
          aria-label={`Delete ${group.name}`}
          className={cn(кнопка, "hover:text-destructive")}
        >
          <Trash2 className="size-3.5" strokeWidth={1.6} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Дырка секции: сопоставляем причину из `missingOf` с секцией, где её чинят.
 *
 *  Причина приходит из `missingOf` (lib/groups.ts) готовой человеческой строкой,
 *  поэтому принимаем оба написания — русское и английское. Иначе переименование
 *  причины в одном файле молча гасит красные метки в другом. */
function isMissingSection(id: string, missing: string[]): boolean {
  const has = (...words: string[]) => missing.some((m) => words.includes(m));
  if (id === "creatives") return has("креативы", "creatives");
  if (id === "targeting") return has("гео", "geo");
  if (id === "budget") return has("бюджет", "budget");
  if (id === "page") return has("ссылка", "link");
  return false;
}

/* ────────────────────────── настройка ────────────────────────── */

function Editor({ group }: { group: CabGroup }) {
  const groups = useStore((s) => s.cabGroups);
  const snapshot = useStore((s) => s.snapshot);
  const setActive = useStore((s) => s.setActiveGroup);
  const setField = useStore((s) => s.setGroupField);
  const patch = useStore((s) => s.patchGroupForm);
  const copyForm = useStore((s) => s.copyGroupForm);
  const applyPreset = useStore((s) => s.applyPresetToGroup);
  const presets = useStore((s) => s.userPresets);
  const [stepId, setStepId] = React.useState(EDITOR_STEPS[0].id);
  const [all, setAll] = React.useState(false);
  /* Менеджер пресетов рисуется здесь, а не в оболочке: из шапки его убрали
     (кнопка на всех листах, а применять пресет негде, кроме этого), и вход
     остался только в палитре ⌘K — то есть для человека исчез совсем. */
  const [presetsOpen, setPresetsOpen] = React.useState(false);

  const i = Math.max(0, EDITOR_STEPS.findIndex((s) => s.id === stepId));
  const step = EDITOR_STEPS[i];
  const missing = missingOf(group, snapshot);

  const scope = useMemo(
    () => ({
      form: group.form,
      set: <K extends keyof CabGroup["form"]>(k: K, v: CabGroup["form"][K]) =>
        setField(group.id, k, v),
      patch: (p: Partial<CabGroup["form"]>) => patch(group.id, p),
      scope: "group" as const,
      goStep: (id: string) => {
        setStepId(id);
        setAll(false);
      },
      profiles: [...new Set(group.members.map((m) => m.profile))],
    }),
    [group.form, group.id, group.members, setField, patch]
  );

  const Body = BODY[step.id];

  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-5")}>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center gap-2.5 border-b border-border px-3.5 py-2.5">
          <Button variant="ghost" size="xs" onClick={() => setActive(null)}>
            <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
            all groups
          </Button>
          <h1 className="text-sm font-semibold">{group.name}</h1>
          <span className="tnum text-xs text-muted-foreground">
            {nCabs(group.members.length)} ·{" "}
            {nSocials(new Set(group.members.map((m) => m.profile)).size)} ·{" "}
            {nObjects(objectsOfGroup(group))}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!!Object.keys(presets).length && (
              <div className="w-[160px]">
                <SelectField
                  value=""
                  placeholder="from preset"
                  onChange={(n) => n && applyPreset(group.id, n)}
                  options={Object.keys(presets).map((n) => ({ value: n, label: n }))}
                />
              </div>
            )}
            {groups.length > 1 && (
              <div className="w-[190px]">
                <SelectField
                  value=""
                  placeholder="copy from"
                  onChange={(id) => id && copyForm(id, group.id)}
                  options={groups
                    .filter((g) => g.id !== group.id)
                    .map((g) => ({ value: g.id, label: g.name }))}
                />
              </div>
            )}
            {/* Парная операция к «из пресета» и стоит с ней рядом: одна кладёт
                сетап в связку, вторая забирает его из связки в пресет. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetsOpen(true)}
              title={`Save the settings of bundle “${group.name}” as a preset`}
            >
              <BookmarkPlus className="size-4" strokeWidth={1.6} aria-hidden />
              save preset
            </Button>
            {/* Те же два действия, что и на карте: дубль чаще всего делают из
                уже настроенной группы — чтобы поменять в копии одно поле. */}
            <GroupActions group={group} />
          </div>
        </header>

        {/* Шаги переносятся, а не прокручиваются: горизонтальный скроллбар под
            навигацией читается как поломка вёрстки, а на широком экране все
            девять всё равно встают в строку. */}
        <nav className="flex flex-wrap gap-0 border-b border-border px-2" aria-label="Bundle steps">
          {EDITOR_STEPS.map((s, n) => {
            const on = !all && s.id === step.id;
            const bad = isMissingSection(s.id, missing);
            return (
              <button
                key={s.id}
                onClick={() => {
                  setStepId(s.id);
                  setAll(false);
                }}
                aria-current={on ? "step" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-xs transition-colors duration-150",
                  on
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("tnum text-2xs", on ? "text-primary-ink" : "text-ghost")}>
                  {String(n + 1).padStart(2, "0")}
                </span>
                {s.label}
                {bad && <span className="size-1.5 rounded-full bg-destructive" aria-label="missing" />}
              </button>
            );
          })}
        </nav>

        <FormScopeProvider value={scope}>
          <div className="px-3.5 py-3.5">
            {all ? (
              <>
                <CabsStep group={group} />
                {SECTIONS.map((s) => {
                  const B = BODY[s.id];
                  return <B key={s.id} />;
                })}
              </>
            ) : (
              /* Своя шапка шага + скрытая шапка карточки.
                 У секций конструктора номер прибит свой («03 Цель») — он от
                 старого порядка листа «Сетап». Рядом с моим «шаг 1 из 9» это
                 читалось как два разных номера у одной секции. В пошаговом
                 режиме прячем триггер карточки: сворачивать там нечего, секция
                 на экране одна. В режиме «все секции разом» шапки нужны и
                 остаются. */
              <div className="[&_[data-section]]:border-0 [&_[data-section]]:bg-transparent [&_[data-section]]:px-0 [&_[data-section]]:shadow-none [&_[slot=trigger]]:hidden [&_[data-section]_[data-slot=panel]]:border-0">
                <header className="mb-3 flex items-baseline gap-2.5">
                  <span className="tnum text-2xs tracking-widest text-primary-ink">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-heading text-lg font-semibold leading-none">{step.label}</h2>
                  <span className="tnum ml-auto text-xs text-muted-foreground">
                    step {i + 1} of {EDITOR_STEPS.length}
                  </span>
                </header>
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{step.why}</p>
                {step.id === "cabs" ? <CabsStep group={group} /> : Body ? <Body /> : null}
              </div>
            )}
          </div>
        </FormScopeProvider>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-2.5">
          {i > 0 && !all && (
            <Button variant="ghost" size="sm" onClick={() => setStepId(EDITOR_STEPS[i - 1].id)}>
              <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
              {EDITOR_STEPS[i - 1].label}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
              {all ? "step by step" : "all sections at once"}
            </Button>
            {i < EDITOR_STEPS.length - 1 && !all ? (
              <Button size="sm" onClick={() => setStepId(EDITOR_STEPS[i + 1].id)}>
                {EDITOR_STEPS[i + 1].label}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setActive(null)}>
                Done
              </Button>
            )}
          </div>
        </footer>
      </div>

      <PresetManager
        open={presetsOpen}
        onOpenChange={setPresetsOpen}
        fromGroup={group.id}
        fromLabel={group.name}
      />
    </div>
  );
}

function NoGroups() {
  const router = useRouter();
  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-16 text-center")}>
      <Layers className="mx-auto size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      <p className="mt-2 text-sm font-medium">No groups yet</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
        A bundle is set up for a group of ad accounts. Select ad accounts on the Accounts page and
        build the first group.
      </p>
      <Button className="mt-3" onClick={() => router.push("/accounts")}>
        Go to accounts
      </Button>
    </div>
  );
}

/** Состав группы и пиксель по каждому кабинету.
 *
 *  Отдельный шаг, а не поле формы, потому что пиксель принадлежит КАБИНЕТУ, а не
 *  связке: в одну группу попадают кабы разных агентств, и общий пиксель им не
 *  подходит. Общий `auto` тоже не всегда спасает — он берёт первый пиксель
 *  кабинета, а их бывает несколько.
 *
 *  Список пикселей берётся из снапшота, то есть из того, что кабинет реально
 *  отдал. Если снапшот пикселей этого каба не знает, честно говорим об этом и
 *  оставляем выбор пустым: подставить сюда чужой id значит залить не туда.
 */
function CabsStep({ group }: { group: CabGroup }) {
  /* Какие строки раскрыты. Изначально — те, у кого УЖЕ есть своё значение:
     спрятанное переопределение, которое едет в залив, — худший вид тишины. */
  const [открытые, setОткрытые] = React.useState<Set<string>>(
    () => new Set(group.members.filter((m) => m.link || m.tail).map((m) => `${m.profile}:${m.act}`)),
  );
  const переключить = React.useCallback((key: string) => {
    setОткрытые((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }, []);
  const snapshot = useStore((s) => s.snapshot);
  const setAllPixels = useStore((s) => s.setAllMemberPixels);

  const byProfile = useMemo(() => {
    const m = new Map<string, GroupMember[]>();
    for (const x of group.members) m.set(x.profile, [...(m.get(x.profile) || []), x]);
    return [...m];
  }, [group.members]);

  const common = useMemo(() => commonPixels(group, snapshot), [group, snapshot]);
  const own = group.members.filter((m) => m.pixel).length;

  const resolutionOf = (m: GroupMember) => resolveSnapshotMember(m, snapshot);

  return (
    <div className="flex flex-col gap-4">
      {/* Кабы одного агентства делят пиксель — назначать его семь раз подряд
          глупо. Предлагаем только те, что есть у КАЖДОГО каба группы: чужой
          пиксель FB не примет, и «применилось не ко всем» было бы хуже, чем
          отсутствие кнопки. */}
      {group.members.length > 1 && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-2">
          <span className="flex-none text-xs text-muted-foreground">pixel for all at once</span>
          <div className="w-[260px]">
            <SelectField
              value=""
              placeholder={common.length ? "select" : "reset to auto"}
              onChange={(v) => v && setAllPixels(group.id, v)}
              options={[
                { value: "auto", label: "auto — first pixel of the ad account" },
                ...common.map((p) => ({
                  value: p.id,
                  label: p.name ? `${p.id} · ${p.name}` : p.id,
                  text: p.id,
                })),
              ]}
            />
          </div>
          <span className="text-2xs text-muted-foreground">
            {!common.length
              ? "no pixel shared by every ad account in the group — set them one by one"
              : own
                ? `${own} of ${group.members.length} have their own pixel`
                : "overwrites the choice on every ad account"}
          </span>

          {/* «Свернуть всё» — то же, что в аналитике. На двух десятках
              кабинетов раскрытые ссылки и хвосты дают экран в три тысячи
              пикселей, по которому потом ищешь ту одну строку, что правил. */}
          <button
            type="button"
            onClick={() => setОткрытые(new Set())}
            disabled={!открытые.size}
            className={cn(
              "focus-ring ml-auto inline-flex flex-none items-center gap-1.5 rounded-md border",
              "border-border px-2 py-1 text-2xs text-muted-foreground",
              "transition-[color,background-color,border-color,transform] duration-150 ease-out",
              "hover:border-border-strong hover:bg-hover hover:text-foreground active:scale-[0.98]",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <ChevronsDownUp className="size-3.5 flex-none" strokeWidth={1.6} aria-hidden />
            Collapse all
            {открытые.size ? <span className="tnum text-ghost">· {открытые.size}</span> : null}
          </button>
        </div>
      )}

      {byProfile.map(([profile, members]) => (
        <section key={profile}>
          <div className="mb-1.5 flex items-baseline gap-2">
            <h3 className="font-mono text-xs">{profile}</h3>
            <span className="text-2xs text-muted-foreground">{nCabs(members.length)}</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            {members.map((m) => {
              const resolution = resolutionOf(m);
              return (
                <CabRow
                  key={`${m.profile}:${m.act}`}
                  group={group}
                  m={m}
                  acc={resolution.status === "exact" ? resolution.account : undefined}
                  mismatch={resolution.status === "exact" ? null : resolution.status}
                  open={открытые.has(`${m.profile}:${m.act}`)}
                  onToggle={переключить}
                />
              );
            })}
          </div>
        </section>
      ))}

      {!group.members.length && (
        <p className="text-xs text-muted-foreground">
          The group has no ad accounts. Add them on the Accounts page.
        </p>
      )}
    </div>
  );
}

/** Строка кабинета: пиксель всегда на виду, ссылка и хвост — по раскрытию.
 *
 *  Пиксель наверху потому, что он есть у каждого каба и решается всегда. Ссылка
 *  и хвост — исключение для кабов чужого агентства, и три поля в строке подряд
 *  превращали бы обычный случай (у всех всё общее) в стену полей. Строка с уже
 *  заданным переопределением открыта сразу: спрятанное значение, которое едет в
 *  залив, — худший вид тишины. */
function CabRow({
  group, m, acc, mismatch, open, onToggle,
}: {
  group: CabGroup;
  m: GroupMember;
  acc: SnapshotAccount | undefined;
  mismatch: string | null;
  /** Раскрытие живёт НАД строкой, а не внутри: «свернуть всё» обязано
   *  дотянуться до каждой, а из родителя до useState ребёнка дороги нет. */
  open: boolean;
  onToggle: (key: string) => void;
}) {
  const setField = useStore((s) => s.setMemberField);
  const removeMember = useStore((s) => s.removeGroupMember);
  const applyToProfile = useStore((s) => s.applyMemberLinkToProfile);
  /* Сколько кабинетов этого соца в группе. Число уходит и в подпись, и в
     блокировку: кнопка, которая ничего не сделает, не должна быть нажимаемой —
     иначе «нажал и ничего» читается как поломка. */
  const sameProfile = group.members.filter((x) => x.profile === m.profile).length;
  const [разлито, setРазлито] = React.useState(false);
  const pixels = acc?.pixels || [];
  const has = !!(m.link || m.tail);

  const inherited = (v: string) => (v ? `from bundle: ${v}` : "from bundle — empty");

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 transition-colors duration-150 hover:bg-hover">
        <div className="min-w-[180px] flex-1">
          <div className="truncate text-sm">
            {acc?.name || (mismatch
              ? `snapshot ${mismatch.replaceAll("_", " ")}`
              : "ad account not in snapshot")}
          </div>
          <div className="truncate font-mono text-2xs text-muted-foreground">{m.act}</div>
        </div>

        <div className="w-[260px]">
          {pixels.length ? (
            <SelectField
              value={m.pixel || ""}
              onChange={(v) => setField(group.id, m, "pixel", v)}
              options={[
                { value: "", label: "auto — first pixel of the ad account" },
                ...pixels.map((p) => ({
                  value: p.id,
                  label: p.name ? `${p.id} · ${p.name}` : p.id,
                  text: p.id,
                })),
              ]}
            />
          ) : (
            <span className="text-2xs italic text-muted-foreground">
              no pixels for this ad account in the snapshot
            </span>
          )}
        </div>

        <span
          className="w-[150px] truncate font-mono text-2xs text-muted-foreground"
          title={`Will upload with pixel ${pixelOf(m)}`}
        >
          → {pixelOf(m)}
        </span>

        <button
          onClick={() => onToggle(`${m.profile}:${m.act}`)}
          aria-expanded={open}
          className="flex flex-none items-center gap-1 rounded-md px-1.5 py-1 text-2xs text-muted-foreground transition-colors duration-150 hover:bg-hover hover:text-foreground"
        >
          link and URL params
          {has && <span className="size-1.5 rounded-full bg-primary" aria-label="custom value" />}
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
            strokeWidth={1.5}
            aria-hidden
          />
        </button>

        <button
          onClick={() => removeMember(group.id, m)}
          aria-label={`Remove ${m.act} from the group`}
          className="grid size-8 flex-none place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-hover hover:text-destructive"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      {open && (
        <div className="grid gap-2.5 border-t border-border bg-subtle px-3 py-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="microlabel text-2xs text-muted-foreground">link</span>
            <Input
              value={m.link || ""}
              onChange={(e) => setField(group.id, m, "link", e.target.value)}
              placeholder={inherited(group.form.link)}
            />
            <span className="truncate font-mono text-2xs text-muted-foreground">
              → {linkOf(group, m) || "empty"}
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="microlabel text-2xs text-muted-foreground">URL params</span>
            <Input
              value={m.tail || ""}
              onChange={(e) => setField(group.id, m, "tail", e.target.value)}
              placeholder={inherited(group.form.creoUrl)}
            />
            <span className="truncate font-mono text-2xs text-muted-foreground">
              → {tailOf(group, m) || "empty"}
            </span>
          </label>

          {/* Разлив по соцу. Ссылка и хвост у кабинетов одного профиля почти
              всегда одинаковые — это трекер и его метки, — но заполнялись они
              руками по одному, а кабинетов в группе бывает два десятка.

              Именно по соцу, а не на всю группу: трекер и метки у каждого
              профиля свои, и разлив на всю группу отправил бы чужой трафик в
              чужую статистику. Заметить это можно было бы только по нулям в
              отчёте через сутки. */}
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => {
                applyToProfile(group.id, m);
                /* Подтверждение действия, которого не видно.
                   Кнопка меняет ДРУГИЕ строки — те, что сейчас свёрнуты и
                   находятся вне экрана. Без ответа нажатие выглядит как
                   промах, и его повторяют по три раза. */
                setРазлито(true);
                window.setTimeout(() => setРазлито(false), 1600);
              }}
              disabled={sameProfile <= 1}
              title={
                sameProfile <= 1
                  ? "No other ad accounts of this profile in the group"
                  : `Sets this link and these URL params on ${sameProfile - 1} more ad account${
                      sameProfile - 1 === 1 ? "" : "s"
                    } of profile ${m.profile}`
              }
              className={cn(
                "focus-ring inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1",
                "text-2xs text-muted-foreground transition-[color,background-color,border-color,transform]",
                "duration-150 ease-out hover:border-border-strong hover:bg-hover hover:text-foreground",
                "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <CopyCheck className="size-3.5 flex-none" strokeWidth={1.6} aria-hidden />
              apply across the profile
              {sameProfile > 1 ? (
                <span className="tnum text-ghost">· {sameProfile - 1}</span>
              ) : null}
            </button>
            {разлито && (
              <span
                role="status"
                className="ml-2 inline-flex items-center gap-1 rounded-md border border-success/40
                           bg-success-soft px-1.5 py-0.5 text-2xs text-success
                           motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1
                           motion-safe:duration-150"
              >
                <Check className="size-3 flex-none" strokeWidth={2.4} aria-hidden />
                applied
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

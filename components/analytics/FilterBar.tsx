"use client";

/* Поиск и фильтры листа аналитики.
 *
 * До этого фильтров было два — даты и гео, — причём гео жило захардкоженным
 * списком из четырёх стран прямо в компоненте: новое гео на листе не появилось
 * бы никогда. Поиска не было вовсе, и при 128 крео и трёх тысячах объявлений
 * единственным способом найти строку были глаза.
 *
 * Чипсы активных фильтров — не украшение. Без них через минуту не вспомнить,
 * почему таблица пустая, и «панель ничего не показывает» выглядит как поломка.
 */

import * as React from "react";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/analytics";
import { profileDisplay } from "@/lib/analytics-accounts";
import { geoHint, geoLabel } from "@/lib/analytics-geo";
import { CTRL, CTRL_MUTED, CTRL_ON, SEG, SEG_OFF, SEG_ON, SEG_WRAP } from "./controls";

export interface Filters {
  q: string;
  socs: string[];
  statuses: string[];
  geo: string | null;
}

/** `hint` — то, чего в тексте чипса не видно. Соц показан именем, а искать его
 *  человек будет по id: подсказка единственное место, где id остался. */
function Chip({ text, hint, onDrop }: { text: string; hint?: string; onDrop: () => void }) {
  return (
    <span
      title={hint}
      className="accent-tint inline-flex items-center gap-1 rounded-md border border-primary-line px-1.5 py-0.5 text-[12px] text-foreground"
    >
      {text}
      <button
        type="button"
        onClick={onDrop}
        aria-label={"Remove filter: " + text}
        className="focus-ring relative -mr-0.5 rounded text-muted-foreground hover:text-foreground
                   after:absolute after:-inset-2.5 after:content-['']"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

/** Мультивыбор в поповере. Своя реализация, а не rac/Select: тот про один
 *  выбор, а здесь нужны галочки и «сбросить». */
function Multi({
  title,
  options,
  value,
  onChange,
  label,
}: {
  title: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  label?: (o: string) => string;
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);

  return (
    <DialogTrigger>
      <Button className={cn(CTRL, value.length ? CTRL_ON : CTRL_MUTED)}>
        {title}
        {value.length ? ` · ${value.length}` : ""}
        <ChevronDown className="size-3 flex-none opacity-60" />
      </Button>
      <Popover placement="bottom start" className="rounded-xl border border-border bg-popover p-1.5 shadow-lg">
        <Dialog className="outline-none">
          <div className="flex max-h-[320px] min-w-[190px] flex-col gap-0.5 overflow-auto">
            {options.length === 0 ? (
              <span className="px-2 py-1.5 text-[12.5px] text-muted-foreground">nothing to select</span>
            ) : (
              options.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggle(o)}
                  className={cn(
                    "focus-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]",
                    "transition-colors duration-150 ease-out hover:bg-hover",
                    value.includes(o) ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[13px] flex-none items-center justify-center rounded-[3px] border",
                      value.includes(o) ? "border-primary-ink bg-primary-ink" : "border-border-strong",
                    )}
                  >
                    {value.includes(o) ? (
                      <svg viewBox="0 0 10 10" className="size-2 text-primary-foreground" aria-hidden>
                        <path d="M1.5 5.2 4 7.5 8.5 2.6" fill="none" stroke="currentColor" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="truncate font-mono">{label ? label(o) : o}</span>
                </button>
              ))
            )}
          </div>
          {value.length ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="focus-ring microlabel mt-1 w-full rounded-md px-2 py-1 text-left text-muted-foreground hover:text-foreground"
            >
              reset
            </button>
          ) : null}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export function FilterBar({
  value,
  onChange,
  socs,
  socLabels,
  statuses,
  geos,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  /** ID соцев. Значения фильтра — они и только они. */
  socs: string[];
  /** `profile_id → человеческое имя`, ТОЛЬКО ДЛЯ ПОКАЗА. В `value.socs` и в
   *  обработчики не попадает: имена не уникальны, id уникален. */
  socLabels?: ReadonlyMap<string, string>;
  statuses: string[];
  geos: string[];
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [draft, setDraft] = React.useState(value.q);

  // Внешняя правка (сброс, восстановление из стора) должна доезжать до поля.
  React.useEffect(() => setDraft(value.q), [value.q]);

  /* Пауза перед запросом: поиск режет дерево на каждый набранный символ, а
     дерево на сотню строк пересобирается не бесплатно. 150 мс — это примерно
     промежуток между нажатиями при обычном наборе. */
  React.useEffect(() => {
    if (draft === value.q) return;
    const t = setTimeout(() => onChange({ ...value, q: draft }), 150);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  /* «/» — потому что Cmd+K уже занят шторкой пресетов на уровне оболочки
     (AppShell), а второй глобальный аккорд для поиска по таблице избыточен. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === input.current) {
        setDraft("");
        onChange({ ...value, q: "" });
        input.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange]);

  /* Ключ чипса — ОТДЕЛЬНОЕ поле, а не его текст. Соцы показаны именами, а
     имена совпадают (два окна «17/7 spx» — обычное дело); id не совпадают
     никогда. Ключ по тексту дал бы React два одинаковых ребёнка и снял бы не
     тот чипс на крестике. */
  const chips: Array<{ key: string; text: string; hint?: string; drop: () => void }> = [];
  if (value.q)
    chips.push({ key: "q", text: `search: ${value.q}`, drop: () => onChange({ ...value, q: "" }) });
  if (value.geo)
    chips.push({ key: "geo", text: `geo: ${value.geo}`, drop: () => onChange({ ...value, geo: null }) });
  for (const s of value.socs)
    chips.push({
      key: `profile:${s}`,
      text: `profile: ${profileDisplay(s, socLabels)}`,
      /* Подсказка держит id даже когда имя известно: снять фильтр человек
         может по имени, а вот пойти с ним в Мету — только с id. */
      hint: s,
      drop: () => onChange({ ...value, socs: value.socs.filter((x) => x !== s) }),
    });
  for (const s of value.statuses)
    chips.push({
      key: `status:${s}`,
      text: `status: ${STATUS_LABEL[s] || s}`,
      drop: () => onChange({ ...value, statuses: value.statuses.filter((x) => x !== s) }),
    });

  return (
    /* Ряд чипсов держит высоту постоянно, даже когда чипсов нет.
       Раньше он появлялся вместе с первым фильтром и сдвигал вниз всю таблицу
       — включил соц, и строки уехали под курсором. Пустая строка в 22px стоит
       дешевле, чем прыжок содержимого. */
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="search the tree  /"
            aria-label="Search by creative, ad account, campaign and ad names"
            className={cn(
              "focus-ring h-[30px] w-[230px] rounded-lg border border-border bg-card pl-7 pr-6",
              "text-[12.5px] text-foreground transition-colors duration-150 ease-out",
              "placeholder:text-faint hover:border-border-strong",
            )}
          />
          {draft ? (
            <button
              type="button"
              onClick={() => { setDraft(""); onChange({ ...value, q: "" }); }}
              aria-label="Clear search"
              /* Зона нажатия растянута до высоты поля. Замерено: было 16×16 —
                 в такой крестик надо целиться, а промах ставит курсор в поле и
                 запрос остаётся на месте. */
              className="focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5
                         text-muted-foreground after:absolute after:-inset-[9px] after:content-['']
                         hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>

        {/* Значения — id, подписи — имена. `label` только рисует: `onChange`
            отдаёт наружу ровно те строки, что пришли в `options`. */}
        <Multi title="profile" options={socs} value={value.socs}
               label={(o) => profileDisplay(o, socLabels)}
               onChange={(socs) => onChange({ ...value, socs })} />
        {/* Фильтр по статусу доставки убран. Он отвечает на вопрос «что сейчас
            крутится», а этот лист — про деньги за период: строка с расходом
            существует именно потому, что объявление крутилось, и отбирать её
            по нынешнему статусу значит смешивать два разных времени. Место
            такому фильтру там, где управляют объектами, а не считают итоги. */}

        {/* Гео — одиночный выбор: он уходит запросом на демон и режет срез
            целиком, а не дерево на экране. Список берётся из данных, а не из
            зашитой константы. */}
        <div className={SEG_WRAP}>
          {[null, ...geos].map((g) => (
            <button
              key={g ?? "all"}
              type="button"
              onClick={() => onChange({ ...value, geo: g })}
              className={cn(SEG, value.geo === g ? SEG_ON : SEG_OFF)}
              title={geoHint(g)}
            >
              {geoLabel(g)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-[22px] flex-wrap items-center gap-1">
        {chips.map((c) => <Chip key={c.key} text={c.text} hint={c.hint} onDrop={c.drop} />)}
        {chips.length > 1 ? (
          <button
            type="button"
            onClick={() => onChange({ q: "", socs: [], statuses: [], geo: null })}
            className="focus-ring microlabel rounded-md px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
          >
            reset all
          </button>
        ) : null}
      </div>
    </div>
  );
}

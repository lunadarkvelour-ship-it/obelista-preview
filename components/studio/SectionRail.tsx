"use client";

/** Навигация по секциям — Tree в разметке tailwind-стартера react-aria:
 *  строки с шевроном-раскрывашкой, выбранная секция — синяя подсветка.
 *  Строка собрана здесь, а не взята из rac/Tree.tsx: тот расплющивает props
 *  и в TreeItem, и в TreeItemContent — на ветке с детьми это роняет коллекцию.
 *  Scroll-spy прежний: IntersectionObserver ведёт выбор за скроллом канваса. */
import * as React from "react";
import {
  Button as RacButton,
  Tree,
  TreeItem,
  TreeItemContent,
} from "react-aria-components";
import { ChevronRight } from "lucide-react";
import { tv } from "tailwind-variants";
import { focusRing } from "@/components/rac/utils";
import { SECTIONS } from "./sections-list";
import { cn } from "@/lib/utils";

const itemStyles = tv({
  extend: focusRing,
  base: "relative font-sans flex group gap-3 cursor-default select-none py-1 px-3 text-sm text-neutral-900 dark:text-neutral-200 bg-white dark:bg-neutral-900 border-t dark:border-t-neutral-700 border-transparent first:border-t-0 -outline-offset-2 first:rounded-t-lg last:rounded-b-lg",
  variants: {
    isSelected: {
      false:
        "hover:bg-neutral-100 pressed:bg-neutral-100 dark:hover:bg-neutral-800 dark:pressed:bg-neutral-800",
      true: "bg-blue-100 dark:bg-blue-700/30 hover:bg-blue-200 pressed:bg-blue-200 dark:hover:bg-blue-700/40 dark:pressed:bg-blue-700/40 border-y-blue-200 dark:border-y-blue-900 z-20",
    },
  },
});

const expandButton = tv({
  extend: focusRing,
  base: "border-0 p-0 bg-transparent shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-start cursor-default [-webkit-tap-highlight-color:transparent]",
});

const chevron = tv({
  base: "w-4.5 h-4.5 text-neutral-500 dark:text-neutral-400 transition-transform duration-200 ease-in-out",
  variants: { isExpanded: { true: "transform rotate-90" } },
});

const PHASES = SECTIONS.reduce<{ phase: string; items: typeof SECTIONS }[]>((acc, s) => {
  const last = acc[acc.length - 1];
  if (last && last.phase === s.phase) last.items.push(s);
  else acc.push({ phase: s.phase, items: [s] });
  return acc;
}, []);

/** Строка дерева: слева отступ по уровню, потом шеврон (или пустое место). */
function Row({ label }: { label: React.ReactNode }) {
  return (
    <TreeItemContent>
      {({ hasChildItems, isExpanded }) => (
        <div className="flex items-center">
          <div className="shrink-0 w-[calc(calc(var(--tree-item-level)_-_1)_*_calc(var(--spacing)_*_3))]" />
          {hasChildItems ? (
            <RacButton slot="chevron" className={expandButton()}>
              <ChevronRight aria-hidden className={chevron({ isExpanded })} />
            </RacButton>
          ) : (
            <div className="shrink-0 w-8 h-8" />
          )}
          {label}
        </div>
      )}
    </TreeItemContent>
  );
}

export function SectionRail({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  const [active, setActive] = React.useState(SECTIONS[0].id);

  React.useEffect(() => {
    const root = document.getElementById("canvas");
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root, rootMargin: "-15% 0px -70% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* Свёрнутый сайдбар: подписи не помещаются, остаётся колонка значков.
     Дерево фаз тут не строим — в 60px ему негде раскрываться. */
  if (collapsed) {
    return (
      <div className={cn("flex flex-col items-center gap-1", className)}>
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const on = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { setActive(s.id); go(s.id); }}
              title={`${s.idx} · ${s.label}`}
              aria-label={s.label}
              aria-current={on ? "true" : undefined}
              className={cn(
                "focus-ring flex size-9 items-center justify-center rounded-lg outline-none transition-colors",
                on
                  ? "bg-blue-100 text-primary-ink dark:bg-blue-700/30"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <nav className={cn("shrink-0 overflow-y-auto", className)}>
      <Tree
        aria-label="Builder sections"
        selectionMode="single"
        selectedKeys={[active]}
        defaultExpandedKeys={PHASES.map((p) => p.phase)}
        onSelectionChange={(keys) => {
          const k = [...keys][0];
          // Фазы не выбираются — клик по ним только раскрывает ветку.
          if (k != null && SECTIONS.some((s) => s.id === k)) {
            setActive(String(k));
            go(String(k));
          }
        }}
        className="w-full max-w-full overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700"
      >
        {PHASES.map((p) => (
          <TreeItem key={p.phase} id={p.phase} textValue={p.phase} className={itemStyles}>
            <Row label={<span className="microlabel">{p.phase}</span>} />
            {p.items.map((s) => (
              <TreeItem key={s.id} id={s.id} textValue={s.label} className={itemStyles}>
                <Row
                  label={
                    <span className="flex items-center gap-2">
                      <span className="tnum font-mono text-2xs opacity-60">{s.idx}</span>
                      {s.label}
                    </span>
                  }
                />
              </TreeItem>
            ))}
          </TreeItem>
        ))}
      </Tree>
    </nav>
  );
}

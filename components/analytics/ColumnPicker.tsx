"use client";

import * as React from "react";
import { Button, Dialog, DialogTrigger, Popover, Switch } from "react-aria-components";
import { cn } from "@/lib/utils";
import { COLUMNS, DEFAULT_VISIBLE, withColumn, type ColDef, type ColKey } from "@/lib/analytics-columns";

/* Порядок групп берём из каталога, а не вторым списком: он там уже задан
   порядком колонок, и копия рано или поздно разойдётся с оригиналом. */
const GROUPS: ColDef["group"][] = Array.from(new Set(COLUMNS.map((c) => c.group)));

/* Подпись группы отдельно от её значения: значение — ключ каталога, по нему
   отбираются колонки, а на экран идёт только подпись. Нет подписи — показываем
   само значение, пустого заголовка не бывает. */
const GROUP_LABEL: Record<string, string> = {
  деньги: "money",
  воронка: "funnel",
  конверсии: "conversions",
  охват: "reach",
};

export function ColumnPicker({
  visible,
  onChange,
}: {
  visible: ColKey[];
  onChange: (next: ColKey[]) => void;
}) {
  const on = React.useMemo(() => new Set(visible), [visible]);

  /** Порядок принадлежит юзеру — он переставляет колонки прямо в шапке, и
   *  выключатель не имеет права его пересобирать. Правило вставки живёт в
   *  каталоге, `withColumn`, и покрыто тестами. */
  const toggle = (key: ColKey, next: boolean) =>
    onChange(next ? withColumn(visible, key) : visible.filter((k) => k !== key));

  return (
    <DialogTrigger>
      <Button className="focus-ring label rounded-lg border border-border bg-card px-3 py-1.5 text-muted-foreground outline-none transition-colors hover:border-primary-line hover:text-foreground">
        columns · {visible.length}
      </Button>
      <Popover placement="bottom end" offset={6}>
        <Dialog className="w-[300px] rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
          <div className="mb-2 flex items-center justify-between">
            <span className="microlabel">which columns to show</span>
            <Button
              onPress={() => onChange(DEFAULT_VISIBLE)}
              className="label text-muted-foreground outline-none hover:text-foreground"
            >
              reset
            </Button>
          </div>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {GROUPS.map((g) => (
              <div key={g}>
                <div className="microlabel mb-1 pl-1.5">{GROUP_LABEL[g] ?? g}</div>
                <div className="space-y-0.5">
                  {COLUMNS.filter((c) => c.group === g).map((c) => (
                    <Switch
                      key={c.key}
                      isSelected={on.has(c.key)}
                      onChange={(next) => toggle(c.key, next)}
                      className="focus-ring group flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-1.5 py-1 text-[13px] outline-none hover:bg-hover"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-foreground">{c.title}</span>
                        {c.hint ? (
                          <span className="truncate text-[11px] text-muted-foreground">{c.hint}</span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "relative h-[18px] w-8 flex-none rounded-full bg-border-strong transition-colors",
                          "group-selected:bg-primary",
                        )}
                      >
                        <span className="absolute left-[2px] top-[2px] size-[14px] rounded-full bg-background transition-transform group-selected:translate-x-[14px]" />
                      </span>
                    </Switch>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

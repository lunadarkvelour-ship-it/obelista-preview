"use client";

/** Выбор кабов — RAC GridList (multiselect) под Virtualizer'ом: длинные
 *  каталоги скроллятся без тормозов, клавиатура/чекбоксы из коробки.
 *  Textarea сверху двусторонне синхронизирована с выбором (вставка списком). */
import * as React from "react";
import { ListLayout, Virtualizer } from "react-aria-components";
import { GridList, GridListItem } from "@/components/rac/GridList";
import { useStore, EMPTY_ACCOUNTS, EMPTY_IDS } from "@/lib/store";
import { Input } from "@/components/coss";
import { Textarea } from "@/components/coss";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Hint } from "@/components/studio/fields";
import { personalAccounts } from "@/lib/lichka";
import { parseIds } from "@/lib/build-spec";
import { cn } from "@/lib/utils";
import { Chip, StatusDot } from "./health-bits";

export function AccountPicker() {
  const profile = useStore((s) => s.form.profile);
  const catalog = useStore((s) => s.catalog)[profile] ?? EMPTY_ACCOUNTS;
  const picked = useStore((s) => s.picked)[profile] ?? EMPTY_IDS;
  const dispMode = useStore((s) => s.dispMode);
  const snapshot = useStore((s) => s.snapshot);
  const setFromText = useStore((s) => s.setPickedFromText);
  const pickAll = useStore((s) => s.pickAll);
  const pickNone = useStore((s) => s.pickNone);
  const setDisp = useStore((s) => s.setDispMode);

  const [q, setQ] = React.useState("");
  const [idsText, setIdsText] = React.useState(picked.join(", "));

  // 2-way sync: resync textarea from picked only on external changes (checkbox/profile).
  React.useEffect(() => {
    const parsed = parseIds(idsText, catalog);
    const same = parsed.length === picked.length && parsed.every((id, i) => id === picked[i]);
    if (!same) setIdsText(picked.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, profile]);

  const accById = (id: string) => snapshot?.profiles?.[profile]?.accounts?.find((a) => a.id === id);
  const hasHealth = !!snapshot?.profiles?.[profile]?.accounts?.length;
  // Личка считается из снапшота: имя кабинета == имя аккаунта FB.
  const lichka = React.useMemo(() => personalAccounts(snapshot), [snapshot]);
  const total = catalog.filter((c) => !lichka[c.id]).length;
  const outside = picked.filter((id) => !catalog.some((c) => c.id === id)).length;
  const ql = q.toLowerCase();
  const rows = catalog.filter((c) => !ql || c.name.toLowerCase().includes(ql) || c.id.includes(ql));

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
      <Textarea
        rows={2}
        value={idsText}
        onChange={(e) => {
          setIdsText(e.target.value);
          setFromText(e.target.value);
        }}
        className="text-xs"
        placeholder="act_111, act_222 — paste as a list (comma, space or line break), stays in sync with the checkboxes"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter by name or ID…" className="h-8 min-w-[140px] flex-1" />
        <Segmented
          idBase="disp"
          size="sm"
          value={dispMode}
          onChange={(v) => setDisp(v as "name" | "id")}
          options={[
            { value: "name", label: "names" },
            { value: "id", label: "act_id" },
          ]}
        />
        <Button variant="ghost" size="xs" onClick={pickAll}>all</Button>
        <Button variant="ghost" size="xs" onClick={pickNone}>none</Button>
        <span className="tnum font-mono text-xs text-primary-ink">
          {picked.length}/{total}
          {outside ? ` (+${outside} not in list)` : ""}
        </span>
      </div>

      {rows.length === 0 && <Hint>Catalog is empty — refresh the snapshot{ql ? " or clear the filter" : ""}</Hint>}

      {rows.length > 0 && (
        <Virtualizer layout={ListLayout} layoutOptions={{ rowHeight: 50, gap: 6 }}>
          <GridList
            aria-label="Profile ad accounts"
            selectionMode="multiple"
            selectionBehavior="toggle"
            items={rows}
            selectedKeys={picked}
            onSelectionChange={(keys) => {
              if (keys === "all") pickAll();
              else setFromText([...keys].join(", "));
            }}
            className="max-h-[340px] w-full"
          >
            {(c) => {
              const lich = !!lichka[c.id];
              const main = dispMode === "id" ? c.id : c.name;
              const sub = dispMode === "id" ? c.name : "…" + c.id.slice(-6);
              /* Этот же кабинет виден и с другого подключённого соца. Один каб
                 на нескольких соцах — норма, но в билдере это ловушка: выберешь
                 его на двух профилях и зальёшь одно и то же дважды, а поймёшь
                 по деньгам. Пометка стоит рядом со статусом, до имени: она
                 меняет решение «брать или нет», а не описывает каб. */
              const also = accById(c.id)?.also_on;
              return (
                <GridListItem
                  id={c.id}
                  textValue={`${c.name} ${c.id}`}
                  className={cn("items-center", lich && "opacity-55")}
                >
                  <StatusDot status={accById(c.id)?.status} />
                  {also?.length ? (
                    <Chip
                      tone="warn"
                      title={
                        "The same ad account is visible from: " +
                        also.map((x) => `${x.label || x.profile} (${x.profile})`).join(", ") +
                        ". Do not pick it on two profiles at once — it will be uploaded twice."
                      }
                    >
                      {also.length === 1 ? (
                        <>
                          also on {also[0].label || also[0].profile}
                          {/* id профиля антика — то, чем соц опознаётся в
                              конфиге и в самом антидетекте. Имена
                              повторяются. */}
                          <span className="ml-1 font-mono opacity-60">{also[0].profile}</span>
                        </>
                      ) : (
                        `also on ${also.length} profiles`
                      )}
                    </Chip>
                  ) : null}
                  {/* Две строки: главное крупно, второе — мелким под ним. В одну строку
                      на телефоне влезал только act_id, имя каба обрезалось насмерть. */}
                  <span className="min-w-0 flex-1" title={`${c.name} · ${c.id}`}>
                    <span className="block truncate">{main}</span>
                    <span className="block truncate font-mono text-2xs opacity-60">{sub}</span>
                  </span>
                  {lich && <Chip tone="warn">personal</Chip>}
                </GridListItem>
              );
            }}
          </GridList>
        </Virtualizer>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        {hasHealth ? (
          <>
            <span className="flex items-center gap-1.5"><StatusDot status="ACTIVE" /> active</span>
            <span className="flex items-center gap-1.5"><StatusDot status="DISABLED" /> disabled</span>
            <span className="flex items-center gap-1.5"><StatusDot status="UNSETTLED" /> billing</span>
          </>
        ) : (
          // Без снапшота статусов нет — легенда обещала бы точки, которых не будет.
          <span className="flex items-center gap-1.5"><StatusDot /> ad account status appears with a snapshot</span>
        )}
        <span className="flex items-center gap-1.5"><Chip tone="warn">personal</Chip> auto-created FB ad account, not used for upload</span>
      </div>
    </div>
  );
}

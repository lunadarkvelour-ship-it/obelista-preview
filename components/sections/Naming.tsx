"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow, Hint } from "@/components/studio/fields";
import { SelectField } from "@/components/studio/control";
import { Input } from "@/components/coss";
import { MACROS } from "@/lib/constants";
import { mergeProfiles } from "@/lib/seed";
import { TAG_BY_SOC, tagForProfile } from "@/lib/groups";
import { T } from "@/lib/motion";
import { TagEditor } from "./TagEditor";
import type { BuildCtx, Form } from "@/lib/types";

type NmKey = "nmCamp" | "nmAdset" | "nmAd";

export function Naming() {
  const { form, set, scope, profiles } = useFormScope();
  const inGroup = scope === "group";
  const tags = useStore((s) => s.tags);
  const bind = useStore((s) => s.bind);
  const snapshot = useStore((s) => s.snapshot);
  const [editTags, setEditTags] = React.useState(false);

  /* «По соцу» разрешается на КАЖДОМ соце отдельно: группа живёт на нескольких,
     а агентство у них разное. Результат показываем строкой на соц — иначе авто
     приходится принимать на веру, а префикс уезжает в имена кампаний, по
     которым потом ищется статистика. */
  const perSoc = React.useMemo(() => {
    if (form.tag !== TAG_BY_SOC) return [];
    const ctx: BuildCtx = {
      tags, bind, profiles: mergeProfiles(snapshot), catalogAll: {}, lichka: {}, snapshot,
    };
    return (profiles || []).map((p) => {
      const key = tagForProfile(p, ctx);
      return { profile: p, tag: key, prefix: tags[key]?.prefix || "" };
    });
  }, [form.tag, tags, bind, snapshot, profiles]);

  const bySoc = form.tag === TAG_BY_SOC;
  const uniq = [...new Set(perSoc.map((x) => x.prefix))];
  // Один префикс на все соцы — показываем его. Разные — показывать любой из них
  // было бы враньём: в именах окажутся оба.
  const prefix = bySoc ? (uniq.length === 1 ? uniq[0] : "") : tags[form.tag]?.prefix || "";
  const mixed = bySoc && uniq.length > 1;

  const refs: Record<NmKey, React.RefObject<HTMLInputElement | null>> = {
    nmCamp: React.useRef<HTMLInputElement>(null),
    nmAdset: React.useRef<HTMLInputElement>(null),
    nmAd: React.useRef<HTMLInputElement>(null),
  };
  const active = React.useRef<NmKey>("nmCamp");

  const insertMacro = (m: string) => {
    const key = active.current;
    const el = refs[key].current;
    const cur = form[key] as string;
    const pos = el?.selectionStart ?? cur.length;
    const next = cur.slice(0, pos) + m + cur.slice(pos);
    set(key as keyof Form, next);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const c = pos + m.length;
        el.setSelectionRange(c, c);
      }
    });
  };

  const field = (key: NmKey, label: string) => (
    <Row label={label}>
      {(prefix || mixed) && (
        <span
          className={
            mixed
              ? "rounded-md border border-dashed border-primary-line px-2 py-1 font-mono text-xs text-primary-ink"
              : "rounded-md bg-primary-soft px-2 py-1 font-mono text-xs font-semibold text-primary-ink"
          }
          title={mixed ? "profiles have different tags — each gets its own prefix" : undefined}
        >
          {mixed ? "profile tag" : prefix}
        </span>
      )}
      <Grow>
        <Input
          ref={refs[key]}
          className="font-mono text-xs"
          value={form[key] as string}
          onFocus={() => (active.current = key)}
          onChange={(e) => set(key as keyof Form, e.target.value)}
        />
      </Grow>
    </Row>
  );

  return (
    <SectionCard index="09" id="naming" title="Naming" note="click a macro to insert it into the active field">
      {/* Тег живёт здесь, а не на «Сетапе», потому что префикс — часть нейминга,
          и у каждой группы он свой: группы собираются из кабов разных агентств. */}
      {inGroup && (
        <>
          <Row label="Agency tag">
            <Grow>
              <SelectField
                value={form.tag}
                onChange={(v) => set("tag", v)}
                placeholder="— no tag —"
                options={[
                  { value: TAG_BY_SOC, label: "auto — by profile" },
                  { value: "", label: "— no tag —" },
                  ...Object.keys(tags).map((k) => ({
                    value: k,
                    label: tags[k].prefix ? `${k} · ${tags[k].prefix}` : k,
                    text: k,
                  })),
                ]}
              />
            </Grow>
            <button
              onClick={() => setEditTags((v) => !v)}
              className="flex-none text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:text-foreground hover:decoration-foreground"
            >
              {editTags ? "collapse" : "agency tags"}
            </button>
          </Row>

          {editTags && (
            <div className="rounded-lg border border-border px-3 py-2.5">
              <TagEditor />
            </div>
          )}

          {bySoc && !!perSoc.length && (
            <ul className="flex flex-col gap-1 pl-0 sm:pl-[130px]">
              {perSoc.map((x) => (
                <li key={x.profile} className="flex flex-wrap items-baseline gap-2 text-2xs">
                  <span className="font-mono text-muted-foreground">{x.profile}</span>
                  <span className="text-ghost">→</span>
                  {x.prefix ? (
                    <span className="font-mono text-primary-ink">{x.prefix}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      no tag found — no prefix
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {field("nmCamp", "Campaign")}
      {field("nmAdset", "Ad set")}
      {field("nmAd", "Ad")}
      <Hint>the agency tag is prefixed to all three (shown in purple on the left)</Hint>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {MACROS.map((m) => (
          <motion.button
            key={m}
            type="button"
            whileTap={{ scale: 0.94 }}
            transition={T.press}
            onMouseDown={(e) => {
              e.preventDefault();
              insertMacro(m);
            }}
            className="rounded-md border border-primary-line bg-primary-soft px-2 py-1 font-mono text-xs font-medium text-primary-ink transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {m}
          </motion.button>
        ))}
      </div>
    </SectionCard>
  );
}

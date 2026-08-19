"use client";

import { AnimatePresence, motion } from "motion/react";
import { TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { useBuilder } from "./useBuilder";
import { Badge } from "@/components/coss";
import { listItem } from "@/lib/motion";

function Line({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1 text-xs">
      <span className="flex-[0_0_96px] text-muted-foreground">{k}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function PreviewSummary() {
  const tags = useStore((s) => s.tags);
  const { resolved: s, meta, built, ctx } = useBuilder();
  const prof = ctx.profiles.find((p) => p.id === s.profile) || { label: s.profile, team: "?" };
  const prefix = tags[s.tag]?.prefix || "";
  const tone = meta.activation.tone === "danger" ? "danger" : meta.activation.tone === "warning" ? "warning" : "success";

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <Line k="Profile:"><b>{prof.label}</b> · {s.profile} · tag <b>{prefix || "—"}</b></Line>
      <Line k="Accounts:">{meta.nCabs}{built.groups.length ? <> · <b>{built.groups.length} bundle{built.groups.length === 1 ? "" : "s"}</b></> : null}</Line>
      <Line k="Structure:">{s.nCamp} × {s.nAdset} × {s.nAd} = <b>{meta.perCab}</b> objects/account</Line>
      <Line k="Objective:">
        {s.objective} → {meta.goalBad ? <Badge variant="destructive">invalid combination</Badge> : <b>{meta.goal}</b>}
      </Line>
      <Line k="Budget:">${s.daily}/day · {s.budgetLevel === "adset" ? "ABO" : "CBO"}</Line>
      <Line k="Targeting:">{s.geo.join("/") || "?"} · {s.ageMin}-{s.ageMax} · {s.device === "all" ? "all devices" : s.device}{s.advAud ? " · Adv+aud" : ""}</Line>
      <Line k="Creatives:">{s.videos.length ? s.videos.join(", ") : "—"}</Line>
      <Line k="Naming:"><span className="font-mono text-xs">{prefix + s.nmCamp}</span></Line>
      {s.startTime && <Line k="Start:">{s.startTime.replace("T", " ")}</Line>}
      {/* Раньше тут была красная плашка капсом. Сообщение важное — деньги
          начнут тратиться сразу, — но крик не делает его понятнее: строка
          читается как ошибка, хотя это выбранный юзером режим. Оставляем точку
          цвета и обычный текст. */}
      <Line k="Launch:">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={
              "size-1.5 flex-none rounded-full " +
              (tone === "danger" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success")
            }
          />
          <span className={tone === "danger" ? "text-destructive" : "text-foreground"}>
            {meta.activation.label.toLowerCase()}
          </span>
        </span>
      </Line>

      <AnimatePresence initial={false}>
        {meta.warnings.length > 0 && (
          <motion.div
            variants={listItem}
            initial="hidden"
            animate="show"
            exit="exit"
            className="mt-3 overflow-hidden border-t border-border pt-2.5 text-xs leading-relaxed"
          >
            {meta.warnings.map((w, i) => (
              <div key={i} className="flex gap-2 text-muted-foreground">
                <TriangleAlert className="mt-[3px] size-3 flex-none text-warning" />
                <span>{w}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

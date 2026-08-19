"use client";

import { useBuilder } from "./useBuilder";
import { OBJECTIVES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

export function ContextChips() {
  const { resolved: s, meta, ctx } = useBuilder();
  const prof = ctx.profiles.find((p) => p.id === s.profile);
  const obj = OBJECTIVES.find((o) => o.value === s.objective)?.short || s.objective;
  const tone = meta.activation.tone;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="primary">{prof?.label ?? s.profile}</Badge>
      <Badge variant="outline">{meta.nCabs}</Badge>
      <Badge variant="outline">{obj}</Badge>
      <Badge variant="outline">${s.daily} {s.budgetLevel === "adset" ? "ABO" : "CBO"}</Badge>
      <Badge variant={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "success"}>
        {s.activate === "everything" ? "spend now" : s.activate === "nothing" ? "paused" : s.activate}
      </Badge>
    </div>
  );
}

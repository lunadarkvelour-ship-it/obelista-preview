"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { resolveState } from "@/lib/form";
import { buildAll } from "@/lib/build-spec";
import { previewMeta } from "@/lib/validate";
import { mergeProfiles } from "@/lib/seed";
import { personalAccounts } from "@/lib/lichka";
import type { BuildCtx } from "@/lib/types";

export function useBuilder() {
  const form = useStore((s) => s.form);
  const picked = useStore((s) => s.picked);
  const groups = useStore((s) => s.groups);
  const tags = useStore((s) => s.tags);
  const bind = useStore((s) => s.bind);
  const catalog = useStore((s) => s.catalog);
  const snapshot = useStore((s) => s.snapshot);

  return useMemo(() => {
    const p = form.profile;
    const resolved = resolveState(form, picked[p] || [], groups[p] || []);
    const ctx: BuildCtx = { tags, bind, profiles: mergeProfiles(snapshot), catalogAll: catalog, lichka: personalAccounts(snapshot), snapshot };
    const built = buildAll(resolved, ctx);
    const meta = previewMeta(resolved, built, ctx);
    return { resolved, ctx, built, meta };
  }, [form, picked, groups, tags, bind, catalog, snapshot]);
}

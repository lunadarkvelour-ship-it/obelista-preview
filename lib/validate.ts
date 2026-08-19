// Validation warnings + preview meta — ported 1:1 from renderPreview() in the original.

import { GOAL } from "./constants";
import { cabName, type BuiltBundle } from "./build-spec";
import type { BuildCtx, ResolvedState, SnapshotAccount } from "./types";

function snapAcc(id: string, s: ResolvedState, ctx: BuildCtx): SnapshotAccount | null {
  const sp = ctx.snapshot?.profiles?.[s.profile];
  if (!sp) return null;
  return (sp.accounts || []).find((a) => a.id === id) || null;
}

export function validate(s: ResolvedState, built: BuiltBundle, ctx: BuildCtx): string[] {
  const gs = built.groups;
  const nm = (id: string) => cabName(id, ctx.catalogAll);
  const goal = GOAL[s.objective + "|" + s.convLoc];
  const goalBad = !goal;
  const warns: string[] = [];

  if (goalBad) warns.push("This objective and conversion location are not supported together — change the objective or the location.");
  if (!s.videos.length) warns.push("No video creatives set.");
  if (!gs.length && s.acctMode === "pick" && !s.picked.length)
    warns.push("Mode is “pick from catalog”, but no ad account is selected.");

  const allIds = gs.length ? gs.flatMap((g) => g.ids) : s.acctMode === "pick" ? s.picked : [];
  if (allIds.some((id) => ctx.lichka[id])) warns.push("A personal account is selected — uploads from personal accounts are not allowed.");

  if (ctx.snapshot) {
    const dead = allIds.filter((id) => {
      const a = snapAcc(id, s, ctx);
      return a && a.status === "DISABLED";
    });
    if (dead.length) warns.push(`Selection contains ${dead.length} disabled ad account(s): ${dead.map(nm).join(", ")}`);
  }

  gs.forEach((g, i) => {
    if (!g.ids.length) warns.push(`Group ${i + 1}: ad accounts not recognized.`);
    if (!(g.tail || "").trim()) warns.push(`Group ${i + 1}: URL params are empty.`);
  });

  /* Предупреждения «выбранные кабы вне групп … в заливку НЕ попадут» здесь
     больше нет. В новой модели каб попадает в залив ровно тогда, когда он в
     группе, — отметка в таблице не обещает заливки и обещать её не должна.
     Раньше это было следствием того, что выбор и группы жили параллельно. */

  if (s.videos.length && s.nAdset > s.videos.length)
    warns.push(`Ad sets ${s.nAdset}, videos ${s.videos.length} — creatives will repeat in a loop.`);
  if (!s.link && s.convLoc === "WEBSITE") warns.push("Landing page link is not set.");

  warns.unshift(...namingWarnings(s.nmAd));
  return warns;
}

/** Проверка шаблона имени объявления. Отдельной функцией — её же зовёт секция
 *  нейминга, чтобы сказать про ошибку прямо в поле, а не только в превью.
 *
 *  Правило одно: имя крео обязано стоять в КОНЦЕ. Атрибуция режет имя по `--`
 *  и берёт последний кусок (core/attrib.py:241-244). Если там не имя крео,
 *  объявление не привяжется ни к чему, и его расход осядет в «не опознан»
 *  навсегда — переименовать задним числом уже нечего, имя ушло в Мету.
 *
 *  Это не гипотеза: дефолтный шаблон `ad--[ACT_LAST4]--[RAND5]` 08.08 стоил
 *  четырнадцати объявлений и $193, которых лист аналитики не смог никому
 *  приписать. Поэтому формулировка «залив пройдёт, но», а не «возможно».
 */
export function namingWarnings(tpl: string): string[] {
  const t = (tpl || "").trim();
  if (!t.includes("[CREO_NAME]")) {
    return ["The ad name template has no [CREO_NAME] — the upload will go through, but " +
            "analytics will not link these ads to any creative, and their spend will " +
            "stay unattributed for good."];
  }
  // Макрос есть, но не последний: хвоста он не даёт, и ломается ровно так же,
  // только незаметнее — имя выглядит правильным.
  if (!/\[CREO_NAME\]$/.test(t)) {
    return ["[CREO_NAME] must be at the END of the ad name template: attribution takes " +
            "the last chunk after “--”, and right now that will not be the creative name."];
  }
  return [];
}

export type ActivationTone = "success" | "warning" | "danger";

export interface PreviewMeta {
  perCab: number;
  goal: string | undefined;
  goalBad: boolean;
  nCabs: string;
  activation: { tone: ActivationTone; label: string };
  warnings: string[];
}

const ACT_BADGE: Record<string, { tone: ActivationTone; label: string }> = {
  nothing: { tone: "success", label: "paused — no spend" },
  campaigns: { tone: "success", label: "campaigns on, no spend" },
  "campaigns+adsets": { tone: "warning", label: "ad sets on, ads paused" },
  everything: { tone: "danger", label: "spend starts immediately" },
};

export function previewMeta(s: ResolvedState, built: BuiltBundle, ctx: BuildCtx): PreviewMeta {
  const perCab = s.nCamp * (1 + s.nAdset + s.nAdset * s.nAd);
  const goal = GOAL[s.objective + "|" + s.convLoc];
  const gs = built.groups;
  const nCabs = gs.length
    ? gs.reduce((n, g) => n + g.ids.length, 0) + " in " + gs.length + " groups"
    : s.acctMode === "pick"
      ? s.picked.length + " selected"
      : s.acctMode === "exclude"
        ? `all−${s.picked.length}`
        : "all active";
  return {
    perCab,
    goal,
    goalBad: !goal,
    nCabs,
    activation: ACT_BADGE[s.activate],
    warnings: validate(s, built, ctx),
  };
}

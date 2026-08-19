"use client";

/* Лист «Импорт»: загрузка спеки и снапшота + состояние плагина-моста.
   Раньше всё это было двумя раскрывашками в правой колонке. */

import { useStore } from "@/lib/store";
import { ImportTools } from "@/components/studio/ImportTools";
import { Badge } from "@/components/ui/badge";
import { PAGE_PAD } from "@/components/shell/page";
import { cn } from "@/lib/utils";

function ago(ts?: number | string | null): string {
  if (!ts) return "—";
  const t = typeof ts === "string" ? Date.parse(ts) : ts;
  if (!Number.isFinite(t)) return "—";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

function Line({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1 text-xs">
      <span className="flex-[0_0_128px] text-muted-foreground">{k}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

/** Плагин browser_ext/snapshot_bridge читает локальный ui_snapshot.json и отдаёт
 *  его этой вкладке. Без него панель на хостинге живёт на ручной загрузке. */
function BridgeCard() {
  const bridge = useStore((s) => s.bridge);
  const snapshot = useStore((s) => s.snapshot);

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2.5">
        <h2 className="text-sm font-semibold">Snapshot bridge plugin</h2>
        {bridge.present ? (
          bridge.ok ? (
            <Badge variant="success">reading</Badge>
          ) : (
            <Badge variant="danger">error</Badge>
          )
        ) : (
          <Badge variant="outline">not found</Badge>
        )}
      </div>

      {bridge.present ? (
        <>
          <Line k="Source:">{bridge.source === "file" ? "local file" : bridge.source === "http" ? "local server" : "—"}</Line>
          <Line k="Last read:">{ago(bridge.readAt)}</Line>
          <Line k="Snapshot built:"><span className="font-mono text-xs">{bridge.generatedAt || "—"}</span></Line>
          {bridge.error && (
            <div className="mt-2 rounded-lg border border-red-200 border-l-[3px] border-l-red-500 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700 dark:border-red-400/20 dark:border-l-red-400 dark:bg-red-400/10 dark:text-red-300">
              {bridge.error}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          The bridge is an optional tool for the machine your antidetect browser runs on: it reads
          the snapshot file from that disk and hands it to this panel. Anywhere else it has nothing
          to read, and you do not need it — ad accounts, their status and billing come from Meta on
          their own once an account is connected on the Profiles sheet.
        </p>
      )}

      <Line k="Loaded in panel:">
        <span className="font-mono text-xs">{snapshot?.generated_at || "no snapshot loaded"}</span>
      </Line>
    </div>
  );
}

export function ImportView() {
  return (
    // Импорт — единственный лист, которому ширина не нужна: это две формы
    // ввода, растягивать их на 2000px незачем.
    <div className={cn(PAGE_PAD, "mx-auto flex w-full max-w-4xl flex-col gap-4 py-5")}>
      <h1 className="display text-lg leading-none">Import</h1>
      <BridgeCard />
      <ImportTools />
    </div>
  );
}

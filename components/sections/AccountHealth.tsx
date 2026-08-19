"use client";

/** Здоровье кабов — RAC Table с сортировкой по колонкам; клик по строке
 *  открывает полную карточку каба (биллинг, пиксели, причины) в модалке. */
import * as React from "react";
import { type SortDescriptor } from "react-aria-components";
import { Cell, Column, Row as RacRow, Table, TableBody, TableHeader } from "@/components/rac/Table";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Segmented } from "@/components/ui/segmented";
import { MotionDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/studio/fields";
import { personalAccounts } from "@/lib/lichka";
import type { SnapshotAccount } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BillingBar, Chip, Empty, Metric, StatusPill, statusMeta } from "./health-bits";

const num = (v: string | number | undefined) => {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isNaN(n) ? null : n;
};
const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

function AccountDetail({ a }: { a: SnapshotAccount }) {
  const bal = num(a.balance);
  const lim = num(a.limit);
  const cur = a.currency || (a.balance ? String(a.balance).replace(/[\d.,\s]/g, "") : "") || "USD";
  const pixels = a.pixels || [];

  return (
    <div className="flex flex-col gap-3">
      {a.disable_reason && (
        <div className="rounded-md border border-destructive/30 bg-destructive-soft px-2.5 py-1.5 text-xs text-destructive">
          Disable reason: {a.disable_reason}
        </div>
      )}
      {a.error && (
        <div className="rounded-md border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
          Read error: {a.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        <Metric label="status" value={a.status || "—"} />
        <Metric label="business" value={a.business || <Empty>not linked</Empty>} />
        <Metric
          label="payment method"
          value={a.funding || <Empty>no card</Empty>}
          tone={a.funding ? "mute" : "warn"}
        />
        <Metric label="amount due" value={bal != null ? `${fmt(bal)} ${cur}` : <Empty>—</Empty>} mono />
        <Metric label="billing threshold" value={lim != null ? `${fmt(lim)} ${cur}` : <Empty>—</Empty>} mono />
        <Metric label="total spend" value={a.spent || <Empty>—</Empty>} mono />
      </div>

      {bal != null && lim != null && lim > 0 && (
        <div className="flex flex-col gap-1">
          <BillingBar balance={bal} limit={lim} />
          <div className="text-xs text-faint">
            {fmt(Math.max(0, lim - bal))} {cur} until charge
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="microlabel text-2xs text-faint">pixels ({pixels.length})</div>
        {pixels.length ? (
          <div className="flex flex-wrap gap-1.5">
            {pixels.map((p) => (
              <Chip key={p.id} title={p.id}>
                <span className="truncate">{p.name || p.id}</span>
                <span className="font-mono text-2xs text-faint">{p.id.slice(-6)}</span>
              </Chip>
            ))}
          </div>
        ) : (
          <Empty>No pixel — a conversion objective cannot be built on this ad account</Empty>
        )}
      </div>
    </div>
  );
}

/* Колонка = Column стартера (стрелка сортировки и ресайзер — его). */
function Col({ id, children, rowHeader, width }: { id: string; children: React.ReactNode; rowHeader?: boolean; width?: number }) {
  return (
    <Column id={id} allowsSorting isRowHeader={rowHeader} width={width}>
      {children}
    </Column>
  );
}

export function AccountHealth() {
  const profile = useStore((s) => s.form.profile);
  const snapshot = useStore((s) => s.snapshot);
  const healthMode = useStore((s) => s.healthMode);
  const setMode = useStore((s) => s.setHealthMode);
  const [detail, setDetail] = React.useState<SnapshotAccount | null>(null);
  const [sort, setSort] = React.useState<SortDescriptor>({ column: "status", direction: "ascending" });

  const accs = snapshot?.profiles?.[profile]?.accounts || [];
  const lichka = React.useMemo(() => personalAccounts(snapshot), [snapshot]);
  const bad = accs.filter((a) => a.status !== "ACTIVE").length;

  const rows = React.useMemo(() => {
    const base = healthMode === "problems" ? accs.filter((a) => a.status !== "ACTIVE") : accs.slice();
    const dir = sort.direction === "descending" ? -1 : 1;
    const val = (a: SnapshotAccount): string | number => {
      switch (sort.column) {
        case "name": return (a.name || "").toLowerCase();
        case "balance": return num(a.balance) ?? -1;
        case "limit": return num(a.limit) ?? -1;
        case "spent": return num(a.spent) ?? -1;
        default: return Number(a.status === "ACTIVE"); // проблемные сверху
      }
    };
    return base.sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [accs, healthMode, sort]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          idBase="hmode"
          size="sm"
          value={healthMode}
          onChange={(v) => setMode(v as "problems" | "all")}
          options={[
            { value: "problems", label: "issues only" },
            { value: "all", label: "all accounts" },
          ]}
        />
        {accs.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {bad ? `${bad} of ${accs.length} with issues` : `all ${accs.length} active`}
          </span>
        )}
      </div>

      {!accs.length && <Hint>No snapshot — press Refresh, or ask Claude to refresh the panel</Hint>}
      {!!accs.length && !rows.length && (
        <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2.5 text-xs text-success">
          All ad accounts are active, no issues
        </div>
      )}

      {rows.length > 0 && (
        <Table
          aria-label="Ad account health"
          sortDescriptor={sort}
          onSortChange={setSort}
        >
          <TableHeader>
            <Col id="status" width={110}>status</Col>
            <Col id="name" rowHeader>ad account</Col>
            <Col id="balance" width={110}>balance</Col>
            <Col id="limit" width={100}>threshold</Col>
            <Col id="spent" width={100}>spend</Col>
          </TableHeader>
          <TableBody items={rows}>
            {(a) => {
              const bal = num(a.balance);
              const lim = num(a.limit);
              const cur = a.currency || "";
              return (
                <RacRow id={a.id} onAction={() => setDetail(a)}>
                  <Cell><StatusPill status={a.status} /></Cell>
                  <Cell>
                    <span className="block truncate">
                      {a.name || "unnamed"}
                      {lichka[a.id] && <Chip tone="warn" title="auto-created FB ad account">personal</Chip>}
                    </span>
                    <span className="block truncate font-mono text-2xs opacity-60">{a.id}</span>
                  </Cell>
                  <Cell>
                    <span className="tnum font-mono text-xs">{bal != null ? `${fmt(bal)} ${cur}` : "—"}</span>
                  </Cell>
                  <Cell>
                    <span className="tnum font-mono text-xs">{lim != null ? `${fmt(lim)} ${cur}` : "—"}</span>
                  </Cell>
                  <Cell>
                    <span className="tnum font-mono text-xs">{a.spent || "—"}</span>
                  </Cell>
                </RacRow>
              );
            }}
          </TableBody>
        </Table>
      )}

      <MotionDialog
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        title={detail?.name || detail?.id || "Ad account"}
        className="max-w-lg"
      >
        {detail && (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusPill status={detail.status} />
                  <span className="truncate text-base font-semibold">{detail.name || "unnamed"}</span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-faint">{detail.id}</div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setDetail(null)} aria-label="Close">
                <X />
              </Button>
            </div>
            <AccountDetail a={detail} />
          </div>
        )}
      </MotionDialog>
    </div>
  );
}

"use client";

/* Панель действий над отмеченным.
 *
 * Заменила BulkBar, который клал в буфер русский промпт со списком ИМЁН. Имена
 * `manage` не принимает — он берёт только числовые id, — и 08.08 это стоило
 * целой сессии: юзер прислал скрины с подсветкой, модель восстанавливала срез
 * вручную и в итоге не остановила ничего.
 *
 * Теперь наружу уезжают готовые вызовы, сгруппированные по соцам, потому что
 * `manage` берёт ОДИН profile_name на вызов. Всю сборку делает
 * lib/analytics-export.ts, здесь только кнопки и честный счётчик.
 */

import * as React from "react";
import { Button } from "react-aria-components";
import { Copy, Check, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, num } from "@/lib/analytics";
import type { Node } from "@/lib/analytics-tree";
import { buildManagePayload, payloadText } from "@/lib/analytics-export";
import { CTRL, CTRL_IDLE } from "./controls";

/* Действий тут больше нет — только вынос наружу. Пауза и включение уедут на
   лист manage: аналитика отвечает «что происходит», а не «сделай». */
type Kind = "json" | "tsv" | "names";

/** Таблица выделенного для вставки в Sheets: шапка плюс строка на узел. */
function tsv(nodes: Node[]): string {
  const head = ["level", "name", "id", "ad account", "profile", "status", "spend", "FTD", "subs"];
  const rows = nodes.map((n) => [
    n.kind,
    n.label,
    n.kind === "account" ? n.act_id ?? "" : n.fb_id ?? "",
    n.act_id ?? "",
    n.owner ?? "",
    n.status ?? "",
    n.spend ?? "",
    n.ftd ?? "",
    n.sub ?? "",
  ]);
  return [head, ...rows].map((r) => r.join("\t")).join("\n");
}

export function SelectionBar({
  nodes,
  since,
  until,
  onClear,
}: {
  /** Уже собранные по отметкам узлы. Дедуп по предкам делает экспорт. */
  nodes: Node[];
  since: string;
  until: string;
  onClear: () => void;
}) {
  const [done, setDone] = React.useState<Kind | null>(null);
  const [failed, setFailed] = React.useState(false);

  /* Счёт берём из payload, а не из отметок. Раньше складывались все отмеченные
     узлы подряд, и крео со своим кабом и своим объявлением давали тройной
     спенд. Здесь суммы считаются ПОСЛЕ дедупа по предкам — по тем объектам,
     которые реально уедут в Мету. */
  const payload = React.useMemo(
    () => buildManagePayload(nodes, { since, until }),
    [nodes, since, until],
  );

  if (!nodes.length) return null;

  const { объектов, кабов, соцев, спенд, ftd } = payload.итого;

  const copy = async (kind: Kind) => {
    const text =
      kind === "tsv"
        ? tsv(nodes)
        : kind === "names"
          ? nodes.map((n) => n.label).join("\n")
          : payloadText(payload);
    try {
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setDone(kind);
      window.setTimeout(() => setDone(null), 1600);
    } catch {
      /* Раньше отказ буфера не отрисовывался нигде: копирование могло молча не
         сработать, а юзер шёл вставлять пустоту. */
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2400);
    }
  };

  const btn = cn(CTRL, CTRL_IDLE);

  return (
    <div className="accent-tint mt-2 flex flex-none flex-col gap-1.5 rounded-xl border border-primary-line px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="microlabel text-foreground">
          {num(объектов)} object{plural(объектов)} · {num(кабов)} ad account{plural(кабов)} ·{" "}
          {num(соцев)} profile{plural(соцев)} · {money(спенд)} · FTD {num(ftd)}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Пауза и включение живут на листе manage, а не здесь: аналитика
              отвечает на вопрос «что происходит», а не «сделай». Пока листа
              нет — заглушка, чтобы путь был виден и не искался в другом месте.
              title на обёртке, а не на кнопке: RAC Button проп title не берёт. */}
          <span title="The manage sheet is not built yet — copy the JSON and run it through Claude">
            <Button isDisabled className={cn(btn, "opacity-50")}>
              <ExternalLink className="size-3.5" />
              open in manage
            </Button>
          </span>

          {/* JSON/TSV/имена — временно здесь. Их место на листе manage: это
              вынос наружу того, что уже отмечено, а не работа с аналитикой.
              Переедут вместе с кнопкой «открыть в manage», когда лист
              появится. */}
          {(["json", "tsv", "names"] as const).map((k) => (
            <span key={k}
                  title={k === "json" ? "The same payload, without an action"
                       : k === "tsv" ? "Selection as a table for Sheets"
                       : "Names only, one per line"}>
              <Button onPress={() => copy(k)} className={btn}>
                {done === k ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {done === k ? "copied" : k === "names" ? "names" : k.toUpperCase()}
              </Button>
            </span>
          ))}
          {/* Снять выбор — обычная кнопка ряда, а не подпись сбоку. Раньше она
              была текстом на 11px среди трёх кнопок с рамками, и глаз
              проскакивал мимо: набрал полсотни строк — и ищешь, чем это
              отменить. Esc делает то же самое, о чём тут и написано. */}
          <Button onPress={onClear} className={cn(btn, "text-muted-foreground")}>
            <X className="size-3.5" />
            clear selection
            {/* 11px и полный токен вместо 10px и /80: замерено 3.47 при норме
                4.5, а десятый кегль ниже минимума для текста вообще. */}
            <kbd className="ml-0.5 rounded border border-border px-1 text-[11px] text-muted-foreground">
              Esc
            </kbd>
          </Button>
        </div>
      </div>

      {/* Про пропущенное надо сказать, но НЕ простынёй: подключено 4 соца на
          196 кабов, и полный список превращался в десять строк текста под
          таблицей, которые перестаёшь читать на второй раз. Здесь одна строка
          с числом, весь список — в подсказке и в самом payload. */}
      {payload.не_потушить.length ? (
        <span
          className="cursor-help self-start text-[12px] text-warning"
          title={payload.не_потушить.map((u) => `${u.act_id} — ${u.причина}`).join("\n")}
        >
          {payload.не_потушить.length} ad account{plural(payload.не_потушить.length)} cannot be
          paused: no connected profile · hover to see the list
        </span>
      ) : null}

      {failed ? (
        <span className="text-[12px] text-destructive">
          Clipboard unavailable — copy failed
        </span>
      ) : null}
    </div>
  );
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

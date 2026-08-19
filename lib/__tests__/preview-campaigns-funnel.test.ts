/* Смотрелка колонок воронки: как они выглядят в четырёх положениях сразу.
 *
 * ЗАЧЕМ ОНА НУЖНА ИМЕННО ЗДЕСЬ. Колонки живут в дереве «Кампаний», а дерево
 * принадлежит другому владельцу и переписывается целиком (#160). Пока оно их не
 * позвало, единственный способ увидеть ячейку глазами — собрать её отдельно.
 * Без этого «сделано» держалось бы на том, что `tsc` промолчал.
 *
 * Четыре положения на одном экране намеренно: разница между ними и есть вся
 * работа. «Не приезжало ни разу», «не в это окно», «тёзки» и «настоящие цифры»
 * обязаны читаться как РАЗНЫЕ новости, а не как четыре оттенка пустоты.
 *
 * Запуск: PREVIEW_OUT=/tmp/funnel.html PREVIEW_CSS=/tmp/panel.css \
 *   panel/node_modules/.bin/vitest run lib/__tests__/preview-campaigns-funnel.test.ts
 */
import { describe, expect, it } from "vitest";
import { createElement as h, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fs from "node:fs";
import {
  колонкиВоронки, неЛегло, подготовить, применитьГлаз, сиротыВоронки, спендНайден,
  ячейкаВоронки, type FunnelEye, type FunnelJoin,
} from "@/lib/campaigns-funnel";
import {
  FunnelCostCell, FunnelEyeToggle, FunnelHeadCell, FunnelNotice, FunnelOrphanTreeRow,
  FunnelValueCell,
} from "@/components/sections/campaigns/FunnelCells";

const ЖИВОЙ: FunnelJoin = {
  ok: true, since: "2026-08-08", until: "2026-08-14", act_id: "act_1",
  tracker: "keine_media", lead_metric: "sub",
  metrics: ["sub", "contact", "checkout", "ftd", "rd", "revenue"],
  ever_at: "2026-08-14T09:00:00Z",
  rows: {
    "1": { level: "campaign", days: 7, names: ["RU · smart · 08"],
           sub: 16974, contact: 9120, checkout: 1204, ftd: 84, rd: 19, revenue: null },
    "2": { level: "campaign", days: 4, names: ["DE · wide"],
           sub: 903, contact: 410, checkout: 60, ftd: 0, rd: 0, revenue: null },
  },
  unmatched: {
    ambiguous: [{ level: "campaign", name: "test", days: 3, candidates: ["9", "10"],
                  sub: 4020, contact: 1000, checkout: 0, ftd: 0, rd: 0, revenue: null }],
    no_object: [{ level: "campaign", name: "старое имя", days: 2,
                  sub: 1500, contact: 0, checkout: 0, ftd: 0, rd: 0, revenue: null }],
  },
  totals: {
    in_scope: { sub: 17877 }, other_accounts: { sub: 0 },
    ambiguous: { sub: 4020 }, no_object: { sub: 1500 },
  },
};

/** Строка демонстрации: имя объекта, спенд и то, что показала бы воронка. */
function строка(ctx: ReturnType<typeof подготовить>, о: { fb_id: string; name: string; spend: number | null }) {
  const cols = колонкиВоронки(ctx.resp);
  const ячейки = cols.map((c) => ячейкаВоронки(ctx, { fb_id: о.fb_id, level: "campaign", name: о.name }, c.metric));
  return h("div", { key: о.fb_id + о.name, className: "flex items-center gap-2 border-t border-border px-3 py-1.5" },
    h("span", { className: "label w-12 flex-none text-faint" }, "camp"),
    h("span", { className: "min-w-0 flex-1 truncate text-[12.5px]" }, о.name),
    h("span", { className: "tnum w-20 flex-none text-right text-[12px] text-muted-foreground" },
      о.spend == null ? "—" : "$" + (о.spend / 100).toFixed(2)),
    ...ячейки.map((cell, i) => h(Fragment, { key: cols[i].metric },
      h(FunnelValueCell, { cell }),
      cols[i].lead ? h(FunnelCostCell, { ctx, cell, spend: о.spend, currency: "USD" }) : null)),
  );
}

/** Строки дерева демонстрации: последняя нарочно без найденного спенда — под
 *  глазом прячется именно она. */
const ДЕРЕВО = [
  { fb_id: "1", name: "RU · smart · 08", spend: 1873400 as number | null },
  { fb_id: "2", name: "DE · wide", spend: 90000 as number | null },
  { fb_id: "404", name: "спенд не нашёлся", spend: null as number | null },
];

function таблица(
  заголовок: string,
  resp: FunnelJoin | null,
  опции: { ручкиНет?: boolean; глаз?: FunnelEye } = {},
) {
  const ctx = подготовить(resp, опции);
  const cols = колонкиВоронки(resp);
  const глаз: FunnelEye = опции.глаз ?? "all";
  const лид = resp?.lead_metric || "sub";

  /* Глаз считает по ОДНОМУ списку — строки дерева и строки без объекта вместе:
     иначе счётчик «сколько скрыто» врал бы ровно на ту половину, которую
     человек и не видит. */
  const всё = [
    ...ДЕРЕВО.map((о) => ({ вид: "tree" as const, о, sub: null as number | null })),
    ...сиротыВоронки(resp).map((s) => ({
      вид: "orphan" as const, s, sub: (s.metrics[лид] ?? null) as number | null,
    })),
  ];
  const итог = применитьГлаз(всё, глаз, {
    спендНайден: (r) => (r.вид === "tree" ? спендНайден(r.о.spend) : false),
    лид: (r) => r.sub,
  });

  return h("section", { key: заголовок, className: "flex flex-col gap-2" },
    h("h2", { className: "font-heading text-sm font-semibold" }, заголовок),
    h(FunnelNotice, { ctx, left: неЛегло(resp), leadTitle: "Subs" }),
    h(FunnelEyeToggle, {
      eye: глаз, скрыто: итог.скрыто, скрытоЛида: итог.скрытоЛида,
      скрытоБезЛида: итог.скрытоБезЛида, leadTitle: "subs", onChange: () => {},
    }),
    h("div", { className: "overflow-hidden rounded-xl border border-border bg-card" },
      h("div", { className: "flex items-center gap-2 px-3 py-1.5" },
        h("span", { className: "label w-12 flex-none text-faint" }, "level"),
        h("span", { className: "label min-w-0 flex-1 text-faint" }, "campaign"),
        h("span", { className: "label w-20 flex-none text-right text-faint" }, "spend"),
        ...cols.map((c) => h(Fragment, { key: c.metric },
          h(FunnelHeadCell, { col: c }),
          c.lead ? h("span", { className: "label hidden w-[76px] flex-none text-right text-faint sm:block" }, "CPSub") : null)),
      ),
      ...итог.видимые.map((r) => r.вид === "tree"
        ? строка(ctx, r.о)
        : h(FunnelOrphanTreeRow, { key: r.s.key, row: r.s, columns: cols })),
    ));
}

const HTML = renderToStaticMarkup(
  h("div", { className: "mx-auto flex max-w-5xl flex-col gap-6 p-4" },
    таблица("All funnel — the default, including rows with no spend found", ЖИВОЙ),
    таблица("Eye pressed: only rows whose spend was found", ЖИВОЙ, { глаз: "with_spend" }),
    таблица("Nothing has ever arrived (production today, #161)",
      { ok: true, tracker: null, ever_at: null, lead_metric: "sub", metrics: ЖИВОЙ.metrics }),
    таблица("Arrived before, nothing for this period",
      { ok: true, tracker: null, ever_at: "2026-08-01T10:00:00Z", lead_metric: "sub", metrics: ЖИВОЙ.metrics }),
    таблица("The collector has no such handle yet", null, { ручкиНет: true }),
  ));

describe("смотрелка колонок воронки", () => {
  it("все положения собираются и различимы", () => {
    expect(HTML).toContain("16,974");
    expect(HTML).toMatch(/No funnel has ever arrived/);
    expect(HTML).toMatch(/No funnel for this period/);
    expect(HTML).toMatch(/Funnel not available on this deploy/);
  });

  it("по умолчанию воронка без объекта ВИДНА, под глазом — спрятана", () => {
    /* Порядок таблиц в смотрелке: первая — «всё», вторая — «глаз нажат». Ровно
       эту разницу человек и должен увидеть глазами, а не вычитать из кода. */
    const [всё, подГлазом] = HTML.split("Eye pressed");
    /* Ищем ИМЯ строки, а не слова «no object»: последние стоят ещё и в плашке
       над таблицей, а плашка остаётся в обоих положениях — она про то, сколько
       воронки не легло, и прятать её глазом нельзя. */
    expect(всё).toContain("старое имя");
    expect(подГлазом.split("Nothing has ever arrived")[0]).not.toContain("старое имя");
  });

  it("счётчик скрытого стоит в обоих положениях", () => {
    const куски = HTML.split("without spend");
    expect(куски.length).toBeGreaterThanOrEqual(3);   // минимум в двух таблицах
  });

  it("в положении «не приезжало» на экране нет ни одной цифры воронки", () => {
    /* Сторож на самый дорогой промах: числа соседних колонок (спенд) остаются,
       а воронка обязана быть прочерками. Режем разметку по плашке состояния —
       ниже неё идёт только эта таблица. */
    const кусок = HTML.split("No funnel has ever arrived")[1].split("Arrived before")[0];
    const ячейки = [...кусок.matchAll(/<span[^>]*tnum[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
    const цифры = ячейки.filter((v) => /\d/.test(v) && !v.includes("$"));
    expect(цифры).toEqual([]);
  });

  it("рисует HTML, когда задан PREVIEW_OUT", () => {
    if (!process.env.PREVIEW_OUT) {
      console.log("воронка: задай PREVIEW_OUT=/tmp/funnel.html, чтобы посмотреть");
      return;
    }
    const css = process.env.PREVIEW_CSS ? fs.readFileSync(process.env.PREVIEW_CSS, "utf8") : "";
    fs.writeFileSync(process.env.PREVIEW_OUT,
      `<!doctype html><meta charset="utf-8"><title>Funnel columns</title>\n` +
      `<style>${css}</style>\n<body class="bg-background text-foreground">${HTML}</body>`);
    console.log("написано:", process.env.PREVIEW_OUT);
  });
});

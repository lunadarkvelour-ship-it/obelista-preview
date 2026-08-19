/* Не проверка, а СМОТРЕЛКА: рисует выбор метрик и то, что из него получается.
 *
 *   PREVIEW_OUT=/tmp/cols.html node_modules/.bin/vitest run \
 *     lib/__tests__/preview-campaign-columns.test.ts
 *
 * Рисуется две вещи, и вторая важнее первой.
 *
 *  1. САМ ПОПАП — от голых пропсов (`СписокМетрик`). Попап react-aria в статику
 *     не отрисовать: он живёт порталом и появляется по нажатию, а
 *     `renderToStaticMarkup` нажатий не делает.
 *
 *  2. ДЕМОНСТРАЦИЯ КОНТРАКТА — крошечная таблица, собранная РОВНО из того, что
 *     модуль отдаёт наружу: ширины из каталога, клетки из `ячейка()`, тотал из
 *     `итоги()`, покраска из `ТОН_КЛАСС`. Это не вёрстка продукта — дерево
 *     пишет другой воркер (#153), и его файлы здесь не трогаются вовсе. Это
 *     ответ на вопрос «а что мне с этим делать»: тридцать строк, которые видно
 *     глазами, вместо абзаца описания, который каждый прочтёт по-своему.
 *
 * Данные ЗАГЛУШЕЧНЫЕ и нарочно недобрые: строка, у которой собрано всё; строка
 * без спенда и трафика (прочерк, а не ноль); строка с нулём доставки
 * (тревожный тон); бюджет, живущий на соседнем уровне. Заглушка, которая
 * «улучшает» данные, перестаёт быть глазами.
 */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { panelCss, previewPage } from "./preview-css";
import { СписокМетрик } from "@/components/campaigns/CampaignColumns";
import type { CampaignRow } from "@/lib/campaigns";
import {
  CAMP_DEFAULT_VISIBLE, ТОН_КЛАСС, итоги, колонки, ячейка,
  type CampColKey, type ГдеБюджет,
} from "@/lib/campaigns-columns";

const СТРОКИ: { row: CampaignRow; бюджетГде?: ГдеБюджет }[] = [
  {
    row: {
      fb_id: "c1", level: "campaign", parent_id: null, act_id: "act_1",
      name: "hiu--7aug--BD--bangla18-24", status: "ACTIVE", currency: "USD",
      active_ads: 12, spend: 187_300, daily_budget: 700_000,
      impressions: 1_204_881, clicks: 9_412,
    },
  },
  {
    row: {
      fb_id: "s1", level: "adset", parent_id: "c1", act_id: "act_1",
      name: "hiu--7aug-ads--7759--qa93p", status: "ACTIVE", currency: "USD",
      active_ads: 0, spend: 0, impressions: 44_120, clicks: 87,
    },
    // потолок стоит на кампании (CBO) — это НЕ «не собрали»
    бюджетГде: "на кампании",
  },
  {
    row: {
      fb_id: "a1", level: "ad", parent_id: "s1", act_id: "act_1",
      name: "videoM17CLst-es", status: "ACTIVE", currency: "USD",
      active_ads: 1,
      // спенд и трафик по этой строке ещё не собраны: обязан быть прочерк
    },
    бюджетГде: "не бывает",
  },
];

/** Демонстрация контракта: шапка, строки, тотал — всё из одного каталога. */
function таблица(visible: CampColKey[]) {
  const cols = колонки(visible);
  const шир = (w: number) => ({ width: `${w}px`, minWidth: `${w}px` });
  const итог = итоги(СТРОКИ.map((с) => с.row));

  const шапка = h(
    "div",
    { className: "flex items-center gap-2 border-b border-border bg-elevated px-3 py-1.5" },
    h("span", { className: "min-w-0 flex-1 label text-faint" }, "name"),
    ...cols.map((c) =>
      h("span", {
        key: c.key,
        className: "label flex-none text-right text-faint",
        style: шир(c.width),
        title: c.hint,
      }, c.title)),
  );

  const строки = СТРОКИ.map(({ row, бюджетГде }) =>
    h(
      "div",
      {
        key: row.fb_id,
        className: "flex items-center gap-2 border-b border-border px-3 py-1.5",
      },
      h("span", {
        className: "min-w-0 flex-1 truncate text-[12.5px] text-foreground",
      }, row.name),
      ...cols.map((c) => {
        const я = ячейка(c.key, row, { бюджетГде });
        return h("span", {
          key: c.key,
          className: `tnum flex-none text-right text-[12px] ${ТОН_КЛАСС[я.тон]}`,
          style: шир(c.width),
          title: я.подсказка,
        }, я.текст);
      }),
    ));

  const футер = h(
    "div",
    { className: "flex items-center gap-2 bg-subtle/60 px-3 py-1.5" },
    h("span", { className: "min-w-0 flex-1 label text-faint" }, "total"),
    ...cols.map((c) => {
      const т = итог[c.key];
      return h("span", {
        key: c.key,
        className: `tnum flex-none text-right text-[12px] font-medium ${ТОН_КЛАСС[т.тон]}`,
        style: шир(c.width),
        title: т.подсказка,
      }, т.текст);
    }),
  );

  return h(
    "div",
    { className: "overflow-hidden rounded-xl border border-border" },
    шапка, ...строки, футер,
  );
}

describe("смотрелка выбора метрик", () => {
  it("рисует попап и демонстрацию контракта, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log(
        "смотрелка колонок: PREVIEW_OUT не задан, ничего не нарисовано. Посмотреть —\n" +
        "  PREVIEW_OUT=/tmp/cols.html node_modules/.bin/vitest run " +
        "lib/__tests__/preview-campaign-columns.test.ts\n" +
        "  (рядом ляжет /tmp/cols-dark.html; стили берутся у панели, при беде — у прода)",
      );
      return;
    }

    const подпись = (t: string, mt = 18) =>
      `<p style="margin:${mt}px 0 10px;font:600 13px system-ui">${t}</p>`;

    /* Попап в трёх состояниях: состав по умолчанию, всё включено и ничего не
       включено. Третье — разрешённый выбор, и оно обязано выглядеть
       объяснением, а не поломкой. */
    const попап = (visible: CampColKey[]) =>
      `<div style="width:288px" class="rounded-xl border border-border bg-popover p-3 shadow-lg">`
      + renderToStaticMarkup(h(СписокМетрик, { visible, onChange: () => {} }))
      + `</div>`;

    const ВСЕ: CampColKey[] = [
      "delivering", "spend", "budget", "impressions", "clicks", "ctr", "cpc", "cpm",
    ];

    const body =
      подпись("выбор метрик — состав по умолчанию", 0)
      + `<div style="display:flex;gap:16px;flex-wrap:wrap">`
      + попап(CAMP_DEFAULT_VISIBLE)
      + попап(ВСЕ)
      + попап([])
      + `</div>`
      + подпись("что из этого получается: состав по умолчанию")
      + renderToStaticMarkup(таблица(CAMP_DEFAULT_VISIBLE))
      + подпись("то же дерево со всеми метриками")
      + renderToStaticMarkup(таблица(ВСЕ));

    const css = await panelCss("/analytics");
    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, previewPage("campaign columns", "light", css, body));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html",
                     previewPage("campaign columns", "dark", css, body));
  });
});

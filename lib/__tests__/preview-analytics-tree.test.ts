/* Не проверка, а СМОТРЕЛКА: рисует РАЗВОРОТ КРЕО в статический HTML, чтобы на
 * строку кабинета можно было посмотреть глазами.
 *
 * ЗАЧЕМ. Владелец про этот самый разворот сказал «пишутся не нормальные данные о
 * кабинетах, а какая-то шляпа» (#132). Чинилось это в трёх файлах сразу — дерево,
 * сведение источников, разметка, — и ни один тест не отвечает на вопрос «а как
 * оно теперь выглядит»: `vitest.config.ts` собирает только `lib/**`, а живой лист
 * данные получает эффектом, которого `renderToStaticMarkup` не выполняет.
 * Посмотреть на маке иначе нечем: `npm run dev` и `next build` там запрещены
 * (ломают общий `.next` панели под launchd), облако за логином.
 *
 * Как пользоваться:
 *
 *   PREVIEW_OUT=/tmp/tree.html npx vitest run lib/__tests__/preview-analytics-tree.test.ts
 *
 * Стили берутся у живой панели на 8790 — своей сборки у страницы нет. Новый класс,
 * которого в собранной панели ещё нигде нет, здесь не покрасится: смотреть имеет
 * смысл раскладку и читаемость, а не единственный в своём роде оттенок.
 */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { accountFacts } from "../analytics-accounts";
import { buildTree } from "../analytics-tree";
import type { AdRow } from "../analytics";
import type { Node } from "../analytics-tree";
import { CreativeTable, type Flat } from "@/components/analytics/CreativeTable";

const COLS = ["spend", "ftd", "cpftd", "sub", "sub_to_ftd"] as const;

function ad(over: Partial<AdRow>): AdRow {
  return {
    fb_id: "ad_1", ad_name: "hiu--7aug-ad--7759--y3tmf--bangla24", creative: "bangla24",
    act_id: "act_1398031898947759", act_name: "Hiuhiu_MediaBuyer_3.8_2", agency: "hiu",
    campaign_id: "camp_1", campaign: "hiu--7aug--BD--1398031898947759--l7uacelsb4--bangla18-24",
    adset_id: "adset_1", adset: "hiu--7aug-ads--7759--qa93p--bangla24",
    geo: "BD", attrib_method: "exact_job", attrib_confidence: 1,
    effective_status: "ACTIVE", socials: ["k1f9qbcs"], owner_profile: "k1f9qbcs",
    spend: 18.73, clicks: 597, sub: 12, contact: 4, checkout: 2, ftd: 1, rd: 0,
    spend_at: "2026-08-15T02:05:15+00:00",
    ...over,
  };
}

/* Набор нарочно недобрый — в нём ровно то, на чём строка кабинета врала:
   кабинет с именем и живым статусом, кабинет с именем и БАНОМ, кабинет,
   про состояние которого не спрашивал никто (так сегодня выглядит весь живой
   сервер: статуса нет ни у одного каба из 261), и кабинет БЕЗ ИМЕНИ вовсе —
   его в реестре ещё нет, и от него остаётся один id. */
const ADS: AdRow[] = [
  ad({}),
  ad({ fb_id: "ad_2", act_id: "act_1317372127138026", act_name: "Hiuhiu_Mediabuyer3_11.8_8",
       spend: 41.02, ftd: 3, sub: 40, socials: ["k1f9qbcs", "k1fn9qb1", "00076f0a-c36a-4209-a770-9374e2362a21"] }),
  ad({ fb_id: "ad_3", act_id: "act_4380787615497625", act_name: "Hiuhiu_Mediabuyer3_11.8_7",
       spend: 7.4, ftd: 0, sub: 0, effective_status: "PAUSED" }),
  ad({ fb_id: "ad_4", act_id: "act_9900112233445566", act_name: null, agency: null,
       spend: null, clicks: null, sub: null, contact: null, checkout: null, ftd: null, rd: null,
       spend_at: null, socials: [] }),
];

describe("смотрелка разворота крео", () => {
  it("рисует дерево в HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log(
        "смотрелка: PREVIEW_OUT не задан, ничего не нарисовано. Посмотреть разворот глазами —\n" +
        "  PREVIEW_OUT=/tmp/tree.html npx vitest run lib/__tests__/preview-analytics-tree.test.ts\n" +
        "  (рядом ляжет /tmp/tree-dark.html; стили берутся у живой панели на 8790)",
      );
      return;
    }

    const кабы = buildTree(ADS);
    const крео: Node = {
      id: "cr:bangla24", kind: "creative", label: "bangla24",
      spend: 67.15, clicks: 1791, sub: 52, contact: 8, checkout: 4, ftd: 4, rd: 1,
      ads: 4, ads_with_ftd: 2, geos: ["BD"], children: кабы,
    };

    /* Два вида одного и того же разворота — в этом весь смысл смотрелки:
       СЛЕВА то, что видит облако (состояний нет ни у кого), СПРАВА то же самое,
       когда состав кабинетов доехал из базы. Разница между «серый кружок» и
       «кабинет забанен» должна быть видна с одного взгляда. */
    const пусто = accountFacts({
      ads: кабы.map((n) => ({ act_id: n.act_id!, act_name: n.act_name, agency: n.agency })),
    });
    const собрано = accountFacts({
      ads: кабы.map((n) => ({ act_id: n.act_id!, act_name: n.act_name, agency: n.agency })),
      base: [
        { act_id: "act_1398031898947759", status: "ACTIVE",
          status_checked_at: "2026-08-15T02:00:00+00:00" },
        { act_id: "act_1317372127138026", status: "DISABLED",
          disable_reason: "Ad account disabled", status_checked_at: "2026-08-15T02:00:00+00:00" },
        { act_id: "act_4380787615497625", status: "UNSETTLED",
          status_checked_at: "2026-08-15T02:00:00+00:00" },
        // act_9900112233445566 не назван нигде — остаётся «не спрашивали».
      ],
    });

    const rows: Flat[] = [
      { node: крео, depth: 0, hasKids: true, open: true, root: крео.id },
      ...кабы.map((n) => ({ node: n, depth: 1, hasKids: false, open: false, root: крео.id })),
    ];
    const общее = {
      rows, visible: [...COLS] as never, sortKey: "ftd" as never, sortDesc: true,
      onSort: () => {}, selected: new Set<string>(), onRowClick: () => {},
      onToggle: () => {}, onReorder: () => {}, widths: {}, onWidths: () => {},
      specialLabels: new Set<string>(), hiddenCount: 3,
    };

    const подпись = (s: string) =>
      `<p style="margin:28px 0 10px;font:600 13px system-ui">${s}</p>`;
    const body =
      подпись("облако: состав кабинетов ещё не собран — состояния нет ни у кого") +
      renderToStaticMarkup(createElement(CreativeTable, { ...общее, accounts: пусто })) +
      подпись("состав собран: живой, забаненный, на биллинге и один без имени вовсе") +
      renderToStaticMarkup(createElement(CreativeTable, { ...общее, accounts: собрано }));

    const css = await panelCss();
    const page = (theme: string) =>
      `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
      `<title>creative tree · ${theme}</title><style>${css}</style>` +
      `<body class="bg-background text-foreground" style="padding:24px">` +
      `<div style="max-width:1400px;margin:0 auto">${body}</div></body></html>`;

    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, page("light"));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html", page("dark"));
  });
});

/** Стили одной страницы панели. Хэши CSS меняются на каждой её сборке — тянем их
 *  со страницы, а не держим списком: список протухнет молча.
 *
 *  Файл, отданный не с 200, пропускаем вслух: текст страницы-ошибки внутри
 *  `<style>` ломает разбор всего блока, и страница выходит голой — это легко
 *  принять за сломанную вёрстку листа. */
async function cssOf(base: string, path: string): Promise<string[]> {
  const page = await fetch(base + path).then((r) => r.text());
  const hrefs = [...page.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
  const files: string[] = [];
  for (const h of [...new Set(hrefs)]) {
    const r = await fetch(base + h);
    if (r.ok) files.push(await r.text());
    else console.log(`смотрелка: ${base}${h} отдал ${r.status} — этот файл стилей пропущен`);
  }
  return files;
}

/** Сколько весит настоящий Tailwind панели. Порог, а не «хоть что-то пришло».
 *
 *  Локальная панель под launchd 15.08 отдавала 400 на ГЛАВНЫЙ css-хэш и 200 на
 *  два мелких (анимации тостов и переменные) — то есть «стили взялись», а
 *  страница выходила голой. Проверка на непустоту такое пропускает; проверка на
 *  вес — нет. Собранный Tailwind панели больше 100 КБ, мелочь — единицы. */
const CSS_MIN = 20_000;

/** Стили: сперва локальная панель, при беде — прод.
 *
 *  Прод отдаёт тот же собранный Tailwind публично и логина для статики не
 *  просит; страница берётся `/login` — она открыта без сессии. Смотрелка без
 *  стилей перестаёт быть глазами ровно тогда, когда нужна. */
async function panelCss(): Promise<string> {
  const свои = (await cssOf("http://localhost:8790", "/analytics").catch(() => [])).join("\n");
  if (свои.length >= CSS_MIN) return свои;
  console.log(
    `смотрелка: у локальной панели стилей набралось ${свои.length} байт — этого мало, беру у прода`,
  );
  const прод = (await cssOf("https://app.obelista.com", "/login").catch(() => [])).join("\n");
  if (!прод.length) console.log("смотрелка: стилей нет вовсе, страница будет голой");
  return прод.length > свои.length ? прод : свои;
}

/* ВЁРСТКА читаемых имён соцев, а не решение о них (XR-25).
 *
 * Решение — `profileLabels`/`profileDisplay`/`profileHint` — закрыто чистыми
 * тестами в `analytics-accounts.test.ts`. Но эти функции ничего не меняют,
 * пока их кто-то не позвал, и позвать их обязаны РОВНО ДВА места: выпадашка с
 * чипсами (`FilterBar`) и строка кабинета в развороте (`CreativeTable`).
 * Проверка «функция возвращает имя» остаётся зелёной и тогда, когда разметка
 * по-прежнему рисует id, — ровно тот случай, ради которого 14.08 завели
 * `analytics-empty-view.test.ts`.
 *
 * И вторая половина, которая здесь важнее первой: имя обязано ДОБАВИТЬСЯ, а не
 * заменить id. Человек, нашедший строку глазами по имени, дальше идёт с id — в
 * `manage`, в Ads Manager, в выгрузку. Поэтому каждый случай ниже проверяет обе
 * стороны сразу: имя видно И id никуда не делся.
 *
 * Эффектов `renderToStaticMarkup` не выполняет, поэтому рисуются сами
 * компоненты с готовыми пропами, а не лист целиком.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FilterBar, type Filters } from "@/components/analytics/FilterBar";
import { CreativeTable, type Flat } from "@/components/analytics/CreativeTable";
import { accountFacts } from "@/lib/analytics-accounts";
import { buildTree } from "@/lib/analytics-tree";
import type { AdRow } from "@/lib/analytics";
import type { Node } from "@/lib/analytics-tree";

const ИМЕНА = new Map([["k1a", "17/7 spx"], ["k1b", "keine 3"]]);

const ФИЛЬТРЫ: Filters = { q: "", socs: [], statuses: [], geo: null };

function фильтры(over: Partial<Filters> = {}) {
  return renderToStaticMarkup(
    createElement(FilterBar, {
      value: { ...ФИЛЬТРЫ, ...over },
      onChange: () => {},
      socs: ["k1a", "k1b"],
      socLabels: ИМЕНА,
      statuses: [],
      geos: [],
    }),
  );
}

function ad(over: Partial<AdRow> = {}): AdRow {
  return {
    fb_id: "ad_1", ad_name: "hiu--ad--7759--bangla24", creative: "bangla24",
    act_id: "act_1398031898947759", act_name: "Hiuhiu_MediaBuyer_3.8_2", agency: "hiu",
    campaign_id: "camp_1", campaign: "hiu--BD--camp",
    adset_id: "adset_1", adset: "hiu--adset--1",
    geo: "BD", attrib_method: "exact_job", attrib_confidence: 1,
    effective_status: "ACTIVE", socials: ["k1a", "k1b"], owner_profile: "k1a",
    spend: 18.73, clicks: 597, sub: 12, contact: 4, checkout: 2, ftd: 1, rd: 0,
    ...over,
  };
}

/** Разворот из одного крео с одним кабинетом, у которого два соца. */
function разворот(profileLabels?: ReadonlyMap<string, string>) {
  const кабы = buildTree([ad()]);
  const крео: Node = {
    id: "cr:bangla24", kind: "creative", label: "bangla24",
    spend: 18.73, clicks: 597, sub: 12, contact: 4, checkout: 2, ftd: 1, rd: 0,
    ads: 1, ads_with_ftd: 1, geos: ["BD"], children: кабы,
  };
  const rows: Flat[] = [
    { node: крео, depth: 0, hasKids: true, open: true, root: крео.id },
    ...кабы.map((n) => ({ node: n, depth: 1, hasKids: false, open: false, root: крео.id })),
  ];
  return renderToStaticMarkup(
    createElement(CreativeTable, {
      rows,
      accounts: accountFacts({
        ads: кабы.map((n) => ({ act_id: n.act_id!, act_name: n.act_name, agency: n.agency })),
      }),
      profileLabels,
      visible: ["spend", "ftd"] as never,
      sortKey: "ftd" as never,
      sortDesc: true,
      onSort: () => {},
      selected: new Set<string>(),
      onRowClick: () => {},
      onToggle: () => {},
      onReorder: () => {},
      widths: {},
      onWidths: () => {},
      specialLabels: new Set<string>(),
    }),
  );
}

describe("фильтр показывает имя соца и не теряет его id", () => {
  it("чипс выбранного соца подписан именем", () => {
    expect(фильтры({ socs: ["k1a"] })).toContain("profile: 17/7 spx");
  });

  it("id остаётся в подсказке чипса — с ним человек идёт в Мету", () => {
    expect(фильтры({ socs: ["k1a"] })).toContain('title="k1a"');
  });

  /* Пункты выпадашки живут в закрытом поповере react-aria: в статической
     разметке их нет вовсе, и проверить их рендером нельзя в принципе. Поэтому
     здесь читается САМ ИСТОЧНИК — то, что мультивыбору соцев передана подпись,
     а наружу он по-прежнему отдаёт неизменённые значения. Проверка против
     переписанной руками копии была бы вторым экземпляром договорённости. */
  it("мультивыбору соцев передана подпись, а наружу уходят исходные значения", () => {
    const src = readFileSync(
      new URL("../../components/analytics/FilterBar.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain("label={(o) => profileDisplay(o, socLabels)}");
    expect(src).toContain("onChange={(socs) => onChange({ ...value, socs })}");
  });

  it("безымянный соц остаётся собой, а не пустым пунктом", () => {
    const html = renderToStaticMarkup(
      createElement(FilterBar, {
        value: { ...ФИЛЬТРЫ, socs: ["k1нет_имени"] },
        onChange: () => {},
        socs: ["k1нет_имени"],
        socLabels: ИМЕНА,
        statuses: [],
        geos: [],
      }),
    );
    expect(html).toContain("profile: k1нет_имени");
  });
});

describe("строка кабинета показывает имя соца и не теряет act_id", () => {
  it("соцы подписаны именами", () => {
    const html = разворот(ИМЕНА);
    expect(html).toContain("17/7 spx");
    expect(html).toContain("keine 3");
  });

  it("act_id по-прежнему на строке — его копируют в manage", () => {
    expect(разворот(ИМЕНА)).toContain("act_1398031898947759");
  });

  it("подсказка на соцах называет каждый id", () => {
    const html = разворот(ИМЕНА);
    expect(html).toContain("k1a");
    expect(html).toContain("k1b");
  });

  it("без карты имён строка рисует id, а не пустоту", () => {
    const html = разворот(undefined);
    expect(html).toContain("k1a");
    expect(html).toContain("act_1398031898947759");
    expect(html).not.toContain("17/7 spx");
  });
});

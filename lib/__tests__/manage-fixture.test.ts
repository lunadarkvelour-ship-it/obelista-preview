/* Слепок экспорта для контрактного теста.
 *
 *  Не проверяет — ЗАПИСЫВАЕТ то, что панель реально кладёт в буфер, в
 *  `tests/fixtures/manage_payload.json`. Проверяет питоновский
 *  `tests/test_panel_manage_contract.py`: он гоняет payload против настоящей
 *  inputSchema тула `manage` из `server.py`.
 *
 *  Почему слепок, а не общий код: панель на TypeScript, тул на Python, и
 *  единственный честный способ проверить их согласие — прогнать НАСТОЯЩИЙ
 *  артефакт панели против НАСТОЯЩЕЙ схемы тула. До этого согласия не было
 *  вовсе: панель клала в буфер русский промпт со списком ИМЁН, а `manage`
 *  принимает только числовые id.
 *
 *  Слепок лежит в гите — по диффу видно, что именно изменилось в том, что
 *  уезжает в Мету.
 */
import { describe, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildManagePayload, collectSelected, payloadText } from "@/lib/analytics-export";
import { buildTree, type Node } from "@/lib/analytics-tree";
import type { AdRow } from "@/lib/analytics";

function ad(over: Partial<AdRow> = {}): AdRow {
  return {
    fb_id: "120256363928250771", ad_name: "spx--ad--9013--juhvf--bangla18",
    creative: "bangla18",
    act_id: "act_1387909393279013", act_name: "Каб", agency: "spx",
    campaign_id: "120256363928200771", campaign: "spx--2907--1413--BD--camp",
    adset_id: "120256363928210771", adset: "spx--adset--9013--0xguc--bangla18",
    geo: "BD", attrib_method: "exact_job", attrib_confidence: 1,
    effective_status: "PAUSED", socials: ["k1f9qbcs"], owner_profile: "k1f9qbcs",
    spend: 34.2, clicks: 12, sub: 3, contact: 2, checkout: 1, ftd: 0, rd: 0,
    ...over,
  };
}

/* Срез намеренно разнородный: два объявления одного соца, одно другого и одно
   на кабе без подключённого соца. Так слепок покрывает и группировку, и
   «не потушить» — то есть обе ветки, где ошибка стоит живых кабинетов. */
const rows: AdRow[] = [
  ad(),
  ad({ fb_id: "120256363928220771", ad_name: "spx--ad--9013--ctju5--bangla18" }),
  ad({
    fb_id: "120247587607230767", ad_name: "spx--ad--2945--lphwr--bangla18",
    act_id: "act_1401574285162945", campaign_id: "120247587607200767",
    adset_id: "120247587607210767", owner_profile: "k1ffja5h",
    spend: 84.01, ftd: 1,
  }),
  ad({
    fb_id: "120249606388800050", ad_name: "spx--ad--5129--eg2zn--bangla18",
    act_id: "act_2178497106045129", campaign_id: "120249606388700050",
    adset_id: "120249606388710050", owner_profile: null, spend: 5.5,
  }),
];

const root: Node = {
  id: "cr:bangla18", kind: "creative", label: "bangla18", children: buildTree(rows),
  spend: null, clicks: null, sub: null, contact: null, checkout: null,
  ftd: null, rd: null, ads: null, ads_with_ftd: null, geos: [],
};

describe("слепок экспорта", () => {
  it("пишет фикстуру", () => {
    const selected = new Set(rows.map((r) => "ad:" + r.fb_id));
    const nodes = collectSelected([root], selected);
    const payload = buildManagePayload(nodes, {
      action: "pause", since: "2026-08-01", until: "2026-08-08",
    });
    const out = path.resolve(__dirname, "../../../tests/fixtures/manage_payload.json");
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ text: payloadText(payload), payload }, null, 2) + "\n");
  });
});

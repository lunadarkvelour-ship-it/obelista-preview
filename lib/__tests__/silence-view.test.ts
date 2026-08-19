/* Тишина доехала до ЭКРАНА, а не только до модели (#122), и заодно — тот же
 * вопрос про чужие цифры сбора (#148, блок в конце файла). Общее у них одно и
 * оно же главное: «не знаем» и «ноль» — разные вещи, и на экране они обязаны
 * выглядеть по-разному.
 *
 * Модель проверена рядом (`silence.test.ts`), но она ничего не рисует. Ошибка,
 * ради которой написан этот файл, живёт именно в стыке: правило посчитано
 * верно, а ячейка по-прежнему печатает «0» — и ни один тест модели этого не
 * заметит. Ровно так же было с вердиктом о сборе: компонент работал и стоял не
 * везде.
 *
 * Мест два, и они отвечают на разные вопросы:
 *   — ЯЧЕЙКА: у ЭТОЙ строки цифр воронки не было ни разу, значит ноль в ней
 *     означает «не знаем»;
 *   — ИНДИКАТОР над таблицей: в ЭТОМ ОКНЕ есть дни и кабинеты, которых мы не
 *     спрашивали вовсе. Строка про это может не иметь ни одной подозрительной
 *     ячейки: дни, которых нет, не приезжают строками.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreativeTable, type Flat } from "@/components/analytics/CreativeTable";
import { DataState } from "@/components/analytics/DataState";
import { accountFacts } from "@/lib/analytics-accounts";
import { buildTree, type Node } from "@/lib/analytics-tree";
import type { AdRow, CollectorState } from "@/lib/analytics";
import type { ColKey } from "@/lib/analytics-columns";

const COLS: ColKey[] = ["spend", "sub", "ftd", "cpftd", "ads_with_ftd"];

const объявление = (p: Partial<AdRow> & { fb_id: string }): AdRow => ({
  ad_name: p.fb_id, creative: "cr", act_id: "act_1", act_name: null, agency: null,
  campaign_id: null, campaign: null, adset_id: null, adset: null, geo: null,
  attrib_method: null, attrib_confidence: null, effective_status: null,
  socials: [], owner_profile: null,
  spend: 12.5, clicks: 100, sub: 0, contact: 0, checkout: 0, ftd: 0, rd: 0,
  ...p,
});

function таблица(funnel_at: string | null | undefined): string {
  const строка = объявление({ fb_id: "1" });
  const кабы = buildTree([funnel_at === undefined ? строка : { ...строка, funnel_at }]);
  const rows: Flat[] = кабы.map((n) => ({
    node: n, depth: 0, hasKids: false, open: false, root: n.id,
  }));
  return renderToStaticMarkup(
    createElement(CreativeTable, {
      rows,
      visible: COLS as never,
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
      hiddenCount: 0,
      accounts: accountFacts({
        ads: кабы.map((n) => ({ act_id: n.act_id!, act_name: n.act_name, agency: n.agency })),
      }),
    } as never),
  );
}

describe("ячейка: несобранное не печатается нулём", () => {
  it("воронки не было ни разу — на её месте пробел и объяснение", () => {
    const html = таблица(null);
    expect(html).toContain("n/c");
    expect(html).toContain("it is a gap");
    /* А спенд собран другим источником и остаётся числом: пометить его значило
       бы соврать в другую сторону — деньги-то мы спрашивали. */
    expect(html).toContain("$12.50");
  });

  it("воронка приезжала — ноль остаётся нулём", () => {
    /* Отрицательный контроль. Метка «не собрано» на собранном дороже пропуска:
       она отменяет доверие ко всем остальным меткам, и тогда байер снова читает
       нули как нули. */
    const html = таблица("2026-08-15T04:00:00+00:00");
    expect(html).not.toContain("n/c");
    expect(html).toContain(">0<");
  });

  it("демон старше контракта — лист работает как работал", () => {
    const html = таблица(undefined);
    expect(html).not.toContain("n/c");
    expect(html.length).toBeGreaterThan(100);
  });
});

describe("индикатор окна: дыра в сборе видна и без единой подозрительной строки", () => {
  const СБОР: CollectorState = {
    ok: true, running: true, blocked: false, blocked_msg: "", blocked_since_s: null,
    spend_data_at: new Date().toISOString(), funnel_data_at: new Date().toISOString(),
    profile_errors: {}, sweep_total: 0, detail_total: 0, sweep_ago_s: null,
    hot: 3, cycle_accounts: 10, app_usage_pct: 12, success_rate: 1, hold_s: 0,
    last_error: "",
  };
  const ТИШИНА = {
    дней: 7,
    spend: { собрано_дней: 5, молчат: ["2026-08-13", "2026-08-14"], последний_сбор: null },
    funnel: { собрано_дней: 7, молчат: [], последний_сбор: null },
    кабинетов_молчит: 3, кабинеты_молчат: ["act_1", "act_2", "act_3"],
    молчит: true,
  };
  const индикатор = (тишина?: unknown) =>
    renderToStaticMarkup(
      createElement(DataState, { st: СБОР, byMoney: null, ads: null, branches: {}, тишина }),
    );

  it("сказано словами, что часть окна не собрана", () => {
    /* Дни, которых мы не спрашивали, не приезжают строками — значит на самой
       таблице их не видно НИКАК, сколько её ни разглядывай. Единственное место,
       где про них можно узнать, — вот это. */
    const html = индикатор(ТИШИНА);
    expect(html).toContain("Part of this window was never collected");
  });

  it("и это красное: решение принимают по неполному окну", () => {
    expect(индикатор(ТИШИНА)).toContain("text-destructive");
  });

  it("блока нет — лист молчит так же, как молчал раньше", () => {
    /* `null` значит «демон старше контракта», а не «всё собрано». Молчим, но не
       обещаем полноты. */
    const html = индикатор(undefined);
    expect(html).not.toContain("never collected");
    expect(html.length).toBeGreaterThan(100);
  });

  it("демон говорит «не молчит» — панель не спорит своими выводами", () => {
    const html = индикатор({ ...ТИШИНА, молчит: false });
    expect(html).not.toContain("never collected");
  });
});

describe("чужие цифры сбора не рисуются нулём (#148)", () => {
  /* Бэкенд перестал отдавать чужому арендатору деньги и размер парка — полей в
     ответе нет ВОВСЕ. Панель при этом рисовала «no ad accounts spending today»:
     не утечка, но враньё той же породы, что и весь #122 — мы не знаем, сколько
     у него тратящих кабов, а говорим «ноль». */
  const БАЗА = {
    ok: true, running: true, blocked: false, blocked_msg: "", blocked_since_s: null,
    spend_data_at: new Date().toISOString(), funnel_data_at: new Date().toISOString(),
    app_usage_pct: 12, success_rate: 1, hold_s: 0,
  };
  const рисуй = (st: unknown) =>
    renderToStaticMarkup(
      createElement(DataState, {
        st: st as never, byMoney: null, ads: null, branches: {},
      }),
    );

  it("свои_цифры false — строки про тратящие кабы НЕТ вовсе", () => {
    const html = рисуй({ ...БАЗА, свои_цифры: false });
    expect(html).not.toContain("ad accounts spending");
    expect(html).not.toContain("no ad accounts");
  });

  it("и сходимость не показывается: её числа — тоже чужие деньги", () => {
    const html = рисуй({ ...БАЗА, свои_цифры: false, sweep_total: 0, detail_total: 0 });
    expect(html).not.toContain("Reconciled");
  });

  it("свои цифры — блок на месте, даже когда тратящих ноль", () => {
    /* Отрицательный контроль: у СВОЕГО арендатора ноль это факт, а не незнание,
       и прятать его нельзя — «сегодня никто не льёт» человек обязан видеть. */
    expect(рисуй({ ...БАЗА, свои_цифры: true, hot: 0, profile_errors: {}, sweep_total: 0,
                   detail_total: 0, sweep_ago_s: null, cycle_accounts: 0, last_error: "" }))
      .toContain("no ad accounts spending today");
  });

  it("демон старше контракта — ведём себя как раньше", () => {
    expect(рисуй({ ...БАЗА, hot: 3, profile_errors: {}, sweep_total: 0, detail_total: 0,
                   sweep_ago_s: null, cycle_accounts: 0, last_error: "" }))
      .toContain("3 ad accounts spending");
  });
});

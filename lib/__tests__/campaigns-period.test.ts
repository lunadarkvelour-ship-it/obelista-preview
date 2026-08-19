/* Период доезжает до ручки, метрики считаются из сумм, экран говорит правду.
 *
 * Три вещи в одном файле, потому что они и ломаются вместе: человек выбирает
 * окно, панель просит его у демона, демон отвечает цифрами и датами, экран
 * подписывает цифры ЭТИМИ датами. Разорвись любое звено — на экране остаётся
 * правдоподобное число не про то окно. Ровно с этой жалобы и начался #154.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  campaignsApi, costPerResult, cpc, cpm, ctr, frequency, linkCpc, linkCtr,
  названиеРезультата, почемуНетОхвата, почемуНетРезультата,
  type CampaignRow, type Period,
} from "@/lib/campaigns";
import { PeriodPicker, оПолноте, оСутках, оХранении } from "@/components/views/PeriodPicker";

const строка = (п: Partial<CampaignRow> = {}): CampaignRow => ({
  fb_id: "a1", level: "ad", parent_id: null, act_id: "act_1", name: "объявление",
  status: "ACTIVE", ...п,
});

describe("период уходит в ручку, а не фильтрует ответ у себя", () => {
  afterEach(() => vi.unstubAllGlobals());

  const перехват = () => {
    const fetch = vi.fn().mockResolvedValue({
      status: 200, ok: true, headers: new Headers(),
      json: async () => ({ ok: true, rows: [] }),
    });
    vi.stubGlobal("fetch", fetch);
    return () => new URL(String(fetch.mock.calls[0][0])).searchParams;
  };

  it("пресет доезжает параметром `period`", async () => {
    const адрес = перехват();
    await campaignsApi.list("act_1", { preset: "last_7d" });
    expect(адрес().get("period")).toBe("last_7d");
    expect(адрес().get("act_id")).toBe("act_1");
  });

  it("свой диапазон доезжает парой дат", async () => {
    const адрес = перехват();
    await campaignsApi.list("act_1", { since: "2026-08-01", until: "2026-08-03" });
    expect(адрес().get("since")).toBe("2026-08-01");
    expect(адрес().get("until")).toBe("2026-08-03");
    expect(адрес().get("period")).toBeNull();
  });

  it("без периода ручка зовётся как раньше — старые вызовы не ломаются", async () => {
    const адрес = перехват();
    await campaignsApi.list("act_1");
    expect(адрес().get("period")).toBeNull();
    expect(адрес().get("since")).toBeNull();
  });
});

describe("производные метрики считаются из сумм, а не усредняются", () => {
  it("CTR — это клики делить на показы той же строки", () => {
    expect(ctr(строка({ impressions: 1000, clicks: 25 }))).toBeCloseTo(0.025, 10);
  });

  it("свёрнутая строка даёт CTR суммы, а не среднее по детям", () => {
    /* ГЛАВНОЕ УТВЕРЖДЕНИЕ БЛОКА. Объявление с двумя показами и одним кликом
       даёт 50%; сосед с миллионом показов и 25 тысячами кликов — 2.5%. Среднее
       этих двух — 26%, и это число не значит ничего. Правильный ответ считается
       из сумм: (1 + 25000) / (2 + 1000000). */
    const свёрнуто = ctr(строка({ level: "adset", impressions: 2 + 1_000_000, clicks: 1 + 25_000 }))!;
    const среднее = (ctr(строка({ impressions: 2, clicks: 1 }))! +
                     ctr(строка({ impressions: 1_000_000, clicks: 25_000 }))!) / 2;
    expect(свёрнуто).toBeCloseTo(25001 / 1000002, 10);
    expect(Math.abs(свёрнуто - среднее)).toBeGreaterThan(0.2);
  });

  it("CPC и CPM остаются в минорных единицах — как спенд рядом", () => {
    /* Два формата денег в одной строке — это прямая дорога показать сумму в сто
       раз не ту, и однажды мы её уже показали. Делит на сто одна `budget()`. */
    expect(cpc(строка({ spend: 10_000, clicks: 25 }))).toBe(400);
    expect(cpm(строка({ spend: 10_000, impressions: 20_000 }))).toBe(500);
  });

  it("делить не на что — это прочерк, а не ноль и не бесконечность", () => {
    /* Ноль CTR значит «показывали и не кликали». Отсутствие показов не значит
       ничего, и нарисовать там 0% — соврать про рекламу, которая не крутилась. */
    expect(ctr(строка({ impressions: 0, clicks: 0 }))).toBeNull();
    expect(cpc(строка({ spend: 500, clicks: 0 }))).toBeNull();
    expect(cpm(строка({ spend: 500, impressions: 0 }))).toBeNull();
  });

  it("не собрано — это прочерк на всех трёх метриках", () => {
    expect(ctr(строка())).toBeNull();
    expect(cpc(строка({ spend: 500 }))).toBeNull();
    expect(cpm(строка({ impressions: 100 }))).toBeNull();
  });

  it("настоящий ноль кликов при показах остаётся нулевым CTR", () => {
    /* Отрицательный контроль к предыдущему: «не знаем» и «не кликали» —
       разные ответы, и оба обязаны доехать. */
    expect(ctr(строка({ impressions: 1000, clicks: 0 }))).toBe(0);
  });
});

describe("результат: своё имя, своя цена, и никакого «лида»", () => {
  /* Числа — из живого ответа Меты 15.08 (кабинет act_1922802118675905):
     спенд 44.69, девять лидов по пикселю, 204 ссылочных клика из 329 всех. */
  const лиды = строка({
    spend: 4469, clicks: 329, link_clicks: 204, impressions: 11054,
    results: 9, result_type: "offsite_conversion.fb_pixel_lead",
  });

  it("цена результата сходится с тем, что посчитала сама Мета", () => {
    /* У неё в `cost_per_action_type` — 4.965556; у нас 4469/9 минорными. */
    expect(costPerResult(лиды)! / 100).toBeCloseTo(4.965556, 4);
  });

  it("смешанные цели не получают цену вовсе", () => {
    /* Делить деньги на «девять лидов плюс две покупки» — это цена
       несуществующей вещи, а решение принимают именно по ней. */
    expect(costPerResult(строка({ spend: 4469, results: 11, results_mixed: true }))).toBeNull();
  });

  it("ноль результатов — это не бесконечная цена, а прочерк", () => {
    expect(costPerResult(строка({ spend: 4469, results: 0 }))).toBeNull();
  });

  it("событие названо термином Меты, а не внутренним кодом", () => {
    /* Владелец просил дословно: «человеческими и актуальными
       Facebook-терминами, а не внутренними значениями». */
    expect(названиеРезультата("offsite_conversion.fb_pixel_lead")).toBe("Pixel lead");
    expect(названиеРезультата("link_click")).toBe("Link clicks");
  });

  it("незнакомое событие отдаётся как есть, а не превращается в «Other»", () => {
    /* Сырой код человек хотя бы загуглит; «Other» не значит ничего и прячет,
       что мы чего-то не знаем. */
    expect(названиеРезультата("offsite_conversion.fb_pixel_add_to_cart"))
      .toBe("Pixel add to cart");
    expect(названиеРезультата("что_то_новое")).toBe("что_то_новое");
    expect(названиеРезультата(null)).toBe("");
  });

  it("слово «leads» в одиночку не появляется — оно занято подписчиками CRM", () => {
    /* Решение 15.08. Результат Меты — лид ПИКСЕЛЯ, 9 на кампанию; лид
       владельца — подписчик CRM, 16974 на той же. Обе цифры настоящие, разница
       почти в две тысячи раз. Одно имя на двоих дало бы два ответа на один
       вопрос без способа понять, какой из них про деньги. */
    for (const тип of ["offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"]) {
      expect(названиеРезультата(тип).toLowerCase()).not.toBe("leads");
    }
  });

  it("ссылочный CTR и общий CTR — разные числа, и оба доступны", () => {
    /* 329 против 204 на 11054 показах: разница в полтора раза, и завышенный
       CTR на экране читается как хорошее объявление. */
    expect(ctr(лиды)).toBeCloseTo(329 / 11054, 10);
    expect(linkCtr(лиды)).toBeCloseTo(204 / 11054, 10);
    expect(linkCpc(лиды)).toBeCloseTo(4469 / 204, 10);
  });

  it("три причины пустого результата названы по-разному", () => {
    expect(почемуНетРезультата(строка({ results: null, results_mixed: true })))
      .toMatch(/different events/i);
    expect(почемуНетРезультата(строка({ spend: 4469, results: null })))
      .toMatch(/which event counts as the result/i);
    expect(почемуНетРезультата(строка({ spend: null, results: null })))
      .toMatch(/nothing was collected/i);
    expect(почемуНетРезультата(лиды)).toBe("");
  });
});

describe("охват и частота: показываем там, где точно, и объясняем там, где нет", () => {
  const окно = (days: number): Period => ({
    since: "2026-08-15", until: "2026-08-15", tz: "UTC+3", days, today: "2026-08-15",
  });

  it("частота считается ровно так же, как её считает Мета", () => {
    /* Сверено на живом кабинете 15.08: показы 11054, охват 10472, у Меты в
       `frequency` — 1.055577. Своего поля в базе для этого не нужно. */
    expect(frequency(строка({ impressions: 11054, reach: 10472 }))).toBeCloseTo(1.055577, 6);
  });

  it("без охвата нет и частоты — а не единица и не ноль", () => {
    expect(frequency(строка({ impressions: 11054, reach: null }))).toBeNull();
    expect(frequency(строка({ impressions: 11054, reach: 0 }))).toBeNull();
  });

  it("у родителя пустой охват объяснён арифметикой, а не сбором", () => {
    /* Прочерк без слов отправит человека чинить исправный сбор. */
    const текст = почемуНетОхвата(строка({ level: "adset", reach: null }), окно(1));
    expect(текст).toMatch(/unique people/i);
    expect(текст).toMatch(/cannot be added up/i);
  });

  it("на длинном окне сказано, что охват точен только за сутки", () => {
    const текст = почемуНетОхвата(строка({ reach: null }), окно(7));
    expect(текст).toContain("7 days");
    expect(текст).toMatch(/single day/i);
  });

  it("а вот отсутствие сбора названо отсутствием сбора", () => {
    /* Отрицательный контроль: три разные причины пустоты не должны слипнуться
       в одну фразу, иначе объяснение перестаёт объяснять. */
    const текст = почемуНетОхвата(строка({ reach: null }), окно(1));
    expect(текст).toMatch(/nothing was collected/i);
    expect(текст).not.toMatch(/unique people/i);
  });

  it("когда охват есть, объяснять нечего", () => {
    expect(почемуНетОхвата(строка({ reach: 10472 }), окно(1))).toBe("");
  });
});

describe("экран подписывает цифры тем, что посчитал демон", () => {
  const окно = (п: Partial<Period> = {}): Period => ({
    preset: "last_7d", since: "2026-08-09", until: "2026-08-15", tz: "UTC+3",
    offset_minutes: 180, days: 7, today: "2026-08-15", days_with_data: 7,
    stored_from: "2026-08-08", account_tz: "Asia/Qatar", account_offset_minutes: 180,
    same_day_boundary: true, ...п,
  });

  const html = (п: Parameters<typeof PeriodPicker>[0]) =>
    renderToStaticMarkup(createElement(PeriodPicker, п));

  it("на экране стоят ДАТЫ окна, а не только имя пресета", () => {
    /* У Меты `last_7d` сегодня не включает, у нас включает. Оба варианта
       законны, незаконна догадка: кнопка «7 days» без дат — это обещание,
       которое человек толкует сам. */
    const вид = html({ value: { preset: "last_7d" }, resolved: окно(), onChange: () => {} });
    expect(вид).toContain("2026-08-09");
    expect(вид).toContain("2026-08-15");
    expect(вид).toContain("UTC+3");
  });

  it("пока ответа нет, период не подписан — а не подписан кнопками", () => {
    /* Выбор — это просьба, ответ — то, что посчитано. Подписать старые цифры
       новыми датами хуже, чем сказать «ещё не знаю». */
    const вид = html({ value: { preset: "today" }, resolved: null, onChange: () => {} });
    expect(вид).toContain("not confirmed yet");
  });

  it("все кнопки периода на месте", () => {
    const вид = html({ value: { preset: "today" }, resolved: окно(), onChange: () => {} });
    for (const подпись of ["Today", "Yesterday", "7 days", "30 days", "This month", "Custom"]) {
      expect(вид).toContain(подпись);
    }
  });

  it("несовпадение суток с кабинетом сказано словами, а не умолчано", () => {
    const текст = оСутках(окно({ same_day_boundary: false, account_tz: "America/Los_Angeles" }));
    expect(текст).toContain("America/Los_Angeles");
    expect(текст).toMatch(/different moment/i);
  });

  it("неизвестный пояс кабинета — это «не знаем», а не «совпадает»", () => {
    /* На живом парке таких больше половины (137 кабинетов из 268). Молчание
       здесь читалось бы как подтверждение. */
    const текст = оСутках(окно({ same_day_boundary: null, account_tz: null }));
    expect(текст).toMatch(/do not know/i);
    expect(оСутках(окно())).toMatch(/match/i);
  });

  it("неполное окно названо числом дней, а не оценкой", () => {
    /* День без строк расхода НЕ значит «не собрали»: сбор заводит строки только
       там, где деньги были. Поэтому текст называет факт и не трактует его. */
    expect(оПолноте(окно({ days: 7, days_with_data: 3 }))).toContain("3 of 7 days");
    expect(оПолноте(окно({ days: 1, days_with_data: 0 }))).toBe("");
  });

  it("про глубину хранения говорим только когда окно за неё уходит", () => {
    expect(оХранении(окно({ since: "2026-07-16", stored_from: "2026-08-08" })))
      .toContain("2026-08-08");
    expect(оХранении(окно())).toBe("");
  });
});

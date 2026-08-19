/* Лист «Кампании»: свежесть строки, переходы состояний и деньги (#125).
 *
 * Цена ошибки здесь — не «некрасиво». Человек по этим строкам ВЫКЛЮЧАЕТ чужую
 * рекламу: строка, выдающая трёхдневный слепок за текущее состояние, стоит
 * дороже пустого экрана. Поэтому проверяется ровно то, что умеет соврать молча:
 * возраст без штампа, кнопка на объекте, который выключен сверху, и ноль вместо
 * несобранного бюджета.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ageShort, budget, campaignsApi, freshWhy, freshness, nextStatus, pausedByParent,
  whyBlocked, NoHandle,
  type CampaignRow,
} from "@/lib/campaigns";

const NOW = Date.parse("2026-08-15T12:00:00Z");
const назад = (s: number) => new Date(NOW - s * 1000).toISOString();

function row(over: Partial<CampaignRow> = {}): CampaignRow {
  return {
    fb_id: "120248544415220641",
    level: "campaign",
    parent_id: null,
    act_id: "act_1398031898947759",
    name: "hiu--7aug--BD--1398031898947759--l7uacelsb4--bangla18-24",
    status: "ACTIVE",
    effective_status: "ACTIVE",
    checked_at: назад(120),
    owner: "k1f9qbcs",
    ...over,
  };
}

describe("свежесть строки", () => {
  it("час — граница доверия, сутки — граница «сбор сюда не доходит»", () => {
    expect(freshness(назад(60), NOW)).toBe("fresh");
    expect(freshness(назад(3600), NOW)).toBe("fresh");
    expect(freshness(назад(3601), NOW)).toBe("stale");
    expect(freshness(назад(24 * 3600), NOW)).toBe("stale");
    expect(freshness(назад(24 * 3600 + 1), NOW)).toBe("cold");
  });

  it("штампа нет — «неизвестно», а НЕ «только что»", () => {
    // Строка без возраста рядом со свежими выглядит такой же свежей — ровно та
    // ошибка, ради которой возраст и показывается.
    expect(freshness(null, NOW)).toBe("unknown");
    expect(freshness(undefined, NOW)).toBe("unknown");
    expect(freshness("не дата", NOW)).toBe("unknown");
    expect(freshWhy(null, NOW)).toContain("Not the same as “just collected”");
  });

  it("время из будущего — свежее, а не поломка", () => {
    // Часы демона и браузера расходятся на минуты; называть это «неизвестно»
    // значит пугать человека расхождением часов.
    expect(freshness(new Date(NOW + 90_000).toISOString(), NOW)).toBe("fresh");
    expect(ageShort(new Date(NOW + 90_000).toISOString(), NOW)).toBe("0s");
  });

  it("возраст короткий: секунды, минуты, часы, дни", () => {
    expect(ageShort(назад(5), NOW)).toBe("5s");
    expect(ageShort(назад(300), NOW)).toBe("5m");
    expect(ageShort(назад(5 * 3600), NOW)).toBe("5h");
    expect(ageShort(назад(3 * 24 * 3600), NOW)).toBe("3d");
    expect(ageShort(null, NOW)).toBe("");
  });

  it("подсказка у остывшей строки говорит, что состояние — догадка", () => {
    expect(freshWhy(назад(3 * 24 * 3600), NOW)).toContain("treat the state as a guess");
  });
});

describe("что сделает кнопка", () => {
  it("активное выключаем, выключенное включаем", () => {
    expect(nextStatus(row({ status: "ACTIVE" }))).toBe("PAUSED");
    expect(nextStatus(row({ status: "PAUSED" }))).toBe("ACTIVE");
  });

  it("архив и неизвестное не трогаем вовсе", () => {
    expect(nextStatus(row({ status: "ARCHIVED" }))).toBeNull();
    expect(nextStatus(row({ status: "DELETED" }))).toBeNull();
    expect(nextStatus(row({ status: null }))).toBeNull();
  });

  it("кнопка решается по status, а не по доставке", () => {
    /* Объявление в выключенной кампании: само оно ACTIVE, доставка
       CAMPAIGN_PAUSED. Кнопка «включить» на нём не сделала бы НИЧЕГО — Мета
       примет запрос и вернёт двухсотку, а объявление останется невидимым. */
    const r = row({ level: "ad", status: "ACTIVE", effective_status: "CAMPAIGN_PAUSED" });
    expect(nextStatus(r)).toBe("PAUSED");
    expect(pausedByParent(r)).toBe(true);
  });

  it("некому отправить — кнопка выключена, и причина названа словами", () => {
    expect(whyBlocked(row({ owner: null }))).toContain("No connected profile");
    expect(whyBlocked(row({ status: null }))).toContain("do not know the current state");
    expect(whyBlocked(row({ status: "ARCHIVED" }))).toContain("cannot be switched back");
    expect(whyBlocked(row())).toBe("");
  });
});

describe("ручки ещё нет на этом деплое", () => {
  afterEach(() => vi.unstubAllGlobals());

  const ответ = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status, ok: status < 400, headers: new Headers(), json: async () => body,
    }));

  it("демон отвечает 400 и «нет такого пути» — это NoHandle, а не поломка", async () => {
    /* Проверено на живом проде 15.08: на незнакомый путь демон отдаёт НЕ 404, а
       `400 {"ok": false, "error": "нет такого пути: /campaigns"}`. Ловя один
       только код, лист показал бы красную плашку с нашей внутренней фразой
       по-русски в английском интерфейсе. */
    ответ(400, { ok: false, error: "нет такого пути: /campaigns" });
    await expect(campaignsApi.list("act_1")).rejects.toBeInstanceOf(NoHandle);
  });

  it("404 тоже считается «ручки нет» — на случай другого сервера впереди", async () => {
    ответ(404, {});
    await expect(campaignsApi.list("act_1")).rejects.toBeInstanceOf(NoHandle);
  });

  it("настоящая ошибка остаётся ошибкой и едет текстом Меты", async () => {
    ответ(500, { ok: false, error: "(#100) Invalid parameter" });
    await expect(campaignsApi.list("act_1")).rejects.toThrow("(#100) Invalid parameter");
    await expect(campaignsApi.list("act_1")).rejects.not.toBeInstanceOf(NoHandle);
  });

  it("успех отдаёт строки как есть", async () => {
    ответ(200, { ok: true, rows: [{ fb_id: "c1", level: "campaign" }] });
    await expect(campaignsApi.list("act_1")).resolves.toMatchObject({
      rows: [{ fb_id: "c1" }],
    });
  });
});

describe("бюджет", () => {
  it("минорные единицы делятся на сто ровно один раз", () => {
    expect(budget(7000, "USD")).toBe(70);
    expect(budget(1234, null)).toBe(12.34);
  });

  it("у валют без копеек делить нечего", () => {
    expect(budget(70_000, "VND")).toBe(70_000);
  });

  it("не собрано — null, а не ноль (#122)", () => {
    // Ноль бюджета значит «денег не выделено» и объясняет, почему нет открутки.
    // Отсутствие колонки в схеме не значит ничего подобного.
    expect(budget(null, "USD")).toBeNull();
    expect(budget(undefined, "USD")).toBeNull();
    expect(budget(0, "USD")).toBe(0);
  });
});

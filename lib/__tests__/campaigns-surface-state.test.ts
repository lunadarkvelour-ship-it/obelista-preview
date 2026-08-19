/* Четыре разные новости пустого экрана и один ответ на «можно ли трогать строку».
 *
 * ЗАЧЕМ ЭТО ПРОВЕРЯЕТСЯ ПОВЕДЕНИЕМ, А НЕ ГЛАЗАМИ. Пустой лист кампаний умеет
 * означать четыре вещи, которые лечатся по-разному: ручки нет на деплое, строк
 * в базе нет, строки есть но несвежие, всё в порядке. Пока различие живёт
 * тернарниками в разметке, следующий автор добавит пятый и два начнут спорить —
 * а на экране это выглядит как обычная пустота, то есть незаметно.
 *
 * Отдельно проверяется НЕ-СРАБАТЫВАНИЕ блокировки: защита, которая гасит
 * кнопки шире, чем должна, в этом репозитории уже стоила недельного запрета
 * трём четвертям парка. Поэтому у каждого послабления здесь есть отрицательный
 * контроль — настоящая причина блокировки его переживает.
 */
import { describe, expect, it } from "vitest";
import {
  FRESH_MAX_S, campaignsSurfaceState, campaignsSurfaceWhy, rowActionState,
  type CampaignRow, type ЭкранКампаний,
} from "@/lib/campaigns";

const NOW = Date.parse("2026-08-16T12:00:00Z");
const назад = (s: number) => new Date(NOW - s * 1000).toISOString();

const строка = (p: Partial<CampaignRow> = {}): CampaignRow => ({
  fb_id: "c1", level: "campaign", parent_id: null, act_id: "act_1", name: "camp",
  status: "ACTIVE", effective_status: "ACTIVE", checked_at: назад(60),
  owner: "00076f0a", ...p,
});

describe("вердикт экрана кампаний", () => {
  it("ручки нет — это НЕ «пусто»: строк никто не читал", () => {
    /* Порядок веток важен: без ручки строк не бывает по определению, и назвать
       это «в кабинете ничего нет» значит обвинить кабинет в нашей
       невыкаченности. */
    expect(campaignsSurfaceState({ handleOk: false, rows: [], now: NOW })).toBe("no-backend");
    expect(campaignsSurfaceState({ handleOk: false, rows: [строка()], now: NOW }))
      .toBe("no-backend");
  });

  it("ручка ответила, строк ноль — «пусто»", () => {
    expect(campaignsSurfaceState({ handleOk: true, rows: [], now: NOW })).toBe("empty");
    expect(campaignsSurfaceState({ handleOk: true, rows: null, now: NOW })).toBe("empty");
    expect(campaignsSurfaceState({ handleOk: true, now: NOW })).toBe("empty");
  });

  it("строки есть и свежие — «ok»", () => {
    expect(campaignsSurfaceState({
      handleOk: true, rows: [строка()], fetchedAt: назад(120), now: NOW,
    })).toBe("ok");
  });

  it("строки есть, ответ старше порога доверия — «несвежо»", () => {
    expect(campaignsSurfaceState({
      handleOk: true, rows: [строка()], fetchedAt: назад(FRESH_MAX_S + 60), now: NOW,
    })).toBe("stale");
  });

  it("штампа нет вовсе — тоже «несвежо», а не «ok»", () => {
    /* Ответ без штампа выглядит на экране так же свежо, как остальные. Это
       худший из четырёх случаев: незнание, притворившееся знанием. */
    expect(campaignsSurfaceState({ handleOk: true, rows: [строка()], now: NOW }))
      .toBe("stale");
    expect(campaignsSurfaceState({
      handleOk: true, rows: [строка()], fetchedAt: null, now: NOW,
    })).toBe("stale");
  });

  it("порог свежести ОДИН на продукт, а не свой у экрана", () => {
    /* Второй порог рядом с `FRESH_MAX_S` разъехался бы молча: экран и строка
       начали бы говорить разное про одни и те же данные. */
    const ровно = campaignsSurfaceState({
      handleOk: true, rows: [строка()], fetchedAt: назад(FRESH_MAX_S), now: NOW,
    });
    const секундойПозже = campaignsSurfaceState({
      handleOk: true, rows: [строка()], fetchedAt: назад(FRESH_MAX_S + 1), now: NOW,
    });
    expect(ровно).toBe("ok");
    expect(секундойПозже).toBe("stale");
  });

  it("вердикт — ровно один из четырёх, и все четыре достижимы", () => {
    const все: ЭкранКампаний[] = ["no-backend", "empty", "stale", "ok"];
    const получено = [
      campaignsSurfaceState({ handleOk: false, now: NOW }),
      campaignsSurfaceState({ handleOk: true, rows: [], now: NOW }),
      campaignsSurfaceState({ handleOk: true, rows: [строка()], now: NOW }),
      campaignsSurfaceState({ handleOk: true, rows: [строка()], fetchedAt: назад(5), now: NOW }),
    ];
    expect([...new Set(получено)].sort()).toEqual([...все].sort());
  });
});

describe("вердикт словами", () => {
  it("у трёх состояний фраза есть, у «ok» её нет", () => {
    /* Экран, сообщающий «всё в порядке», отнимает место у того, что важно. */
    for (const с of ["no-backend", "empty", "stale"] as ЭкранКампаний[]) {
      expect(campaignsSurfaceWhy(с, назад(5 * 3600), NOW).length, с).toBeGreaterThan(20);
    }
    expect(campaignsSurfaceWhy("ok", назад(5), NOW)).toBe("");
  });

  it("три фразы РАЗНЫЕ — иначе различие вердиктов не доезжает до человека", () => {
    const фразы = (["no-backend", "empty", "stale"] as ЭкранКампаний[])
      .map((с) => campaignsSurfaceWhy(с, назад(5 * 3600), NOW));
    expect(new Set(фразы).size).toBe(3);
  });

  it("«несвежо» без штампа и «несвежо» со штампом объясняются по-разному", () => {
    /* «Собрано три часа назад» и «штампа нет вовсе» — разные новости, и вторая
       хуже: возраст неизвестен совсем. */
    expect(campaignsSurfaceWhy("stale", назад(5 * 3600), NOW))
      .not.toBe(campaignsSurfaceWhy("stale", null, NOW));
  });

  it("ни одна фраза не выдаёт человеку наши внутренние слова", () => {
    /* Интерфейс едет чужим людям: `NoHandle`, `act_id` и имена полей в тексте
       для байера — это наша кухня, а не его новость. */
    for (const с of ["no-backend", "empty", "stale"] as ЭкранКампаний[]) {
      const t = campaignsSurfaceWhy(с, null, NOW);
      for (const слово of ["NoHandle", "act_id", "fb_id", "undefined", "null"]) {
        expect(t.includes(слово), `${с}: ${слово}`).toBe(false);
      }
    }
  });
});

describe("можно ли трогать строку", () => {
  it("нет подключённого профиля — кнопка гаснет и говорит почему", () => {
    const s = rowActionState(строка({ owner: null }), { now: NOW });
    expect(s.enabled).toBe(false);
    expect(s.reason).toMatch(/no connected profile/i);
  });

  it("состояние не собрано — поверх незнания не пишем", () => {
    const s = rowActionState(строка({ status: null }), { now: NOW });
    expect(s.enabled).toBe(false);
    expect(s.reason.length).toBeGreaterThan(10);
  });

  it("архив назад не переключается", () => {
    const s = rowActionState(строка({ status: "ARCHIVED", effective_status: "ARCHIVED" }),
                             { now: NOW });
    expect(s.enabled).toBe(false);
    expect(s.reason).toMatch(/ARCHIVED/);
  });

  it("ручки нет на деплое — гаснут все кнопки, и это сказано словами", () => {
    const s = rowActionState(строка(), { surface: "no-backend", now: NOW });
    expect(s.enabled).toBe(false);
    expect(s.reason).toMatch(/collector/i);
  });

  it("строка показана ради контекста — действия на ней человек не выбирал", () => {
    const s = rowActionState(строка(), { контекст: true, now: NOW });
    expect(s.enabled).toBe(false);
    /* Причина обязана говорить, ЧТО СДЕЛАТЬ: иначе выключенная кнопка на
       найденной строке читается как поломка панели. */
    expect(s.reason).toMatch(/filter/i);
  });

  it("сбор не доходил больше суток — состояние строки догадка, писать нельзя", () => {
    const s = rowActionState(строка({ checked_at: назад(26 * 3600) }), { now: NOW });
    expect(s.enabled).toBe(false);
    expect(s.reason).toMatch(/over a day/i);
  });

  it("просто несвежая строка (час-сутки) кнопку НЕ гасит", () => {
    /* ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ ПОСЛАБЛЕНИЯ, часть первая. Вердикт экрана
       считается по САМОМУ СТАРОМУ ответу из открытых кабинетов, а открыть их
       можно 25 — гасить по нему значило бы отнять кнопку у только что
       собранных строк из-за одного отставшего кабинета. */
    const s = rowActionState(строка({ checked_at: назад(3 * 3600) }),
                             { surface: "stale", now: NOW });
    expect(s.enabled).toBe(true);
    expect(s.reason).toBe("");
  });

  it("послабление не проглотило настоящую причину", () => {
    /* ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ, часть вторая: на том же несвежем экране строка
       без владельца обязана остаться заблокированной. Иначе вместо слишком
       широкой защиты получилась бы отсутствующая. */
    const s = rowActionState(строка({ owner: null, checked_at: назад(3 * 3600) }),
                             { surface: "stale", now: NOW });
    expect(s.enabled).toBe(false);
    expect(s.reason).toMatch(/no connected profile/i);
  });

  it("свежая строка с владельцем на живом деплое — кнопка доступна", () => {
    const s = rowActionState(строка(), { surface: "ok", now: NOW });
    expect(s).toEqual({ enabled: true, reason: "" });
  });

  it("у доступного действия причины НЕТ, у недоступного она НИКОГДА не пуста", () => {
    /* Выключенная кнопка без объяснения читается как поломка панели — это
       правило проверяется на всех блокирующих случаях разом. */
    const случаи: Array<[CampaignRow, Parameters<typeof rowActionState>[1]]> = [
      [строка({ owner: null }), {}],
      [строка({ status: null }), {}],
      [строка({ status: "ARCHIVED" }), {}],
      [строка(), { surface: "no-backend" }],
      [строка(), { контекст: true }],
      [строка({ checked_at: назад(26 * 3600) }), {}],
    ];
    for (const [r, o] of случаи) {
      const s = rowActionState(r, { ...o, now: NOW });
      expect(s.enabled).toBe(false);
      expect(s.reason.trim().length, JSON.stringify(o)).toBeGreaterThan(10);
      /* Законченная фраза, а не обрубок: она стоит в подсказке и в имени
         кнопки для читалки экрана. */
      expect(s.reason.trim().endsWith("."), s.reason).toBe(true);
    }
  });
});

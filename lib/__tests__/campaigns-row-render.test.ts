/* Строка дерева РИСУЕТ то, что решили функции: кнопку с причиной и пустоту,
 * которая не притворяется нулём.
 *
 * ЗАЧЕМ ОТДЕЛЬНО ОТ ПРОВЕРОК ФУНКЦИЙ. `rowActionState` может честно вернуть
 * «нельзя, потому что нет владельца», а разметка рядом всё равно нарисует
 * доступную кнопку — она уже так умела: причин блокировки четыре, а вьюха
 * знала две. Такой разрыв не виден ни одному тесту чистых функций и не виден
 * глазом на смотрелке, если в заглушке нет ровно этой строки.
 *
 * Проверяем СУТЬ, а не классы: доступна ли кнопка, стоит ли рядом причина
 * словами, и отличается ли «ноль» от «не знаем». Разметку черновика правят
 * каждый день, и тест, прибитый к ней, начнёт врать первым.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampRow } from "@/components/views/CampaignsView";
import { CAMP_DEFAULT_VISIBLE, колонки } from "@/lib/campaigns-columns";
import { подготовить } from "@/lib/campaigns-funnel";
import { rowActionState, type CampaignRow, type ЭкранКампаний } from "@/lib/campaigns";
import type { FlatCamp, PendingMap } from "@/lib/campaigns-tree";

const NOW = Date.parse("2026-08-16T12:00:00Z");
const назад = (s: number) => new Date(NOW - s * 1000).toISOString();

const КОЛОНКИ = { метрики: колонки(CAMP_DEFAULT_VISIBLE), ctx: подготовить(null) };

const строка = (p: Partial<CampaignRow> = {}): CampaignRow => ({
  fb_id: "c1", level: "campaign", parent_id: null, act_id: "act_1",
  name: "camp", status: "ACTIVE", effective_status: "ACTIVE",
  checked_at: назад(60), owner: "00076f0a", currency: "USD", ...p,
});

const рисуем = (
  r: CampaignRow,
  опции: { контекст?: boolean; экран?: ЭкранКампаний; pending?: PendingMap } = {},
) => {
  const item: FlatCamp = {
    node: { row: r, children: [] }, depth: 1, hasKids: false, open: false,
  };
  return renderToStaticMarkup(createElement(CampRow, {
    item, now: NOW, pending: опции.pending ?? {}, колонки: КОЛОНКИ,
    контекст: опции.контекст, экран: опции.экран,
    onToggle: () => {}, onSwitch: () => {},
  }));
};

describe("кнопка действия рисуется по вердикту, а не по своему правилу", () => {
  it("свежая строка с владельцем — кнопка живая", () => {
    const html = рисуем(строка());
    expect(html).toContain("pause");
    expect(html).not.toContain("disabled");
  });

  it("нет подключённого профиля — кнопка выключена И объяснена", () => {
    const r = строка({ status: "PAUSED", effective_status: "PAUSED", owner: null });
    const html = рисуем(r);
    expect(html).toContain("disabled");
    /* Причина — та же самая, что вернула функция: второго словаря причин в
       разметке быть не должно. */
    expect(html).toContain(rowActionState(r, { now: NOW }).reason);
  });

  it("причина уезжает в имя кнопки, а не только в подсказку мышью", () => {
    /* `title` на обёртке читалка экрана не произносит, и для неё выключенная
       кнопка остаётся просто «pause, dimmed». */
    const r = строка({ status: "PAUSED", effective_status: "PAUSED", owner: null });
    expect(рисуем(r)).toMatch(/aria-label="[^"]*unavailable:[^"]*profile/i);
  });

  it("ручки нет на деплое — гаснет даже строка с владельцем", () => {
    const html = рисуем(строка(), { экран: "no-backend" });
    expect(html).toContain("disabled");
    expect(html).toMatch(/collector/i);
  });

  it("строка показана ради контекста — не действие, и это сказано словами", () => {
    const html = рисуем(строка(), { контекст: true });
    expect(html).toContain("disabled");
    expect(html).toMatch(/Clear the filter/i);
  });

  it("несвежий экран сам по себе кнопку НЕ гасит", () => {
    /* Отрицательный контроль: вердикт экрана считается по самому старому
       ответу из открытых кабинетов, и гасить по нему значило бы отнять кнопку
       у только что собранной строки. */
    expect(рисуем(строка(), { экран: "stale" })).not.toContain("disabled");
  });

  it("переключать нечего — кнопки нет вовсе, стоит прочерк с причиной", () => {
    /* Выключенная кнопка «pause» на архивной кампании предлагала действие,
       которого не существует. */
    const html = рисуем(строка({ status: "ARCHIVED", effective_status: "ARCHIVED" }));
    expect(html).not.toContain(">pause<");
    expect(html).toContain("—");
    expect(html).toMatch(/ARCHIVED/);
  });
});

describe("ноль и «не знаем» на строке выглядят по-разному", () => {
  it("ноль спенда печатается нулём, а несобранный спенд — прочерком", () => {
    /* Ноль значит «крутилось и не потратило», прочерк — «мы не знаем».
       Слить их в одну клетку значит соврать про чужие деньги. */
    const сНулём = рисуем(строка({ fb_id: "z", spend: 0, impressions: 0, clicks: 0 }));
    const безСпенда = рисуем(строка({ fb_id: "n", spend: null, impressions: null }));
    expect(сНулём).toContain("$0.00");
    expect(безСпенда).not.toContain("$0.00");
    expect(безСпенда).toContain("—");
  });

  it("прочерк никогда не молчит: рядом стоит объяснение", () => {
    /* Прочерк в колонке денег без объяснения читается как ноль, а ноль — это
       утверждение «не потрачено», которого мы не делали (#122). */
    const html = рисуем(строка({ spend: null, impressions: null, clicks: null }));
    expect(html).toMatch(/title="[^"]*not the same as zero[^"]*"/i);
  });

  it("ступени воронки без ответа — прочерк со словами, а не ноль", () => {
    /* Сегодня в облаке нет ни одной строки воронки. Ноль здесь читался бы как
       «твоя реклама не принесла никого», и по нему тушат рекламу. Ступени в
       умолчание колонок не входят — просим их явно, иначе тест «проверял» бы
       колонки, которых на экране нет. */
    const item: FlatCamp = {
      node: { row: строка(), children: [] }, depth: 1, hasKids: false, open: false,
    };
    const html = renderToStaticMarkup(createElement(CampRow, {
      item, now: NOW, pending: {},
      колонки: { метрики: колонки(["sub", "ftd"]), ctx: подготовить(null) },
      onToggle: () => {}, onSwitch: () => {},
    }));
    expect(html).toMatch(/data-col="ftd"[^>]*>—</);
    /* Клетка обязана сказать «мы не знаем» и прямо отказаться от прочтения
       «никто не пришёл» — прочерк молча читается именно вторым. */
    expect(html).toMatch(/data-col="ftd"[^>]*title="[^"]*do not know[^"]*"/i);
    expect(html).toMatch(/data-col="ftd"[^>]*title="[^"]*nobody[^"]*"/i);
  });
});

describe("возраст стоит у каждой строки своей", () => {
  it("свежая и остывшая строки подписаны по-разному", () => {
    const свежая = рисуем(строка({ checked_at: назад(120) }));
    const остывшая = рисуем(строка({ checked_at: назад(5 * 3600) }));
    expect(свежая).toContain("2m");
    expect(остывшая).toContain("5h");
  });

  it("штампа нет — говорим об этом, а не показываем строку свежей", () => {
    const html = рисуем(строка({ checked_at: null }));
    expect(html).toMatch(/has not stamped this row/i);
  });
});

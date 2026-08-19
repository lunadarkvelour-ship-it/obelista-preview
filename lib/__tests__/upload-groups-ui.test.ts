/* Лист «Аплоад»: три вещи, которых на нём не было и о которых сказал владелец.
 *
 *  1. Кнопка сборки промпта была выключена ПО ДЕЛУ, но выглядела рабочей, и
 *     нажатие не давало ничего — ни перехода, ни причины («связка не строится,
 *     когда жму кнопку»).
 *  2. Почему именно она выключена, экран не говорил: только счётчик «1 group
 *     not ready».
 *  3. Группу нельзя было ни продублировать, ни удалить: обе операции жили в
 *     сторе с тестами и без единой кнопки.
 *
 *  Проверяем СМЫСЛ на отрисованном листе, а не разметку: подписи и aria-имена
 *  — то, чем человек и пользуется. Серверный рендер не выполняет эффектов и не
 *  знает про клики, поэтому «нажал дубль — появилась копия» проверяется прямо
 *  на сторе, ниже.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
  usePathname: () => "/upload",
  useSearchParams: () => new URLSearchParams(),
}));

/* Хук стора читает ТЕКУЩЕЕ состояние, а не начальное.
 *
 *  Не прихоть теста: zustand 5 на серверном рендере зовёт `getInitialState()`
 *  (react.js), то есть лист рисовался бы пустым, что бы мы в стор ни положили.
 *  Сам стор остаётся настоящим — подменена только его читалка, и потому
 *  `duplicateCabGroup`/`deleteCabGroup` ниже проверяются на живом сторе. */
vi.mock("@/lib/store", async (оригинал) => {
  const настоящий = await оригинал<typeof import("@/lib/store")>();
  const хук = (селектор?: (s: unknown) => unknown) =>
    (селектор ? селектор(настоящий.useStore.getState()) : настоящий.useStore.getState());
  return { ...настоящий, useStore: Object.assign(хук, настоящий.useStore) };
});

const { UploadView } = await import("@/components/views/UploadView");
const { useStore } = await import("@/lib/store");
const { newGroup } = await import("@/lib/groups");

/** Готовая группа и неготовая — ровно тот случай со скриншота владельца. */
function положить() {
  const готовая = newGroup("g1", "Ready", [{ profile: "p1", act: "act_1", source: "server" }]);
  Object.assign(готовая.form, {
    videoLines: "creo.mp4", geo: "DZ", daily: 40, link: "https://example.com",
    nmAd: "[GEO]--[ACT]--[CREO_NAME]",
  });
  const пустая = newGroup("g2", "Empty", [{ profile: "p1", act: "act_2", source: "server" }]);
  Object.assign(пустая.form, { videoLines: "", geo: "", daily: 0, link: "" });
  useStore.setState({ cabGroups: [готовая, пустая], activeGroup: null, snapshot: null });
}

beforeEach(положить);

describe("почему кнопка не работает — сказано на экране", () => {
  const html = () => renderToStaticMarkup(createElement(UploadView));

  /** Разметка САМОЙ кнопки сборки. Искать `disabled` по всему листу нельзя:
   *  строка классов стартера содержит `disabled:cursor-default`, и такой поиск
   *  был бы зелёным всегда — ровно тот сторож, что не проверяет ничего. */
  const кнопкаСборки = (h: string) => {
    const где = h.indexOf("<span>Build prompt");
    expect(где, "кнопки сборки промпта нет на листе").toBeGreaterThan(-1);
    return h.slice(h.lastIndexOf("<button", где), где);
  };

  it("кнопка сборки промпта ВЫКЛЮЧЕНА, пока есть неготовая группа", () => {
    // Именно атрибут, а не вид: вид проверяется правилом CSS ниже.
    expect(кнопкаСборки(html())).toContain("disabled=\"\"");
  });

  it("названа группа и названо, чего в ней не хватает", () => {
    const h = html();
    expect(h).toContain("Empty");
    for (const чего of ["creatives", "geo", "budget", "link"]) expect(h).toContain(чего);
  });

  it("готовая группа в список неготовых не попадает", () => {
    const h = html();
    const блок = h.slice(h.indexOf("the prompt is blocked"));
    expect(блок).not.toContain(">Ready<");
  });

  it("все группы готовы — блока нет вовсе, кнопка живая", () => {
    const [готовая] = useStore.getState().cabGroups;
    useStore.setState({ cabGroups: [готовая] });
    const h = html();
    expect(h).not.toContain("the prompt is blocked");
    expect(кнопкаСборки(h)).not.toContain("disabled=\"\"");
  });
});

describe("группу можно продублировать и удалить", () => {
  it("обе кнопки есть у КАЖДОЙ группы и подписаны для читалки", () => {
    const h = renderToStaticMarkup(createElement(UploadView));
    for (const имя of ["Ready", "Empty"]) {
      expect(h).toContain(`aria-label="Duplicate ${имя}"`);
      expect(h).toContain(`aria-label="Delete ${имя}"`);
    }
  });

  it("дубль повторяет состав и связку, а не ссылается на них", () => {
    useStore.getState().duplicateCabGroup("g1");
    const группы = useStore.getState().cabGroups;
    expect(группы).toHaveLength(3);
    const копия = группы[2];
    expect(копия.members).toEqual(группы[0].members);
    expect(копия.members).not.toBe(группы[0].members);
    expect(копия.form.geo).toBe("DZ");
  });

  it("удаление снимает группу и не трогает соседнюю", () => {
    useStore.getState().deleteCabGroup("g2");
    expect(useStore.getState().cabGroups.map((g) => g.id)).toEqual(["g1"]);
  });
});

/* ВИД ВЫКЛЮЧЕННОЙ КНОПКИ ДЕРЖИТСЯ ПРАВИЛОМ, А НЕ ПАМЯТЬЮ.
   `.accent-fill` объявлен вне слоёв Tailwind и потому бьёт утилиты ВСЕГДА —
   включая те, которыми react-aria красит `isDisabled`. Пока условие не стояло
   в самом селекторе, выключенная главная кнопка экрана выглядела рабочей.
   Тест читает НАСТОЯЩИЙ файл стилей, а не свою копию правила. */
describe("выключенное акцентом не красится", () => {
  it("селектор .accent-fill исключает выключенные элементы", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8",
    );
    const правило = css
      .split("\n")
      .find((s) => s.trimStart().startsWith(".accent-fill") && s.includes("{"));
    expect(правило, "правило .accent-fill не найдено — переименовали?").toBeTruthy();
    expect(правило).toContain(":not(:disabled)");
    expect(правило).toContain("[data-disabled]");
  });
});

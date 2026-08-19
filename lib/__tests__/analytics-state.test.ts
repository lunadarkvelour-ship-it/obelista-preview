/* Состояние листа аналитики обязано переживать перезагрузку.
 *
 *  Раньше `load()` безусловно делал setDetails({}) / setOpen(new Set()) /
 *  setSelected(new Set()), а авто-рефреш звал его раз в 60 секунд и на каждый
 *  visibilitychange — развороты и отметки умирали раз в минуту. Комментарий в
 *  коде при этом обещал ровно обратное: «Раскрытые ветки и отметки переживают
 *  перезагрузку».
 */
import { describe, expect, it } from "vitest";
import { blankAnalytics, migrateAnalytics } from "@/lib/store";
import { DEFAULT_VISIBLE } from "@/lib/analytics-columns";

describe("миграция среза analytics", () => {
  it("подхватывает колонки из старого ключа localStorage", () => {
    expect(migrateAnalytics({}, ["spend", "ftd"]).visible).toEqual(["spend", "ftd"]);
  });

  it("без старого ключа даёт дефолтный набор", () => {
    expect(migrateAnalytics({}, null).visible).toEqual([...DEFAULT_VISIBLE]);
  });

  it("пустой старый список не затирает дефолт", () => {
    expect(migrateAnalytics({}, []).visible).toEqual([...DEFAULT_VISIBLE]);
  });

  it("уже сохранённый срез не перетирается", () => {
    const saved = { ...blankAnalytics(), sortKey: "spend", open: ["cr:dz5"] };
    const got = migrateAnalytics({ analytics: saved }, ["ftd"]);
    expect(got.sortKey).toBe("spend");
    expect(got.open).toEqual(["cr:dz5"]);
  });
});

describe("blankAnalytics", () => {
  it("развороты и отметки пустые, но поля есть — их сериализует JSON", () => {
    const a = blankAnalytics();
    expect(a.open).toEqual([]);
    expect(a.selected).toEqual([]);
    expect(Array.isArray(a.open)).toBe(true);
  });

  it("скрытие крео без спенда включено по умолчанию", () => {
    expect(blankAnalytics().hideNoSpend).toBe(true);
  });

  it("каждый вызов даёт независимый объект", () => {
    const a = blankAnalytics();
    a.visible.push("сломал бы общий массив");
    expect(blankAnalytics().visible).toEqual([...DEFAULT_VISIBLE]);
  });
});

describe("сортировка внутри ветки", () => {
  it("у нового среза она своя и не совпадает с верхней", () => {
    /* Наверху вопрос «какой крео лучше» — отвечают депы. Внутри «на каком
       кабе он идёт» — отвечает расход: ищут каб, который жрёт и не отдаёт.
       Один ключ на оба вопроса заставлял выбирать между ними. */
    const a = blankAnalytics();
    expect(a.sortKey).toBe("ftd");
    expect(a.branchKey).toBe("spend");
    expect(a.branchDesc).toBe(true);
  });

  it("старый сохранённый срез получает сортировку ветки, а не undefined", () => {
    /* Настройка появилась позже самого среза. Без подстановки у того, кто уже
       что-то настроил, ключ приехал бы пустым, и сортировка кабов молча
       отключилась бы — порядок стал бы «как пришло из базы». */
    const старый = { ...blankAnalytics(), visible: ["ftd"] } as Record<string, unknown>;
    delete старый.branchKey;
    delete старый.branchDesc;
    const got = migrateAnalytics({ analytics: старый }, null);
    expect(got.branchKey).toBe("spend");
    expect(got.branchDesc).toBe(true);
    // Остальное, что юзер настроил, остаётся нетронутым.
    expect(got.visible).toEqual(["ftd"]);
  });

  it("уже сохранённый выбор ветки не перетирается дефолтом", () => {
    const got = migrateAnalytics(
      { analytics: { ...blankAnalytics(), branchKey: "cpftd", branchDesc: false } },
      null,
    );
    expect(got.branchKey).toBe("cpftd");
    expect(got.branchDesc).toBe(false);
  });
});

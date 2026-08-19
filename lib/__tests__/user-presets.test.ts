import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "@/lib/store";
import { ALL_SCOPE_IDS } from "@/lib/preset-scope";
import { DEFAULT_FORM } from "@/lib/seed";

/* Тесты гоняются в node, где localStorage нет: persist на каждый set пишет в
   stderr, что хранилище недоступно. На результат это не влияет — сам стор в
   памяти, — но в выводе шумно. */
const s = () => useStore.getState();

describe("пресеты с областью", () => {
  beforeEach(() => {
    useStore.setState({ userPresets: {}, form: { ...s().form, geo: "DZ", daily: 70, link: "https://old" } });
  });

  it("пресет «только таргетинг» меняет таргетинг и не трогает остальное", () => {
    s().patchForm({ geo: "UA", ageMin: 30 });
    s().saveUserPreset("ua", ["targeting"]);

    // Уходим в другой сетап целиком.
    s().patchForm({ geo: "DZ", ageMin: 18, daily: 5, link: "https://new" });
    s().applyUserPreset("ua");

    expect(s().form.geo).toBe("UA");
    expect(s().form.ageMin).toBe(30);
    // Бюджет и оффер в область не входили — остаются как были.
    expect(s().form.daily).toBe(5);
    expect(s().form.link).toBe("https://new");
  });

  it("узкий пресет не подменяет выбранные кабы", () => {
    const p = s().form.profile;
    useStore.setState({ picked: { [p]: ["act_1", "act_2"] } });
    s().saveUserPreset("бюджет", ["budget"]);
    useStore.setState({ picked: { [p]: ["act_9"] } });

    s().applyUserPreset("бюджет");
    expect(s().picked[p]).toEqual(["act_9"]);
  });

  it("пресет старого формата (без области) заменяет сетап целиком", () => {
    // Так их писала прежняя версия: вся форма и никакого scope.
    useStore.setState({
      userPresets: { старый: { form: { ...DEFAULT_FORM, geo: "PL" }, picked: [], groups: [] } },
    });
    s().patchForm({ geo: "DZ", daily: 999 });
    s().applyUserPreset("старый");

    expect(s().form.geo).toBe("PL");
    expect(s().form.daily).toBe(DEFAULT_FORM.daily);
  });

  /* Кнопка «сохранить пресет» стоит на листе «Аплоад», а там правится форма
     ГРУППЫ, не конструктора. Сохрани она форму конструктора — человек получил
     бы пресет с сетапом, которого не видел, и узнал бы об этом на заливе. */
  it("сохранение из группы берёт форму этой группы, а не конструктора", () => {
    useStore.setState({ cabGroups: [], cabSelection: [], activeGroup: null });
    useStore.getState().setCabSelection([{ profile: "k1a", act: "act_1" }]);
    const id = useStore.getState().createGroupFromSelection("Алжир");
    if (!id) throw new Error("группа не создалась");

    s().setGroupField(id, "geo", "MA");
    s().setGroupField(id, "daily", 33);
    // Форма конструктора остаётся другой — именно её пресет брать не должен.
    s().patchForm({ geo: "DZ", daily: 70 });

    s().saveUserPreset("из связки", ["targeting", "budget"], id);

    expect(s().userPresets["из связки"].form.geo).toBe("MA");
    expect(s().userPresets["из связки"].form.daily).toBe(33);
  });

  it("группы уже нет — пресет не создаётся, а не берёт чужой сетап", () => {
    useStore.setState({ cabGroups: [] });
    s().saveUserPreset("призрак", ALL_SCOPE_IDS, "нет-такой-группы");
    expect(s().userPresets["призрак"]).toBeUndefined();
  });

  it("переименование сохраняет содержимое и порядок", () => {
    s().patchForm({ geo: "ES" });
    s().saveUserPreset("первый", ALL_SCOPE_IDS);
    s().saveUserPreset("второй", ALL_SCOPE_IDS);
    s().renameUserPreset("первый", "новый");

    expect(Object.keys(s().userPresets)).toEqual(["новый", "второй"]);
    expect(s().userPresets["новый"].form.geo).toBe("ES");
  });
});

import { describe, it, expect } from "vitest";
import { DEFAULT_FORM } from "@/lib/seed";
import { ALL_SCOPE_IDS, SCOPE_GROUPS, fieldsForScope, scopeCarries, sliceForm } from "@/lib/preset-scope";
import type { Form } from "@/lib/types";

describe("карта областей пресета", () => {
  it("покрывает каждое поле формы ровно один раз", () => {
    const mapped = SCOPE_GROUPS.flatMap((g) => g.fields);
    const dupes = mapped.filter((f, i) => mapped.indexOf(f) !== i);
    expect(dupes).toEqual([]);

    // Поле, забытое в карте, молча выпало бы из всех пресетов.
    const formKeys = Object.keys(DEFAULT_FORM).sort();
    expect([...mapped].sort()).toEqual(formKeys);
  });

  it("id секций уникальны", () => {
    expect(new Set(ALL_SCOPE_IDS).size).toBe(ALL_SCOPE_IDS.length);
  });

  it("кабы несёт профиль, хвост-группы — своя секция", () => {
    expect(scopeCarries(["profile"], "picked")).toBe(true);
    expect(scopeCarries(["targeting"], "picked")).toBe(false);
    expect(scopeCarries(["groups"], "groups")).toBe(true);
    expect(scopeCarries(["profile"], "groups")).toBe(false);
  });
});

describe("срез формы по области", () => {
  const form: Form = { ...DEFAULT_FORM, geo: "UA", daily: 42, link: "https://example.com" };

  it("берёт только поля выбранных секций", () => {
    const slice = sliceForm(form, ["targeting", "budget"]);
    expect(slice.geo).toBe("UA");
    expect(slice.daily).toBe(42);
    // Оффер в область не входит — пресет не должен его перетирать.
    expect("link" in slice).toBe(false);
    expect("profile" in slice).toBe(false);
  });

  it("полная область даёт все поля формы", () => {
    expect(Object.keys(sliceForm(form, ALL_SCOPE_IDS)).sort()).toEqual(Object.keys(DEFAULT_FORM).sort());
  });

  it("пустая область не даёт полей", () => {
    expect(fieldsForScope([])).toEqual([]);
    expect(sliceForm(form, [])).toEqual({});
  });
});

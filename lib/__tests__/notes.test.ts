import { describe, expect, it } from "vitest";
import { blankForm, buildBundle, bundleText, missingOf, newGroup } from "@/lib/groups";
import { buildSpec } from "@/lib/build-spec";
import { resolveState } from "@/lib/form";
import { specToState } from "@/lib/spec-to-state";
import { DEFAULT_FORM } from "@/lib/seed";
import type { BuildCtx, CabGroup, Form } from "@/lib/types";

/* Указания — свободный текст, и проверяется здесь ровно граница между ним и
   спекой. До этого поля прозу писали в `creatives[].file` («Там 4 крео в папке
   from ffmpeg script» рядом с `dz5`), а движок обязан читать `file` как имя
   файла. Поэтому важны две вещи сразу: текст уезжает ОТДЕЛЬНЫМ ключом, и
   старый способ при этом продолжает работать — поле добавлено, а не заменяет. */

const ctx: BuildCtx = {
  tags: {},
  profiles: [{ id: "k1aaa", label: "1/8 hiuhiu", team: "keine" }],
  catalogAll: { k1aaa: [{ id: "act_1", name: "Каб один" }] },
  lichka: {},
  snapshot: null,
};

const READY: Partial<Form> = {
  profile: "k1aaa",
  geo: "EG",
  daily: 20,
  link: "https://land.com",
  videoLines: "dz5\ndz2",
};

function group(over: Partial<Form> = {}): CabGroup {
  const g = newGroup("g1", "EG свежие", [{ profile: "k1aaa", act: "act_1" }]);
  return { ...g, form: { ...blankForm(), ...READY, ...over } };
}

function specOf(over: Partial<Form> = {}) {
  return buildSpec(resolveState({ ...DEFAULT_FORM, ...READY, ...over }, ["act_1"], []), null, ctx);
}

describe("указания в спеке", () => {
  it("едут отдельным ключом, а не внутри креативов", () => {
    const spec = specOf({ notes: "Там 4 крео в папке from ffmpeg script" });
    expect(spec.notes).toBe("Там 4 крео в папке from ffmpeg script");
    // Крео остались чистыми именами — ради этого всё и затевалось.
    expect(spec.creatives.map((c: { video_name_contains: string }) => c.video_name_contains))
      .toEqual(["dz5", "dz2"]);
  });

  it("многострочный текст доезжает целиком", () => {
    const spec = specOf({ notes: "1 адсет — 1 крео\nпо 1 кампании на каб ставим" });
    expect(spec.notes).toBe("1 адсет — 1 крео\nпо 1 кампании на каб ставим");
  });

  it("пустое поле ключа не создаёт: старые связки байт в байт прежние", () => {
    const spec = specOf();
    expect("notes" in spec).toBe(false);
    // Порядок ключей — часть контракта: спеку читают диффом слепка.
    expect(Object.keys(spec).at(-1)).not.toBe("notes");
  });

  it("указания не делают связку неготовой — поле необязательное", () => {
    expect(missingOf(group(), null)).toEqual([]);
    expect(missingOf(group({ notes: "" }), null)).toEqual([]);
  });

  it("форма группы без поля (из старого localStorage) не роняет сборку", () => {
    const old = group();
    delete (old.form as Partial<Form>).notes;
    const [item] = buildBundle([old], ctx);
    expect("notes" in item.spec).toBe(false);
  });
});

describe("нынешний способ продолжает работать", () => {
  it("проза в creatives[].file по-прежнему собирается как раньше", () => {
    const spec = specOf({ creoSrc: "file", videoLines: "dz5\nТам 4 крео в папке from ffmpeg script" });
    expect(spec.creatives.map((c: { file: string }) => c.file))
      .toEqual(["dz5", "Там 4 крео в папке from ffmpeg script"]);
  });

  it("указания и проза в file уживаются вместе", () => {
    const spec = specOf({ creoSrc: "file", videoLines: "dz5\n4 видоса", notes: "крео из ffmpeg" });
    expect(spec.notes).toBe("крео из ffmpeg");
    expect(spec.creatives).toHaveLength(2);
  });
});

describe("указания переживают импорт спеки", () => {
  it("строкой", () => {
    expect(specToState({ notes: "по 1 кампании на каб" }, {}).form.notes).toBe("по 1 кампании на каб");
  });

  it("списком строк — движок принимает и такой вид", () => {
    expect(specToState({ notes: ["первое", "второе"] }, {}).form.notes).toBe("первое\nвторое");
  });

  it("спека без указаний даёт пустое поле, а не undefined", () => {
    expect(specToState({}, {}).form.notes).toBe("");
  });
});

describe("указания в промпте", () => {
  it("печатаются словами и помечены как контекст, а не как команда", () => {
    const text = bundleText([group({ notes: "крео в папке from ffmpeg script" })], ctx);
    expect(text).toContain("крео в папке from ffmpeg script");
    expect(text).toContain("НЕ пересобирать");
    // Записка не должна отменять главный запрет промпта.
    expect(text).toContain("НЕ ПЕРЕСОБИРАЙ");
  });

  it("без указаний лишнего блока в промпте нет", () => {
    expect(bundleText([group()], ctx)).not.toContain("Указания оператора");
  });
});

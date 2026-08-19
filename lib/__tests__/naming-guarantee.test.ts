/* Гарантия: имя крео обязано доехать до имени объявления.
 *
 * Это не стилистика нейминга, а условие, без которого залив бессмысленен для
 * аналитики. Атрибуция режет имя объявления по `--` и берёт ПОСЛЕДНИЙ кусок
 * (core/attrib.py:241-244). Если там не имя крео — объявление не привяжется ни
 * к чему, и его расход осядет в «не опознан» навсегда: имя уже ушло в Мету,
 * переименовывать нечего.
 *
 * Цена известна точно. Дефолтный шаблон `ad--[ACT_LAST4]--[RAND5]` 08.08 дал
 * четырнадцать объявлений и $193, которых лист не смог никому приписать.
 */
import { describe, expect, it } from "vitest";
import { namingWarnings } from "@/lib/validate";
import { ensureCreoName, hasCreoName } from "@/lib/naming-guard";
import { missingOf } from "@/lib/groups";
import { specToState } from "@/lib/spec-to-state";
import { DEFAULT_FORM } from "@/lib/seed";

describe("шаблон имени объявления", () => {
  it("дефолт панели сам по себе безопасен", () => {
    /* Главный тест файла. Дефолт — то, чем зальют, ничего не трогая; именно он
       и был сломан. */
    expect(namingWarnings(DEFAULT_FORM.nmAd)).toEqual([]);
    expect(DEFAULT_FORM.nmAd).toMatch(/\[CREO_NAME\]$/);
  });

  it("шаблон без [CREO_NAME] предупреждает про «не опознан»", () => {
    const w = namingWarnings("ad--[ACT_LAST4]--[RAND5]");
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("will not link these ads to any creative");
  });

  it("[CREO_NAME] не в конце — тоже поломка, только незаметная", () => {
    /* Имя выглядит правильным, а хвост всё равно не тот. */
    const w = namingWarnings("ad--[CREO_NAME]--[RAND5]");
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("must be at the END");
  });

  it("пробелы по краям не считаются нарушением", () => {
    expect(namingWarnings("  ad--[RAND5]--[CREO_NAME]  ")).toEqual([]);
  });

  it("пустой шаблон — то же самое, что и без макроса", () => {
    expect(namingWarnings("")).toHaveLength(1);
  });

  it("похожие, но другие макросы не считаются за имя крео", () => {
    for (const t of ["ad--[CREO]", "ad--[CREO_NAME_2]", "ad--[creo_name]"]) {
      expect(namingWarnings(t), t).toHaveLength(1);
    }
  });
});

describe("гарантия в живом пути", () => {
  const группа = (nmAd: string) => ({
    id: "g1",
    name: "г",
    members: [{ profile: "p", act: "act_1" }],
    form: { ...DEFAULT_FORM, nmAd, videoLines: "dz5", geo: "BD", daily: "10",
            convLoc: "WEBSITE", link: "https://x.y" },
  }) as never;

  it("залив без [CREO_NAME] не считается готовым", () => {
    /* Гейт живого пути — missingOf, а не предупреждения превью: страница
       /preview идёт через buildBundle и validate() не зовёт вовсе. */
    expect(missingOf(группа("ad--[ACT_LAST4]--[RAND5]"), null))
      .toContain("[CREO_NAME] at the end of the ad name");
  });

  it("с [CREO_NAME] в хвосте группа готова", () => {
    expect(missingOf(группа("ad--[RAND5]--[CREO_NAME]"), null)).toEqual([]);
  });

  it("макрос в середине живой путь тоже не пускает", () => {
    expect(missingOf(группа("ad--[CREO_NAME]--[RAND5]"), null))
      .toContain("[CREO_NAME] at the end of the ad name");
  });
});

describe("ensureCreoName", () => {
  it("дописывает в хвост", () => {
    expect(ensureCreoName("ad--[ACT_LAST4]--[RAND5]"))
      .toBe("ad--[ACT_LAST4]--[RAND5]--[CREO_NAME]");
  });

  it("переносит макрос из середины и не плодит разделители", () => {
    /* Без схлопывания пустых звеньев выходило `ad----[RAND5]--[CREO_NAME]`. */
    expect(ensureCreoName("ad--[CREO_NAME]--[RAND5]")).toBe("ad--[RAND5]--[CREO_NAME]");
  });

  it("уже правильный шаблон не трогает", () => {
    expect(ensureCreoName("ad--[RAND5]--[CREO_NAME]")).toBe("ad--[RAND5]--[CREO_NAME]");
  });

  it("пустой даёт минимальный рабочий", () => {
    expect(hasCreoName(ensureCreoName(""))).toBe(true);
  });
});

describe("импорт чужой спеки", () => {
  it("шаблон без макроса чинится на входе", () => {
    /* Импортируем и спеки, написанные руками: в них шаблон бывает любой. */
    const r = specToState({ naming: { ad: "AD[N]" } } as never, {});
    expect(hasCreoName(r.form.nmAd as string)).toBe(true);
  });

  it("спека без нейминга вообще берёт дефолт панели, а не старую копию", () => {
    const r = specToState({} as never, {});
    expect(r.form.nmAd).toBe(DEFAULT_FORM.nmAd);
  });
});

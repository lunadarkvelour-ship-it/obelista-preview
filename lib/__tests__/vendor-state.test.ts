/* Договорённость панели с движком про мёртвого вендора (#163).
 *
 * ЧТО ЗДЕСЬ СТЕРЕЖЁТСЯ. Демон отдаёт про каждую строку листа «Профили» вердикт
 * — «живой», «нет_вендора», «не_подтверждён», — а панель по нему решает, куда
 * строку положить и какую фразу человеку сказать. Это ДВА МЕСТА, обязанные
 * понимать друг друга одинаково, и держится их согласие только тем, что строки
 * совпадают.
 *
 * ПОЭТОМУ ТЕСТ ЧИТАЕТ НАСТОЯЩИЕ ИСХОДНИКИ, а не свою копию. Проверка против
 * фикстуры, переписанной руками из чужого файла, — это второй экземпляр
 * договорённости, и разъедется он так же молча: переименуют константу в
 * `core/registry.py` — панель не упадёт, а тихо перестанет узнавать покойников
 * и вернёт владельцу тот самый список, где среди двух десятков строк не видно
 * трёх своих аккаунтов.
 *
 * Ровно так уже было дважды: `registration_open` читали по имени, а смысл поля
 * сменился; границу «что показывать арендатору» провели словом в комментарии, и
 * слово оказалось шире, чем думал автор.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ВЕНДОР_ЖИВОЙ, ВЕНДОР_НЕТ, ВЕНДОР_НЕ_ПОДТВЕРЖДЁН,
} from "@/lib/analytics";
import {
  listNoUploadReason, noUploadReason, unifiedAccounts,
  type CloudOwner, type UnifiedAccount,
} from "@/lib/cloud-accounts";
import { newsOfVendor, списокНеполон } from "@/lib/socials-rows";

const корень = (...куски: string[]) =>
  readFileSync(path.resolve(__dirname, "..", "..", "..", ...куски), "utf8");

const registry = корень("core", "registry.py");
const daemon = корень("scripts", "analytics_daemon.py");
const antidetect = корень("core", "antidetect.py");

/** Значение питоновской константы вида `ИМЯ = "значение"`. */
function константа(исходник: string, имя: string): string {
  const m = исходник.match(new RegExp(`^${имя}\\s*=\\s*"([^"]+)"`, "m"));
  expect(m, `в исходнике не найдена константа ${имя}`).toBeTruthy();
  return m![1];
}

describe("вердикт вендора: панель и движок называют состояния одинаково", () => {
  it("«живой» — то же слово, что в core/registry.py", () => {
    expect(ВЕНДОР_ЖИВОЙ).toBe(константа(registry, "ВЕНДОР_ЖИВОЙ"));
  });

  it("«вендора нет» — то же слово", () => {
    expect(ВЕНДОР_НЕТ).toBe(константа(registry, "ВЕНДОР_НЕТ"));
  });

  it("«не подтверждён» — то же слово", () => {
    expect(ВЕНДОР_НЕ_ПОДТВЕРЖДЁН).toBe(константа(registry, "ВЕНДОР_НЕ_ПОДТВЕРЖДЁН"));
  });

  it("фраза человеку узнаёт ровно эти значения, а не свои", () => {
    /* Отрицательный контроль внутри проверки: если `newsOfVendor` сверяет
       строки, которых движок не присылает, обе ветки молча выдадут пустоту —
       и человек увидит строку без объяснения, почему у неё нет кнопок. */
    expect(newsOfVendor({ vendor_state: ВЕНДОР_НЕТ })).not.toBe("");
    expect(newsOfVendor({ vendor_state: ВЕНДОР_НЕ_ПОДТВЕРЖДЁН })).not.toBe("");
    expect(newsOfVendor({ vendor_state: ВЕНДОР_ЖИВОЙ })).toBe("");
  });

  it("две новости РАЗНЫЕ: «вендора нет» не предлагает переподключение", () => {
    const мёртвый = newsOfVendor({
      vendor_state: ВЕНДОР_НЕТ, profiles: [{ vendor: "adspower" }],
    });
    expect(мёртвый).toContain("adspower");
    expect(мёртвый).toContain("gone");
    expect(мёртвый).toContain("cannot help");
    expect(newsOfVendor({ vendor_state: ВЕНДОР_НЕ_ПОДТВЕРЖДЁН })).not.toContain("gone");
  });
});

describe("«спросить некого» — новость, но не в облаке", () => {
  it("вендор выбран, антидетект молчит — список неполон, и это сказано", () => {
    expect(списокНеполон({ antik_expected: true, antik_ok: false })).toBe(true);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: в облаке молчание — устройство, а не новость", () => {
    /* Здесь `antik_ok` ложен ВСЕГДА: антидетект слушает 127.0.0.1 у оператора.
       Тревога, горящая у каждого и постоянно, перестаёт читаться за день — и
       тогда её не заметят там, где она настоящая. */
    expect(списокНеполон({ antik_expected: false, antik_ok: false })).toBe(false);
  });

  it("антидетект ответил — тревоги нет", () => {
    expect(списокНеполон({ antik_expected: true, antik_ok: true })).toBe(false);
  });

  it("демон постарше полей не шлёт — молчим, а не выдумываем", () => {
    expect(списокНеполон({})).toBe(false);
  });

  it("демон правда кладёт оба факта в ответ", () => {
    expect(daemon).toMatch(/"antik_ok":\s*antik_ok/);
    expect(daemon).toMatch(/"antik_expected":\s*bool\(antidetect\.текущий\(\)\)/);
  });
});

describe("список сирот приезжает с сервера, а не выдумывается панелью", () => {
  it("демон кладёт его в ответ ключом `orphaned`", () => {
    expect(daemon).toMatch(/"orphaned":\s*сироты/);
  });

  it("демон отбирает сирот по вердикту движка, а не по своему признаку", () => {
    expect(daemon).toContain("registry.ВЕНДОР_НЕТ");
    expect(daemon).toContain("vendor_state");
  });
});

describe("кабинет мёртвого вендора называется своим именем, а не «нет окна»", () => {
  const каб = (owners: CloudOwner[]): UnifiedAccount => unifiedAccounts(
    null, [{ act_id: "act_1", name: "MB3 · 04", status: "ACTIVE", owners }])[0];

  const соц = (o: Partial<CloudOwner>): CloudOwner =>
    ({ profile_id: "k1a", name: "17/7 spx", ...o });

  it("все хозяева у мёртвого вендора — причина «вендора нет»", () => {
    const a = каб([соц({ oauth: true, in_antidetect: false, vendor_state: ВЕНДОР_НЕТ })]);
    expect(noUploadReason(a)).toBe("vendor-gone");
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: без вердикта это по-прежнему «нет окна»", () => {
    /* Демон постарше поля не шлёт. Тогда ответ обязан остаться прежним, а не
       превратиться в приговор: «вендора нет» человеку не чинится, и объявлять
       это по умолчанию значит списать живой парк. */
    const a = каб([соц({ oauth: true, in_antidetect: false })]);
    expect(noUploadReason(a)).toBe("no-live-window");
  });

  it("хоть один хозяин у живого вендора — приговора нет", () => {
    const a = каб([
      соц({ profile_id: "k1a", oauth: true, in_antidetect: false, vendor_state: ВЕНДОР_НЕТ }),
      соц({ profile_id: "shard-1", oauth: true, in_antidetect: false }),
    ]);
    expect(noUploadReason(a)).toBe("no-live-window");
  });

  it("по всему листу починимое сильнее нечинимого", () => {
    const мёртвый = каб([соц({ oauth: true, in_antidetect: false, vendor_state: ВЕНДОР_НЕТ })]);
    const починимый = каб([соц({ profile_id: "shard-1", oauth: true, in_antidetect: false })]);
    expect(listNoUploadReason([мёртвый, починимый])).toBe("no-live-window");
    expect(listNoUploadReason([мёртвый])).toBe("vendor-gone");
  });
});

describe("живой вендор — тот, к которому есть адаптер", () => {
  it("список адаптеров в core/antidetect.py непустой и содержит shardx", () => {
    /* Если адаптеров не останется ни одного, «живым» не будет НИ ОДИН профиль,
       и лист опустеет целиком — это не гипотеза, а то самое состояние, в
       котором продукт был бы после следующего переезда. */
    const m = antidetect.match(/ADAPTERS:\s*dict\s*=\s*\{([^}]*)\}/s);
    expect(m, "в core/antidetect.py не найден список адаптеров").toBeTruthy();
    expect(m![1]).toContain('"shardx"');
  });
});

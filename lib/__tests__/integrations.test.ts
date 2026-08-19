/* Лист подключений: модель состояний и обещание модульности (иссус #126).
 *
 * Два разных предмета проверки, и второй важнее первого.
 *
 * 1. ТРИ СОСТОЯНИЯ И ИХ РАЗЛИЧИМОСТЬ. «Не отвечает» и «не настроено» лечатся
 *    по-разному, и слить их в одно «не работает» — не мелкая небрежность, а
 *    потерянная диагностика: на каждой поломке человек начинает с вопроса,
 *    был ли вообще ключ.
 *
 * 2. КАРТОЧКА НЕ ПРИБИТА К ИМЕНИ ВЕНДОРА. Это обещание нельзя проверить
 *    глазами на ревью: имя вендора въезжает в компонент копипастой соседнего
 *    блока, дифф выглядит безобидно, а через три вендора выясняется, что
 *    четвёртый требует переписать девять мест — ровно история иссуса #26.
 *    Поэтому проверка грепом по исходнику, как у `no-adspower.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomIntegrationCard } from "@/components/sections/integrations/CustomIntegrationCard";
import {
  CONN_STATES,
  FUNNEL_STEPS,
  NO_BACKEND_CONTEXT,
  connCheckLine,
  connState,
  connStateLabel,
  connStateTone,
  funnelMissing,
  missingToConnect,
} from "@/lib/integrations";
import { ALL_VENDORS, SECTIONS, SECTION_ICON } from "@/lib/integrations-registry";
import { TRACKERS } from "@/lib/integrations-trackers";
import { CUSTOM_INTEGRATION } from "@/lib/integrations-custom";
import { LEAVES } from "@/components/shell/leaves";

/** Корень панели: `panel/lib/__tests__` → `panel`. */
const ROOT = path.resolve(__dirname, "..", "..");

const читать = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/** Исходник без комментариев.
 *
 *  Греп по именам вендоров обязан смотреть на КОД, а не на прозу. В шапках
 *  этих файлов вендоры названы нарочно — там объясняется, откуда взялось
 *  правило и чем кончилось его нарушение в прошлый раз (иссус #26). Запретить
 *  и это значило бы выбросить объяснение ради буквы проверки: сторож, который
 *  требует стереть причину своего существования, вредит.
 *
 *  Срезка грубая — блоки `/* *​/` и хвосты `//`. Для трёх файлов, в которых
 *  двойного слэша нет ни в одной строке-значении, этого достаточно; появится
 *  такой — падение будет громким и ложным, а не тихим и пропущенным. */
const безКомментариев = (текст: string) =>
  текст.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("три состояния подключения", () => {
  it("их ровно три, и порядок канонический", () => {
    expect(CONN_STATES).toEqual(["not_configured", "connected", "unreachable"]);
  });

  it("нет настроек — «не настроено», чем бы ни кончилась последняя проверка", () => {
    // Проверка без сохранённых настроек — это провал НАШЕГО пустого запроса,
    // а не чужого трекера, и красить его в «не отвечает» значит послать
    // человека чинить исправную сторону.
    expect(connState({ configured: false })).toBe("not_configured");
    expect(connState({ configured: false, lastCheck: { at: "сейчас", ok: false } })).toBe("not_configured");
  });

  it("настройки есть, проверка прошла — «подключено»", () => {
    expect(connState({ configured: true, lastCheck: { at: "сейчас", ok: true } })).toBe("connected");
  });

  it("настройки есть, проверка провалилась — «не отвечает», а не «не настроено»", () => {
    expect(connState({ configured: true, lastCheck: { at: "сейчас", ok: false, reason: "401" } }))
      .toBe("unreachable");
  });

  it("сохранено, но ни разу не проверено — состояние не красное, честность в строке рядом", () => {
    // Четвёртого состояния нет намеренно (см. шапку `connCheckLine`): красная
    // тревога на свежесохранённом подключении — ложная, а ложная тревога учит
    // выключать сторожа. Но и молчать нельзя: строка обязана сказать, что
    // ответ не подтверждён.
    const ctx = { configured: true };
    expect(connState(ctx)).toBe("connected");
    expect(connCheckLine(ctx)).toMatch(/never checked/i);
  });

  it("строка проверки различает все четыре положения дел", () => {
    const строки = [
      connCheckLine({ configured: false }),
      connCheckLine({ configured: true }),
      connCheckLine({ configured: true, lastCheck: { at: "12:00", ok: true } }),
      connCheckLine({ configured: true, lastCheck: { at: "12:00", ok: false, reason: "key expired" } }),
    ];
    expect(new Set(строки).size).toBe(4);
    // Причина отказа доезжает до экрана дословно: общее «ошибка» отбрасывает
    // диагностику ровно так же, как общий тип исключения в движке (#26).
    expect(строки[3]).toContain("key expired");
  });

  it("причина не пришла — фолбэк не притворяется причиной", () => {
    expect(connCheckLine({ configured: true, lastCheck: { at: "12:00", ok: false } }))
      .toMatch(/no reason/i);
  });

  it("у трёх состояний три разные подписи и разные тона", () => {
    /* Абзацев-расшифровок больше нет (#157): они объясняли словами то, что
       написано на пилюле. Различие держится не текстом, а подписью и тоном —
       ровно то, что проверяется здесь. */
    const подписи = CONN_STATES.map(connStateLabel);
    expect(new Set(подписи).size).toBe(3);
    // Самое главное: «не отвечает» обязано отличаться от «не настроено» и
    // цветом тоже, иначе на экране они сливаются, как бы ни назывались.
    expect(connStateTone("unreachable")).not.toBe(connStateTone("not_configured"));
    expect(connStateTone("connected")).not.toBe(connStateTone("unreachable"));
  });

  it("сегодня контекст любого вендора — «не настроено»", () => {
    // Не фикстура и не «данные ещё не пришли»: хранить настройки негде.
    expect(connState(NO_BACKEND_CONTEXT)).toBe("not_configured");
  });
});

describe("вендор описан модулем, а не разметкой", () => {
  it("реестр собран из разделов, и раздел вендора совпадает с местом", () => {
    /* Разделов было два; антидетект снят целиком (#157) — подключать его с
       этого листа нельзя по устройству, и объяснение уехало на лист профилей.
       Проверяем механизм, а не число: реестр обязан оставаться реестром, чтобы
       следующий раздел приезжал строкой, а не правкой компонентов. */
    expect(SECTIONS.length).toBeGreaterThanOrEqual(1);
    for (const s of SECTIONS) {
      expect(s.vendors.length).toBeGreaterThan(0);
      expect(SECTION_ICON[s.id]).toBeTruthy();
      for (const v of s.vendors) expect(v.section).toBe(s.id);
    }
  });

  it("идентификаторы уникальны, а обязательный текст не пуст", () => {
    const ids = ALL_VENDORS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of ALL_VENDORS) {
      for (const поле of [v.name, v.mark, v.summary, v.supportNote, v.fieldsNote]) {
        expect(поле.trim().length, v.id).toBeGreaterThan(0);
      }
      // Монограмма — не логотип и не полное имя: две-три буквы, иначе плитка
      // перестаёт быть плиткой.
      expect(v.mark.length, v.id).toBeLessThanOrEqual(3);
      const ключи = v.fields.map((f) => f.key);
      expect(new Set(ключи).size, v.id).toBe(ключи.length);
    }
  });

  it("шесть названных владельцем трекеров на листе есть", () => {
    /* СЧИТАЛОСЬ РОВНО ШЕСТЬ, стало «шесть названных и, может быть, больше».
       Правка не ослабление: обещание иссуса #126 — что на листе есть те шесть,
       которые владелец назвал, и оно проверяется теперь поимённо, то есть
       строже прежнего счётчика. А точное число ломалось на первом же законном
       пополнении раздела — им стал источник, присылающий воронку из браузера
       (#120): у CRM без токена другого пути в облако нет вовсе.

       Про антидетект здесь больше не спрашиваем: раздел снят целиком (#157). */
    const трекеры = SECTIONS.find((s) => s.id === "trackers");
    expect(TRACKERS.length).toBe(6);
    for (const v of TRACKERS) expect(трекеры?.vendors, v.id).toContain(v);
  });

  it("нет адаптера — нет и выдуманных полей с выдуманной воронкой", () => {
    // Набор настроек решает адаптер. Список, придуманный вперёд, — это форма,
    // которая просит не то, что понадобится, и выглядит при этом рабочей.
    for (const v of ALL_VENDORS.filter((v) => v.support === "none")) {
      expect(v.fields, v.id).toEqual([]);
      expect(v.gives, v.id).toBeUndefined();
    }
  });

  it("у написанного адаптера поля названы ключами движка, адрес и ключ обязательны", () => {
    for (const v of ALL_VENDORS.filter((v) => v.support === "written")) {
      const обязательные = v.fields.filter((f) => f.required).map((f) => f.key);
      expect(обязательные.sort(), v.id).toEqual(["api_key", "url"]);
      // Ключ — секрет, и это свойство поля, а не аккуратность вёрстки: от него
      // зависит, попадёт ли он в адрес запроса и в лог.
      expect(v.fields.find((f) => f.key === "api_key")?.kind, v.id).toBe("secret");
    }
  });
});

describe("чего не хватает — считается, а не пишется в карточке", () => {
  it("сегодня не хватает у КАЖДОГО вендора, включая готового", () => {
    // Даже у того, чей адаптер в движке: проверять связь всё равно некому, и
    // «подключено» от «не отвечает» панель отличить не может.
    for (const v of ALL_VENDORS) {
      expect(missingToConnect(v).length, v.id).toBeGreaterThan(0);
    }
  });

  it("нет адаптера — это названо первой строкой, а не спрятано за ручками", () => {
    const v = ALL_VENDORS.find((v) => v.support === "none")!;
    expect(missingToConnect(v)[0]).toMatch(/no adapter/i);
  });

  it("живой движок и живые ручки — список пуст", () => {
    // Ловушка на противоположную ошибку: если бы «не хватает» было
    // захардкожено текстом, оно осталось бы на экране и в тот день, когда
    // всего хватает.
    const готовый = ALL_VENDORS.find((v) => v.support === "shipped" && v.fields.length === 0)!;
    expect(missingToConnect(готовый, { store: true, check: true })).toEqual([]);
  });
});

describe("воронка: чего у источника нет — прочерк, а не ноль", () => {
  it("недостающее считается дополнением, а не вторым списком", () => {
    expect(funnelMissing(["sub", "revenue"])).toEqual(
      FUNNEL_STEPS.filter((s) => s !== "sub" && s !== "revenue"),
    );
    expect(funnelMissing(FUNNEL_STEPS)).toEqual([]);
  });

  it("шаги воронки названы так же, как колонки движка", () => {
    // `core/sources/base.py:CANON` — тот же порядок и те же имена. Разъедутся
    // — и каждая сверка начинается с перевода наших слов в их колонки.
    expect(FUNNEL_STEPS).toEqual(["sub", "contact", "checkout", "ftd", "rd", "revenue"]);
  });
});

describe("карточка не знает ни одного имени вендора", () => {
  /* Обещание иссуса «добавление нового трекера = новый модуль» с фронтовой
     стороны. Проверяем по исходнику: имя вендора въезжает в компонент
     копипастой, и на ревью такой дифф выглядит безобидно. */
  const слова = [
    ...ALL_VENDORS.map((v) => v.name),
    ...ALL_VENDORS.map((v) => v.id),
    ...ALL_VENDORS.map((v) => v.mark),
  ];

  it.each([
    "components/sections/integrations/VendorCard.tsx",
    "components/views/IntegrationsView.tsx",
    "lib/integrations.ts",
  ])("%s", (файл) => {
    const текст = безКомментариев(читать(файл));
    const найдено = слова.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(текст));
    expect(найдено).toEqual([]);
  });
});

describe("дверь для самописного источника", () => {
  it("описан контракт движка целиком, а не половина", () => {
    // Четыре ответа — `core/sources/base.py`: уровни, как спросить, как лечь в
    // канон, чем опознаётся объявление. Пропущенный четвёртый — это модуль,
    // цифры которого не сшиваются ни с чем.
    expect(CUSTOM_INTEGRATION.steps.map((s) => s.name)).toEqual(["levels", "url", "parse", "join_by"]);
    expect(CUSTOM_INTEGRATION.where).toContain("core/sources/");
    expect(CUSTOM_INTEGRATION.rules.length).toBeGreaterThanOrEqual(3);
  });

  it("сказано вслух, что из панели свой источник добавить нельзя", () => {
    expect(CUSTOM_INTEGRATION.missing.join(" ")).toMatch(/no way to add a source from the panel/i);
  });

  it("дверь видна без раскрывания, а инструкция — под ней", () => {
    /* Требование владельца с высоким приоритетом: место под самописный
       источник должно быть ВИДНО, даже пока подключать нечего.

       СТОРОЖ ПЕРЕПИСАН ПО #157. Он требовал, чтобы в карточке не было ни одной
       раскрывашки, — и тем самым запрещал единственный способ сделать её
       короткой. Предмет требования не «нет тега <details>», а «имя и
       приглашение читаются без нажатия»: под нажатием лежит контракт движка,
       который читает тот, кто уже сел писать модуль. Проверяем ровно это —
       заголовок и приглашение стоят ВЫШЕ первой раскрывашки. */
    expect(читать("components/views/IntegrationsView.tsx")).toMatch(/<CustomIntegrationCard\s*\/>/);

    const html = renderToStaticMarkup(createElement(CustomIntegrationCard));
    const дверь = html.indexOf(CUSTOM_INTEGRATION.title);
    const приглашение = html.indexOf(CUSTOM_INTEGRATION.blurb.slice(0, 40));
    const раскрывашка = html.indexOf("<details");
    expect(дверь).toBeGreaterThanOrEqual(0);
    expect(приглашение).toBeGreaterThanOrEqual(0);
    // Раскрывашка может и исчезнуть — тогда видно вообще всё, и это тоже верно.
    if (раскрывашка >= 0) {
      expect(дверь).toBeLessThan(раскрывашка);
      expect(приглашение).toBeLessThan(раскрывашка);
    }
  });
});

describe("вход мышью", () => {
  it("подключения — пункт меню, а не только прямой адрес", () => {
    // Лист /rules однажды приземлился в main без входа мышью (#52), потому что
    // файл меню был занят другой работой. Прямое утверждение не даёт повториться.
    expect(LEAVES.map((l) => l.href)).toContain("/integrations");
  });
});

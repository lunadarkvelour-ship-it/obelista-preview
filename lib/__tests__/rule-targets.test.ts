/* Пикер целей автоправила: договорённость панели с движком, проверенная по
 * НАСТОЯЩЕМУ ИСТОЧНИКУ, а не по нашей копии его формы.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ, а не комментарий. До 16.08 в трёх местах панели было
 * написано словами, что ручки каталога у сборщика «ещё нет» и цель придётся
 * вбивать номером руками. Ручка появилась, слова остались, и всю неделю они
 * читались как правда — их писал не лжец, мир сдвинулся под ними. Комментарий
 * не умеет стареть вместе с кодом, поэтому договорённость держится отсюда.
 *
 * ЧЕМ ЭТО МОЖЕТ СОВРАТЬ МОЛЧА — ровно то, что здесь и ловится:
 *
 *  1. Переименуют на бэкенде путь или параметр — панель не упадёт ни
 *     компилятором, ни тестом на своих фикстурах. Она получит отказ, покажет
 *     «Nothing collected at this level yet» и вернётся к состоянию «мы ничего
 *     не знаем» на всём парке — то есть ровно к тому, ради выхода из которого
 *     пикер и писался. Узнать об этом будет неоткуда.
 *  2. Переименуют поле строки — объект приедет без имени, и человек увидит
 *     список id, каждый из которых он и так не мог разобрать в Ads Manager.
 *  3. Признак «показано не всё» посчитают на нашей стороне по длине списка.
 *     Это вторая копия предела: совпадает ровно до первого вызова с другим
 *     пределом, а потом молча врёт в удобную сторону — список урезан, признак
 *     говорит «всё влезло», человек выбирает из половины парка. Тот же дефект
 *     уже вылечен внутри движка (`core/rule_targets.py`, `ПРЕДЕЛ`), и завозить
 *     его обратно через панель здесь запрещено.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { RULE_TARGETS_PATH, fetchRuleTargets, targetLabel,
         type RuleTarget } from "@/lib/rule-targets";
import { NoHandle } from "@/lib/campaigns";
import { RULE_SCOPES } from "@/lib/rules";

/** Корень репозитория: `panel/lib/__tests__` → вверх на три. */
const КОРЕНЬ = path.resolve(__dirname, "..", "..", "..");
const источник = (...p: string[]) => readFileSync(path.join(КОРЕНЬ, ...p), "utf8");

const демон = источник("scripts", "analytics_daemon.py");
const каталог = источник("core", "rule_targets.py");

/** Кусок файла между двумя якорями. Начало проверяется вызывающим отдельно:
 *  `indexOf` на переименованном якоре вернул бы -1, срез стал бы всем файлом, и
 *  в нём нашлось бы что угодно — тест остался бы зелёным, ничего не проверяя. */
function блок(текст: string, от: string, до: string): string {
  const начало = текст.indexOf(от);
  expect(начало, `якорь не найден: ${от}`).toBeGreaterThan(0);
  const конец = текст.indexOf(до, начало);
  expect(конец, `конец блока не найден: ${до}`).toBeGreaterThan(начало);
  return текст.slice(начало, конец);
}

describe("контракт стыка: ручка каталога у демона та же, что зовёт панель", () => {
  it("путь из `lib/rule-targets` правда разбирается роутером демона", () => {
    /* Сверяем КОНСТАНТУ панели, а не строку-двойника: тест, в котором путь
       набран руками, проверяет совпадение теста с демоном, а не панели с ним. */
    expect(демон).toContain(`if path == "${RULE_TARGETS_PATH}":`);
  });

  it("демон читает ровно те параметры, что панель кладёт в запрос", () => {
    const ветка = блок(демон, `if path == "${RULE_TARGETS_PATH}":`,
                       'if path == "/rule_scope":');
    /* Панель шлёт эти четыре и ничего больше (`fetchRuleTargets`). Пропажа
       любого — не поломка, а тихое расширение выборки: `social`/`act_id`
       перестанут сужать, `q` перестанет искать, и человек получит первые 500
       строк парка вместо своей кампании, без единого сообщения об ошибке. */
    for (const параметр of ['q.get("level")', 'q.get("social")',
                            'q.get("act_id")', 'q.get("q")']) {
      expect(ветка).toContain(параметр);
    }
    /* И отвечает ровно каталогом, а не своей сборкой ответа рядом. */
    expect(ветка).toContain("rule_targets.каталог(");
  });

  it("ответ каталога несёт rows, truncated и limit — все три", () => {
    const функция = блок(каталог, "def каталог(", "# ── Разворот среза");
    for (const поле of ['"rows"', '"truncated"', '"limit"']) {
      expect(функция).toContain(поле);
    }
  });

  it("строка каталога несёт те поля, по которым панель рисует пункт списка", () => {
    const функция = блок(каталог, "def каталог(", "# ── Разворот среза");
    /* id, name, status и act_id приезжают из SELECT, level и personal
       дописываются на месте. Имя показывается человеку, id различает двух
       тёзок, act_id говорит, в каком из 268 кабинетов лежит объект, personal
       предупреждает, что срез правила потом такой кабинет отсеет. */
    expect(функция).toContain("AS id");
    for (const поле of ["name", "status", "act_id"]) expect(функция).toContain(поле);
    expect(функция).toContain('r["level"]');
    expect(функция).toContain('r["personal"]');
  });

  it("уровни у панели и у движка — один и тот же набор", () => {
    /* Второй список означал бы, что новый уровень надо не забыть дописать в
       двух местах, а забывают всегда во втором: пикер молча отдавал бы отказ
       на уровне, который движок уже умеет. */
    const строка = блок(каталог, "УРОВНИ = (", ")\n");
    for (const уровень of RULE_SCOPES) expect(строка).toContain(`"${уровень}"`);
    expect(строка.match(/"/g)?.length).toBe(RULE_SCOPES.length * 2);
  });

  it("«показано не всё» считает ТОТ, КТО РЕЗАЛ, и второй копии предела нет", () => {
    const функция = блок(каталог, "def каталог(", "# ── Разворот среза");
    expect(функция).toContain("len(отобранные) > limit");
    /* А у панели своего предела нет вовсе — ни числом, ни сравнением длины.
       Читаем СВОЙ исходник: типы этого не запрещают, а разъезжается это молча
       и в удобную сторону. */
    const наш = источник("panel", "lib", "rule-targets.ts");
    expect(наш).not.toMatch(/rows\.length\s*[><=]/);
    expect(наш).not.toMatch(/\b500\b/);
  });
});

describe("ручки `/campaigns` и `/campaign_status` существуют", () => {
  /* Тут не «проверяем очевидное». Ровно про эти два пути в панели было написано
     словами, что бэкенда нет; слова сняты 16.08 и заменены фактом. Факт обязан
     держаться механизмом, иначе через месяц он окажется таким же документом,
     пережившим свой предмет, — только теперь в обратную сторону. */
  it("оба пути разбираются роутером демона", () => {
    expect(демон).toContain('if path == "/campaigns":');
    expect(демон).toContain('if path == "/campaign_status":');
  });

  it("и ручки правил тоже — про них было написано то же самое", () => {
    /* `RulesView.tsx` и `lib/rules-store.ts` утверждали, что «ручки под правила
       в демоне нет» и что движка не существует физически. Есть и то и другое
       (`core/rules.py`, #141). Переписано по факту 16.08 — факт держится
       отсюда, иначе он протухнет так же, как предыдущий. */
    expect(демон).toContain('if path == "/rules":');
    expect(демон).toContain('if path == "/rules/log":');
    expect(источник("core", "rules.py")).toContain("def сохранить(");
  });

  it("в панели не осталось подписи «пикера ещё нет»", () => {
    /* Список файлов выводится из дерева, а не переписан руками: рукописный не
       знает про экран, который заведут завтра. */
    function* исходники(dir: string): Generator<string> {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isSymbolicLink()) continue;                 // node_modules воркtree
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "node_modules" && e.name !== ".next") yield* исходники(p);
        } else if (/\.tsx?$/.test(e.name)) yield p;
      }
    }
    const виноватые: string[] = [];
    for (const f of исходники(path.join(КОРЕНЬ, "panel"))) {
      if (f.includes("__tests__")) continue;
      if (/No picker yet/i.test(readFileSync(f, "utf8"))) {
        виноватые.push(path.relative(КОРЕНЬ, f));
      }
    }
    expect(виноватые).toEqual([]);
  });
});

describe("клиент каталога", () => {
  afterEach(() => vi.unstubAllGlobals());

  const ответ = (status: number, body: unknown) => {
    const f = vi.fn().mockResolvedValue({
      status, ok: status < 400, headers: new Headers(), json: async () => body,
    });
    vi.stubGlobal("fetch", f);
    return f;
  };

  const строка = (o: Partial<RuleTarget> = {}): RuleTarget => ({
    id: "120248544415220641", name: "Rome_CPL", status: "ACTIVE",
    act_id: "act_1398031898947759", level: "campaign", ...o,
  });

  it("уровень, поиск и сужение уезжают В ЗАПРОС, а не фильтруют приехавшее", async () => {
    /* Отбор на нашей стороне искал бы по тем строкам, что влезли в предел, то
       есть по началу алфавита: человек набирает имя своей кампании и получает
       пусто при живой кампании. */
    const f = ответ(200, { ok: true, rows: [], truncated: false, limit: 500 });
    await fetchRuleTargets({ level: "campaign", q: "Rome", actId: "act_1",
                             social: "k1m" });
    const url = new URL(String(f.mock.calls[0][0]));
    expect(url.pathname.endsWith(RULE_TARGETS_PATH)).toBe(true);
    expect(url.searchParams.get("level")).toBe("campaign");
    expect(url.searchParams.get("q")).toBe("Rome");
    expect(url.searchParams.get("act_id")).toBe("act_1");
    expect(url.searchParams.get("social")).toBe("k1m");
  });

  it("пустые сужения в запрос не кладутся вовсе", () => {
    /* `act_id=` пустой строкой демон читает как «сузить до кабинета с пустым
       именем» — не то же самое, что «не сужать». */
    const f = ответ(200, { ok: true, rows: [] });
    return fetchRuleTargets({ level: "account", q: "", actId: null }).then(() => {
      const url = new URL(String(f.mock.calls[0][0]));
      expect(url.searchParams.has("q")).toBe(false);
      expect(url.searchParams.has("act_id")).toBe(false);
    });
  });

  it("`truncated` берётся у сервера, а не выводится из длины списка", async () => {
    /* Отрицательный контроль в обе стороны: сервер сказал «урезан» на коротком
       списке — верим ему; сказал «всё влезло» на длинном — тоже верим. Любая
       наша арифметика здесь и есть та вторая копия предела. */
    ответ(200, { ok: true, rows: [строка()], truncated: true, limit: 500 });
    await expect(fetchRuleTargets({ level: "campaign" }))
      .resolves.toMatchObject({ truncated: true, limit: 500 });

    ответ(200, { ok: true, rows: Array.from({ length: 3 }, строка),
                 truncated: false, limit: 2 });
    await expect(fetchRuleTargets({ level: "campaign" }))
      .resolves.toMatchObject({ truncated: false, limit: 2 });
  });

  it("поля `truncated` в ответе нет — это «не урезан», а не поломка", async () => {
    ответ(200, { ok: true, rows: [строка()] });
    await expect(fetchRuleTargets({ level: "campaign" }))
      .resolves.toMatchObject({ truncated: false });
  });

  it("ручки нет на этом деплое — отдельный ответ, а не текст по-русски", async () => {
    /* Демон на незнакомый путь отвечает 400 и внутренней фразой, а не 404
       (проверено на живом проде 15.08). Показать её как есть значило бы
       поставить русский текст в английский интерфейс и позвать человека
       «повторить» там, где лечение — выкат демона. */
    ответ(400, { ok: false, error: `нет такого пути: ${RULE_TARGETS_PATH}` });
    await expect(fetchRuleTargets({ level: "campaign" }))
      .rejects.toBeInstanceOf(NoHandle);
    ответ(404, {});
    await expect(fetchRuleTargets({ level: "campaign" }))
      .rejects.toBeInstanceOf(NoHandle);
  });

  it("настоящий отказ остаётся отказом и едет своим текстом", async () => {
    ответ(500, { ok: false, error: "неизвестный уровень 'кампания'" });
    await expect(fetchRuleTargets({ level: "campaign" }))
      .rejects.toThrow("неизвестный уровень");
    ответ(500, { ok: false, error: "неизвестный уровень 'кампания'" });
    await expect(fetchRuleTargets({ level: "campaign" }))
      .rejects.not.toBeInstanceOf(NoHandle);
  });

  it("строк в ответе нет вовсе — пустой список, а не падение", async () => {
    ответ(200, { ok: true });
    await expect(fetchRuleTargets({ level: "ad" })).resolves.toMatchObject({ rows: [] });
  });
});

describe("подпись объекта в списке", () => {
  const строка = (o: Partial<RuleTarget>): RuleTarget => ({
    id: "120248544415220641", name: null, status: null, act_id: null,
    level: "campaign", ...o,
  });

  it("имя есть — показываем имя", () => {
    expect(targetLabel(строка({ name: "Rome_CPL" }))).toBe("Rome_CPL");
  });

  it("имени нет — id, а не пустота", () => {
    /* Пустая подпись — это пункт списка, который нельзя выбрать осознанно. id
       единственное, что мы про объект точно знаем, и по нему его находят в Ads
       Manager. */
    expect(targetLabel(строка({ name: null }))).toBe("120248544415220641");
    expect(targetLabel(строка({ name: "   " }))).toBe("120248544415220641");
  });
});

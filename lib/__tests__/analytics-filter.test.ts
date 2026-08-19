/* Фильтр дерева: что именно должно уцелеть после отсева.
 *
 *  Главная развилка тут — на каком уровне сработал поиск. Байер ищет то
 *  «крео», то конкретное объявление, и это два разных ожидания: набрал имя
 *  крео — хочу видеть ВСЕ его заливки, набрал кусок имени объявления — хочу
 *  только его, но с родителями, иначе непонятно, чей это каб.
 *
 *  Второй нерв — деньги. Фильтр прячет строки, но не пересчитывает суммы на
 *  родителях: спрятать половину объявлений и одновременно «сжечь» их расход
 *  значит показать байеру неправду о том, сколько ушло с каба.
 */
import { describe, expect, it } from "vitest";
import { filterTree, pathsToHits, type TreeFilter } from "@/lib/analytics-filter";
import type { Node, NodeKind } from "@/lib/analytics-tree";

const OFF: TreeFilter = { q: "", socs: [], statuses: [], methods: [], hideNoSpend: false };
const f = (over: Partial<TreeFilter> = {}): TreeFilter => ({ ...OFF, ...over });

function node(kind: NodeKind, label: string, over: Partial<Node> = {}): Node {
  return {
    id: `${kind}:${label}`,
    kind,
    label,
    spend: 1, clicks: null, sub: null, contact: null, checkout: null,
    ftd: null, rd: null, ads: null, ads_with_ftd: null, geos: [],
    ...over,
  };
}

/** Дерево из двух крео; на первом два каба, на альфе два объявления. */
function tree(): Node[] {
  const alphaAds = [
    node("ad", "spx--BD--ad--alpha", {
      owner: "k1a", status: "ACTIVE", method: "exact_job", spend: 10,
    }),
    node("ad", "spx--BD--ad--beta", {
      owner: "k1a", status: "PAUSED", method: "name_guess", spend: null,
    }),
  ];
  const gammaAd = node("ad", "spx--BD--ad--gamma", {
    owner: "k1b", status: "ACTIVE", method: "exact_job", spend: 5,
  });
  const deltaAd = node("ad", "spx--PK--ad--delta", {
    owner: "k1a", status: "ARCHIVED", method: "exact_job", spend: 7,
  });

  return [
    node("creative", "spx--BD--video1", {
      spend: 15,
      children: [
        node("account", "Каб Альфа", {
          owner: "k1a", spend: 10,
          children: [
            node("campaign", "spx--BD--camp1", {
              spend: 10,
              children: [node("adset", "spx--BD--adset1", { spend: 10, children: alphaAds })],
            }),
          ],
        }),
        node("account", "Каб Бета", {
          owner: "k1b", spend: 5,
          children: [
            node("campaign", "spx--BD--camp2", {
              spend: 5,
              children: [node("adset", "spx--BD--adset2", { spend: 5, children: [gammaAd] })],
            }),
          ],
        }),
      ],
    }),
    node("creative", "spx--PK--video2", {
      spend: 7,
      children: [
        node("account", "Каб Альфа", {
          owner: "k1a", spend: 7,
          children: [
            node("campaign", "spx--PK--camp3", {
              spend: 7,
              children: [node("adset", "spx--PK--adset3", { spend: 7, children: [deltaAd] })],
            }),
          ],
        }),
      ],
    }),
  ];
}

/** Плоский слепок формы дерева: отступ = глубина. Читаемее, чем toEqual на
 *  вложенных объектах, и падение сразу показывает, что именно уцелело. */
function shape(nodes: Node[], depth = 0): string[] {
  return nodes.flatMap((n) => [
    "  ".repeat(depth) + n.label,
    ...shape(n.children ?? [], depth + 1),
  ]);
}

describe("filterTree", () => {
  it("пустой фильтр возвращает дерево как есть, но новыми объектами", () => {
    const roots = tree();
    const out = filterTree(roots, OFF);
    expect(out).toEqual(roots);
    expect(out[0]).not.toBe(roots[0]);
    expect(out[0].children![0]).not.toBe(roots[0].children![0]);
  });

  it("поиск оставляет только ветку с совпавшим объявлением", () => {
    const out = filterTree(tree(), f({ q: "gamma" }));
    expect(shape(out)).toEqual([
      "spx--BD--video1",
      "  Каб Бета",
      "    spx--BD--camp2",
      "      spx--BD--adset2",
      "        spx--BD--ad--gamma",
    ]);
  });

  it("совпадение по имени крео оставляет всех его детей", () => {
    const out = filterTree(tree(), f({ q: "video1" }));
    expect(shape(out)).toEqual([
      "spx--BD--video1",
      "  Каб Альфа",
      "    spx--BD--camp1",
      "      spx--BD--adset1",
      "        spx--BD--ad--alpha",
      "        spx--BD--ad--beta",
      "  Каб Бета",
      "    spx--BD--camp2",
      "      spx--BD--adset2",
      "        spx--BD--ad--gamma",
    ]);
  });

  it("поиск регистронезависим и терпит пробелы по краям", () => {
    const a = filterTree(tree(), f({ q: "GAMMA" }));
    const b = filterTree(tree(), f({ q: "  gamma  " }));
    expect(shape(a)).toEqual(shape(b));
    expect(shape(a)).toContain("        spx--BD--ad--gamma");
  });

  it("ветка без совпадений исчезает целиком", () => {
    expect(filterTree(tree(), f({ q: "нет такого" }))).toEqual([]);
  });

  it("фильтр по статусу режет объявления, а не только красит", () => {
    const out = filterTree(tree(), f({ statuses: ["PAUSED"] }));
    expect(shape(out)).toEqual([
      "spx--BD--video1",
      "  Каб Альфа",
      "    spx--BD--camp1",
      "      spx--BD--adset1",
      "        spx--BD--ad--beta",
    ]);
  });

  it("промежуточная ветка без выживших детей исчезает", () => {
    // ARCHIVED есть только под vid2 — первое крео должно уйти вместе с кабами.
    const out = filterTree(tree(), f({ statuses: ["ARCHIVED"] }));
    expect(shape(out)).toEqual([
      "spx--PK--video2",
      "  Каб Альфа",
      "    spx--PK--camp3",
      "      spx--PK--adset3",
      "        spx--PK--ad--delta",
    ]);
  });

  it("фильтр по методу атрибуции трогает только объявления", () => {
    const out = filterTree(tree(), f({ methods: ["name_guess"] }));
    expect(shape(out)).toEqual([
      "spx--BD--video1",
      "  Каб Альфа",
      "    spx--BD--camp1",
      "      spx--BD--adset1",
      "        spx--BD--ad--beta",
    ]);
  });

  it("hideNoSpend убирает объявления без расхода", () => {
    const out = filterTree(tree(), f({ hideNoSpend: true }));
    expect(shape(out)).not.toContain("        spx--BD--ad--beta");
    expect(shape(out)).toContain("        spx--BD--ad--alpha");
  });

  it("соц режет кабинет целиком, крео без соца судится по детям", () => {
    const out = filterTree(tree(), f({ socs: ["k1b"] }));
    expect(shape(out)).toEqual([
      "spx--BD--video1",
      "  Каб Бета",
      "    spx--BD--camp2",
      "      spx--BD--adset2",
      "        spx--BD--ad--gamma",
    ]);
  });

  it("несколько фильтров сразу применяются вместе", () => {
    const out = filterTree(
      tree(),
      f({ q: "spx", socs: ["k1a"], statuses: ["ACTIVE", "ARCHIVED"], hideNoSpend: true }),
    );
    expect(shape(out)).toEqual([
      "spx--BD--video1",
      "  Каб Альфа",
      "    spx--BD--camp1",
      "      spx--BD--adset1",
      "        spx--BD--ad--alpha",
      "spx--PK--video2",
      "  Каб Альфа",
      "    spx--PK--camp3",
      "      spx--PK--adset3",
      "        spx--PK--ad--delta",
    ]);
  });

  it("узел, совпавший по q, остаётся даже когда все дети отсеяны", () => {
    // Ищем крео целиком, но статусом отсекаем все его объявления: строка крео
    // должна остаться — иначе поиск «нашёл и тут же потерял» результат.
    const out = filterTree(tree(), f({ q: "video1", statuses: ["ARCHIVED"] }));
    expect(shape(out)).toEqual(["spx--BD--video1"]);
    expect(out[0].children).toEqual([]);
  });

  it("суммы на родителях не пересчитываются под скрытые строки", () => {
    const out = filterTree(tree(), f({ statuses: ["PAUSED"] }));
    // beta без расхода, но каб как отдавал 10 — так и отдаёт.
    expect(out[0].spend).toBe(15);
    expect(out[0].children![0].spend).toBe(10);
  });

  it("входное дерево не мутировано", () => {
    const roots = tree();
    const before = JSON.stringify(roots);
    filterTree(roots, f({ q: "gamma", statuses: ["ACTIVE"], hideNoSpend: true }));
    expect(JSON.stringify(roots)).toBe(before);
  });
});

/* Регрессии, снятые с живой панели 08.08.
 *
 * Это не гипотетические случаи: юзер сообщил «фильтры по соцу и статусу вообще
 * не работают», и на панели это воспроизвелось числом — 19 строк до фильтра,
 * 19 после, при выставленном чипсе «соц: k1f9qbcs».
 */
describe("фильтр: чего он раньше не умел", () => {
  it("крео без единого объявления уходит под структурным фильтром", () => {
    /* Ровно тот баг. Пока ветки грузились по клику, у крео не было children, а
       правило «нет детей — оставляем» пропускало его через любой фильтр.
       Соответствовать соцу или статусу такому узлу НЕЧЕМ: оба признака живут
       ниже, на кабе и объявлении. */
    const bare = node("creative", "spx--BD--empty", { spend: 3 });
    expect(filterTree([bare], f({ socs: ["k1a"] }))).toEqual([]);
    expect(filterTree([bare], f({ statuses: ["ACTIVE"] }))).toEqual([]);
    // Без структурного фильтра он остаётся: скрывать строку не за что.
    expect(filterTree([bare], OFF)).toHaveLength(1);
    // И поиск по имени его по-прежнему находит.
    expect(filterTree([bare], f({ q: "empty" }))).toHaveLength(1);
  });

  it("hideNoSpend НЕ убивает крео с незагруженной веткой", () => {
    /* Разница с соцем и статусом: те живут только у потомков, и крео без
       детей соответствовать им нечем. А расход у крео свой, и до дерева уже
       отсеян (`AnalyticsView.tsx:527`) — значит дошедшее сюда крео расход
       имеет. Ветки грузятся по клику, и если бы этот фильтр считался
       структурным, включённый по умолчанию переключатель «без спенда» очистил
       бы весь лист до первого раскрытия. */
    const bare = node("creative", "spx--BD--empty", { spend: 3 });
    expect(filterTree([bare], f({ hideNoSpend: true }))).toHaveLength(1);
  });

  it("hideNoSpend убирает из ветки кабинет, у которого в срезе нет расхода", () => {
    /* Тот самый случай с живой панели 10.08: под сегодняшним срезом в развороте
       всплывали кабинеты мёртвых соцев, потому что из CRM долетал один контакт.
       Расхода у них нет, к суммам крео они прибавляют ноль, а места занимают
       десять строк. */
    const живой = node("account", "Каб Альфа", {
      owner: "k1a", spend: 10,
      children: [node("ad", "ad--alpha", { owner: "k1a", spend: 10 })],
    });
    const призрак = node("account", "Каб Динозавр", {
      owner: "k1мёртвый", spend: null,
      children: [node("ad", "ad--старое", { owner: "k1мёртвый", spend: null, contact: 1 })],
    });
    const крео = node("creative", "spx--BD--video1", {
      spend: 10, children: [живой, призрак],
    });

    const скрыто = filterTree([крео], f({ hideNoSpend: true }));
    expect(скрыто[0].children!.map((c) => c.label)).toEqual(["Каб Альфа"]);

    // Выключил переключатель — история вернулась целиком.
    const показано = filterTree([крео], OFF);
    expect(показано[0].children!.map((c) => c.label)).toEqual(["Каб Альфа", "Каб Динозавр"]);

    // И деньги крео от этого не поехали: суммы фильтр не пересчитывает.
    expect(скрыто[0].spend).toBe(10);
  });

  it("соц спрашивается по всему списку соцев каба, а не по одному владельцу", () => {
    /* `owner` — соц, которым каб можно ТУШИТЬ: он один и только с токеном.
       `socials` — все, кто каб видит. В выпадашке стоял второй список, а
       фильтр проверял первый: семь пунктов из десяти не находили ничего. */
    const acct = node("account", "act_1", {
      owner: "k1tok",
      socials: ["k1tok", "k1нет_токена"],
      children: [node("ad", "ad1", { status: "ACTIVE" })],
    });
    const root = node("creative", "cr", { children: [acct] });
    expect(filterTree([root], f({ socs: ["k1нет_токена"] }))).toHaveLength(1);
    expect(filterTree([root], f({ socs: ["k1чужой"] }))).toEqual([]);
  });

  it("фильтр по соцу ходит по ID, а читаемое имя ему не ключ (XR-25)", () => {
    /* С XR-25 в выпадашке и в чипсах стоит имя соца («17/7 spx»), а не его id.
       Показ и отбор обязаны остаться РАЗНЫМИ вещами: имена не уникальны, и
       фильтр, начавший понимать их, отобрал бы чужие кабы у тёзок. Поэтому
       здесь проверяется именно то, что имя НЕ работает как значение. */
    const acct = node("account", "act_1", {
      owner: "k1a", socials: ["k1a"],
      children: [node("ad", "ad1", { status: "ACTIVE" })],
    });
    const root = node("creative", "cr", { children: [acct] });
    expect(filterTree([root], f({ socs: ["17/7 spx"] }))).toEqual([]);
    expect(filterTree([root], f({ socs: ["k1a"] }))).toHaveLength(1);
  });

  it("статус объявления режет ветку, а не молча пропускает её", () => {
    const out = filterTree(tree(), f({ statuses: ["PAUSED"] }));
    // Уцелела только ветка с beta; каб Бета и всё второе крео ушли.
    expect(shape(out)).toEqual([
      "spx--BD--video1",
      "  Каб Альфа",
      "    spx--BD--camp1",
      "      spx--BD--adset1",
      "        spx--BD--ad--beta",
    ]);
  });
});

describe("дорога до находок", () => {
  it("раскрывает путь к совпадению, но не само совпадение", () => {
    /* Без этого поиск выглядел сломанным: набрал имя объявления, дерево честно
       оставило одну ветку — а на экране одна свёрнутая строка крео. */
    const out = filterTree(tree(), f({ q: "gamma" }));
    expect(pathsToHits(out)).toEqual([
      "creative:spx--BD--video1",
      "account:Каб Бета",
      "campaign:spx--BD--camp2",
      "adset:spx--BD--adset2",
    ]);
  });

  it("совпавший узел не разворачивается — иначе поиск по общему куску вываливает весь лес", () => {
    const out = filterTree(tree(), f({ q: "video1" }));
    expect(pathsToHits(out)).toEqual([]);
  });
});

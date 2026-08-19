import { describe, expect, it } from "vitest";
import {
  blankForm, buildBundle, bundleDiffs, bundleText, commonPixels, distributePixel, linkOf, missingOf,
  groupReady, membersByStatus, nCabs, nGroups, nObjects, nSocials, newGroup, objectsOfGroup,
  tagForProfile, tailOf, TAG_BY_SOC,
} from "@/lib/groups";
import type { BuildCtx, CabGroup, Snapshot } from "@/lib/types";

/* Проверяется не «функция вернула массив», а то, ради чего лист вообще
   переписан: группа живёт на нескольких соцах, а движок резолвит кабинеты
   ВНУТРИ профиля. Если бандл перестанет резаться по соцу, залив упадёт на
   чужих кабах с «Кабинеты не найдены» — и упадёт молча, уже после создания
   части объектов. */

const ctx: BuildCtx = {
  tags: { hiu: { prefix: "hiu--" } },
  profiles: [
    { id: "k1aaa", label: "1/8 hiuhiu", team: "keine" },
    { id: "k1bbb", label: "6/8 spx", team: "" },
  ],
  catalogAll: {
    k1aaa: [{ id: "act_1", name: "Каб один" }],
    k1bbb: [{ id: "act_2", name: "Каб два" }],
  },
  lichka: {},
  snapshot: null,
};

function group(over: Partial<CabGroup> = {}): CabGroup {
  const g = newGroup("g1", "EG свежие", [
    { profile: "k1aaa", act: "act_1" },
    { profile: "k1bbb", act: "act_2" },
  ]);
  return { ...g, ...over, form: { ...g.form, ...(over.form || {}) } };
}

describe("buildBundle", () => {
  it("режет группу по соцам: одна запись на каждый профиль", () => {
    const items = buildBundle([group()], ctx);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.profile)).toEqual(["k1aaa", "k1bbb"]);
  });

  it("в спеку каждого соца кладёт ТОЛЬКО его кабинеты", () => {
    const [first, second] = buildBundle([group()], ctx);
    expect(first.spec.profiles).toEqual(["k1aaa"]);
    expect(first.spec.accounts).toEqual(["act_1"]);
    expect(second.spec.profiles).toEqual(["k1bbb"]);
    expect(second.spec.accounts).toEqual(["act_2"]);
  });

  it("группы без кабинетов не попадают в залив вовсе", () => {
    const empty = { ...newGroup("g2", "Пустая"), members: [] };
    expect(buildBundle([empty], ctx)).toHaveLength(0);
  });

  it("у каждой группы своя связка: бюджет одной не протекает в другую", () => {
    const a = { ...group(), id: "a", name: "A", form: { ...blankForm(), daily: 45 } };
    const b = { ...group(), id: "b", name: "B", form: { ...blankForm(), daily: 20 } };
    const items = buildBundle([a, b], ctx);
    const daily = items.map((i) => i.spec.budget.daily_usd);
    expect(daily).toEqual([45, 45, 20, 20]);
  });
});

describe("пиксель по кабинету", () => {
  it("кабы с разным пикселем разъезжаются по разным спекам", () => {
    const g = group();
    g.members = [
      { profile: "k1aaa", act: "act_1", pixel: "111" },
      { profile: "k1aaa", act: "act_9", pixel: "222" },
    ];
    const items = buildBundle([g], ctx);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.pixel)).toEqual(["111", "222"]);
    expect(items.map((i) => i.accounts)).toEqual([["act_1"], ["act_9"]]);
  });

  it("кабы с одинаковым пикселем едут одной спекой — лишних не плодим", () => {
    const g = group();
    g.members = [
      { profile: "k1aaa", act: "act_1", pixel: "111" },
      { profile: "k1aaa", act: "act_9", pixel: "111" },
    ];
    const items = buildBundle([g], ctx);
    expect(items).toHaveLength(1);
    expect(items[0].accounts).toEqual(["act_1", "act_9"]);
  });

  it("без своего пикселя каб едет на auto", () => {
    const g = group();
    g.members = [{ profile: "k1aaa", act: "act_1" }];
    const [item] = buildBundle([g], ctx);
    expect(item.pixel).toBe("auto");
    expect(item.spec.conversion.pixel).toBe("auto");
  });

  /* Поле формы больше не участвует: пиксель задаётся ровно в одном месте — на
     кабинете. Иначе связка молча уезжала бы с пикселем, которого на экране
     группы уже нет. */
  it("пиксель в форме группы ни на что не влияет", () => {
    const g = group();
    g.form = { ...g.form, pixel: "999" };
    g.members = [{ profile: "k1aaa", act: "act_1" }];
    const [item] = buildBundle([g], ctx);
    expect(item.spec.conversion.pixel).toBe("auto");
  });

  it("distributePixel переносит пиксель формы на кабинеты без своего", () => {
    const g = distributePixel({
      ...group(),
      form: { ...blankForm(), pixel: "999" },
      members: [
        { profile: "k1aaa", act: "act_1" },
        { profile: "k1aaa", act: "act_9", pixel: "111" },
      ],
    });
    expect(g.members.map((m) => m.pixel)).toEqual(["999", "111"]);
    expect(g.form.pixel).toBe("auto");
    expect(buildBundle([g], ctx).map((i) => i.pixel)).toEqual(["999", "111"]);
  });

  it("distributePixel не трогает группу, у которой пиксель формы auto", () => {
    const g = group();
    expect(distributePixel(g)).toBe(g);
  });

  it("всей группе предлагаются только пиксели, которые есть у КАЖДОГО каба", () => {
    const snapshot = {
      profiles: {
        k1aaa: {
          accounts: [
            { id: "act_1", name: "один", pixels: [{ id: "111" }, { id: "777" }] },
            { id: "act_2", name: "два", pixels: [{ id: "777" }, { id: "222" }] },
          ],
        },
      },
    };
    const g = { ...group(), members: [
      { profile: "k1aaa", act: "act_1" },
      { profile: "k1aaa", act: "act_2" },
    ] };
    expect(commonPixels(g, snapshot).map((p) => p.id)).toEqual(["777"]);
  });

  it("каб, чьих пикселей снапшот не знает, обнуляет общий список", () => {
    const snapshot = {
      profiles: { k1aaa: { accounts: [{ id: "act_1", name: "один", pixels: [{ id: "111" }] }] } },
    };
    const g = { ...group(), members: [
      { profile: "k1aaa", act: "act_1" },
      { profile: "k1aaa", act: "act_x" },
    ] };
    expect(commonPixels(g, snapshot)).toEqual([]);
  });
});

/* Ссылка и хвост едут вместе с пикселем: каб чужого агентства ведёт на свой
   лендинг и метит свои метки. В спеке они по одному значению на всех, значит
   разный выбор обязан разъехаться по спекам — ровно как пиксель. */
describe("ссылка и хвост по кабинету", () => {
  it("своя ссылка режет связку, даже если пиксель один", () => {
    const g = group();
    g.form = { ...g.form, link: "https://common.com" };
    g.members = [
      { profile: "k1aaa", act: "act_1" },
      { profile: "k1aaa", act: "act_9", link: "https://other.com" },
    ];
    const items = buildBundle([g], ctx);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.spec.link)).toEqual(["https://common.com", "https://other.com"]);
  });

  it("свой хвост режет связку и доезжает до каждого крео", () => {
    const g = group();
    g.form = { ...g.form, creoUrl: "utm=one", videoLines: "vid1\nvid2" };
    g.members = [
      { profile: "k1aaa", act: "act_1" },
      { profile: "k1aaa", act: "act_9", tail: "utm=two" },
    ];
    const items = buildBundle([g], ctx);
    expect(items).toHaveLength(2);
    expect(items[1].spec.creatives.map((c: { url_params: string }) => c.url_params)).toEqual([
      "utm=two", "utm=two",
    ]);
  });

  it("кабы с одинаковыми переопределениями едут одной спекой", () => {
    const g = group();
    g.members = [
      { profile: "k1aaa", act: "act_1", pixel: "111", link: "https://a.com", tail: "utm=1" },
      { profile: "k1aaa", act: "act_9", pixel: "111", link: "https://a.com", tail: "utm=1" },
    ];
    expect(buildBundle([g], ctx)).toHaveLength(1);
  });

  it("подпись «чем отличается» появляется только там, где связок несколько", () => {
    const one = group();
    one.members = [{ profile: "k1aaa", act: "act_1" }];
    expect(bundleDiffs(buildBundle([one], ctx))).toEqual([""]);

    const two = group();
    two.form = { ...two.form, link: "https://a.com" };
    two.members = [
      { profile: "k1aaa", act: "act_1" },
      { profile: "k1aaa", act: "act_9", link: "https://b.com" },
    ];
    expect(bundleDiffs(buildBundle([two], ctx))).toEqual(["https://a.com", "https://b.com"]);
  });

  it("пустое переопределение наследует значение связки", () => {
    const g = group();
    g.form = { ...g.form, link: "https://common.com", creoUrl: "utm=one" };
    g.members = [{ profile: "k1aaa", act: "act_1" }];
    expect(linkOf(g, g.members[0])).toBe("https://common.com");
    expect(tailOf(g, g.members[0])).toBe("utm=one");
  });
});

describe("тег агентства по соцу", () => {
  const tagged: BuildCtx = { ...ctx, tags: { hiu: { prefix: "hiu--" }, spx: { prefix: "spx--" } } };

  it("тег угадывается по имени соца", () => {
    expect(tagForProfile("k1aaa", tagged)).toBe("hiu");
    expect(tagForProfile("k1bbb", tagged)).toBe("spx");
  });

  it("явная привязка сильнее угадывания", () => {
    expect(tagForProfile("k1aaa", { ...tagged, bind: { k1aaa: "spx" } })).toBe("spx");
  });

  it("привязка на несуществующий тег не в счёт — угадываем дальше", () => {
    expect(tagForProfile("k1aaa", { ...tagged, bind: { k1aaa: "нет-такого" } })).toBe("hiu");
  });

  it("соц без совпадения остаётся без тега — агентство не выдумываем", () => {
    const other: BuildCtx = { ...tagged, profiles: [{ id: "k1ccc", label: "25/7 stock", team: "" }] };
    expect(tagForProfile("k1ccc", other)).toBe("");
  });

  /* Ради этого всё и затевалось: одна группа на двух соцах разных агентств
     получает РАЗНЫЕ префиксы в именах — по ним потом сходится статистика. */
  it("одна группа на двух соцах получает разные префиксы", () => {
    const g = group();
    g.form = { ...g.form, tag: TAG_BY_SOC, nmCamp: "camp", nmAdset: "ads", nmAd: "ad" };
    const items = buildBundle([g], tagged);
    expect(items.map((i) => i.spec.naming.campaign)).toEqual(["hiu--camp", "spx--camp"]);
    /* Имя крео дописано обоим: buildSpec гарантирует хвост [CREO_NAME] чем бы
       ни был шаблон в форме (см. build-spec.ts). Префикс агентства при этом
       остаётся своим у каждого соца — ради чего тест и написан. */
    expect(items.map((i) => i.spec.naming.ad))
      .toEqual(["hiu--ad--[CREO_NAME]", "spx--ad--[CREO_NAME]"]);
  });

  it("выбранный руками тег одинаков на всех соцах", () => {
    const g = group();
    g.form = { ...g.form, tag: "spx", nmCamp: "camp" };
    const items = buildBundle([g], tagged);
    expect(items.map((i) => i.spec.naming.campaign)).toEqual(["spx--camp", "spx--camp"]);
  });
});

describe("bundleText", () => {
  it("собирает ОДИН промпт со всеми связками", () => {
    const t = bundleText([group()], ctx);
    expect(t).toContain("СВЯЗКА 1/2");
    expect(t).toContain("СВЯЗКА 2/2");
    expect(t).toContain('"bundles"');
  });

  /* Протокол вызовов проверяется по именам тулов, а не по формулировкам: без
     `confirmed_by_user=true` движок отказывается заливать вовсе, а без запрета
     чинить спеку модель разрешает противоречие «не пересобирай / план упал» в
     свою пользу — правит спеку и льёт не то. */
  it("промпт называет все три шага движка и запрещает чинить спеку", () => {
    const t = bundleText([group()], ctx);
    expect(t).toContain("plan_upload");
    expect(t).toContain("execute_upload");
    expect(t).toContain("confirmed_by_user=true");
    expect(t).toContain("job_status");
    expect(t).toContain("НЕ ПЕРЕСОБИРАЙ");
    expect(t).toContain("ОСТАНОВИСЬ");
  });

  it("про фоновую заливку медиа говорит только там, где крео — файлы", () => {
    const cab = group();
    expect(bundleText([cab], ctx)).not.toContain("upload_media");
    const file = group({ form: { ...blankForm(), creoSrc: "file", videoLines: "creo_1.mp4" } });
    expect(bundleText([file], ctx)).toContain("upload_media");
  });

  it("не печатает пустую команду профиля", () => {
    const t = bundleText([group()], ctx);
    expect(t).toContain("команда keine");
    expect(t).not.toContain("команда )");
  });

  it("пустой залив даёт пустой текст, а не заготовку промпта", () => {
    expect(bundleText([], ctx)).toBe("");
  });
});

describe("missingOf", () => {
  it("называет ровно то, без чего движок откажет", () => {
    const g = group({ form: { ...blankForm(), videoLines: "", geo: "", daily: 0, link: "" } });
    expect(missingOf(g, null)).toEqual(["creatives", "geo", "budget", "link"]);
  });

  it("заполненная связка не считается дырявой", () => {
    const g = group({
      form: { ...blankForm(), videoLines: "creo_1", geo: "EG", daily: 45, link: "https://x.co" },
    });
    expect(missingOf(g, null)).toEqual([]);
  });
});

describe("objectsOfGroup", () => {
  it("считает объекты на все кабинеты группы, а не на один", () => {
    // 1 кампания + 4 адсета + 4 объявления = 9 на каб, кабинетов два
    const g = group({ form: { ...blankForm(), nCamp: 1, nAdset: 4, nAd: 1 } });
    expect(objectsOfGroup(g)).toBe(18);
  });
});

describe("счётные подписи", () => {
  /* Интерфейс переведён на английский, и склонение здесь теперь английское:
     единственное число ровно при единице, во всех остальных случаях
     множественное — включая 21 и 0. Русские правила («21 объект», «3 объекта»)
     тут больше не действуют и проверять их нечего. */
  it("единственное число только при единице", () => {
    expect(nObjects(1)).toBe("1 object");
    expect(nObjects(3)).toBe("3 objects");
    expect(nObjects(21)).toBe("21 objects");
    expect(nObjects(0)).toBe("0 objects");
    expect(nCabs(1)).toBe("1 ad account");
    expect(nCabs(4)).toBe("4 ad accounts");
    expect(nGroups(2)).toBe("2 groups");
    expect(nSocials(1)).toBe("1 profile");
    expect(nSocials(5)).toBe("5 profiles");
  });
});


/* Мёртвый кабинет не уезжает в спеку — и это проверяется на `buildBundle`, а не
   на надписи.
 *
 *  Зачем именно так. Предыдущая версия этой защиты добавляла причину в
 *  `missingOf` и красную подпись в превью — и была принята за рабочую, потому
 *  что тест проверял ТЕКСТ. А `buildBundle` про `missingOf` не спрашивает
 *  вовсе, и спека с забаненным кабом уезжала в Мету; ловил её только
 *  канареечный каб уже после старта джобы. Поэтому главный тест здесь смотрит
 *  на `spec.accounts`, а не на список причин.
 *
 *  Владелец 13.08.2026: «разбана кабинета никогда не бывает, блокируем». */
describe("мёртвый кабинет не попадает в спеку", () => {
  const целая = { ...blankForm(), videoLines: "creo_1", geo: "EG", daily: 45, link: "https://x.co" };

  const снап = (статусы: Record<string, string>): Snapshot => ({
    generated_at: "2026-08-14T09:00:00+02:00",
    profiles: {
      k1aaa: { accounts: Object.entries(статусы).map(([id, status]) => ({ id, name: id, status })) },
      k1bbb: { accounts: [] },
    },
  });

  const сCнапом = (s: Snapshot): BuildCtx => ({ ...ctx, snapshot: s });

  it("ГЛАВНОЕ: забаненного каба нет в spec.accounts", () => {
    const g = { ...group(), form: целая };
    const s = снап({ act_1: "DISABLED", act_2: "ACTIVE" });
    const все = buildBundle([g], сCнапом(s)).flatMap((i) => i.spec.accounts as string[]);
    expect(все).not.toContain("act_1");
    expect(все).toContain("act_2");
  });

  it("PENDING_CLOSURE блокирует наравне с DISABLED", () => {
    const g = { ...group(), form: целая };
    const s = снап({ act_1: "PENDING_CLOSURE", act_2: "ACTIVE" });
    expect(buildBundle([g], сCнапом(s)).flatMap((i) => i.spec.accounts as string[])).not.toContain("act_1");
    expect(missingOf(g, s).some((x) => x.includes("act_1"))).toBe(true);
  });

  it("группа, где мёртвы ВСЕ кабы, не даёт ни одной связки", () => {
    const g = { ...group(), form: целая };
    const s = снап({ act_1: "DISABLED", act_2: "DISABLED" });
    expect(buildBundle([g], сCнапом(s))).toHaveLength(0);
    expect(groupReady(g, s)).toBe(false);
  });

  it("UNSETTLED не блокирует: неоплаченный счёт лечится оплатой, а не баном", () => {
    const g = { ...group(), form: целая };
    const s = снап({ act_1: "UNSETTLED", act_2: "ACTIVE" });
    expect(missingOf(g, s)).toEqual([]);
    expect(buildBundle([g], сCнапом(s)).flatMap((i) => i.spec.accounts as string[])).toContain("act_1");
  });

  it("каб на проверке Меты не блокирует, но виден отдельной корзиной", () => {
    const s = снап({ act_1: "PENDING_RISK_REVIEW", act_2: "ACTIVE" });
    const g = { ...group(), form: целая };
    expect(missingOf(g, s)).toEqual([]);
    expect(membersByStatus(g, s).review).toEqual(["act_1"]);
  });

  it("каба нет в снапшоте — не мёртв, но и не молча: корзина missing", () => {
    // Неизвестность и бан — разные вещи. Блокировать из-за протухшего снапшота
    // значит останавливать работу там, где ничего не сломано.
    const s = снап({ act_2: "ACTIVE" });
    const g = { ...group(), form: целая };
    expect(missingOf(g, s)).toEqual([]);
    expect(membersByStatus(g, s).missing).toEqual(["act_1"]);
  });

  it("без снапшота ничего не выдумываем: все четыре корзины пусты, залив не держим", () => {
    const g = { ...group(), form: целая };
    expect(membersByStatus(g, null)).toEqual({ dead: [], review: [], unclear: [], missing: [] });
    expect(missingOf(g, null)).toEqual([]);
  });
});

/* Статус-литерал "UNKNOWN" — то, что scripts/make_ui_snapshot.py:106 пишет в
 * снапшот для ЛЮБОГО кода статуса, которого нет в справочнике движка. Прошлая
 * версия membersByStatus проверяла только isDeadStatus/isReviewStatus без
 * финального else, и такой каб не совпадал ни с одной веткой — проходил мимо
 * ВСЕХ корзин молча, как обычный активный. Это и вернуло PR на переделку. */
describe("статус UNKNOWN и другие нераспознанные — корзина unclear, а не тишина", () => {
  const целая = { ...blankForm(), videoLines: "creo_1", geo: "EG", daily: 45, link: "https://x.co" };

  it("ГЛАВНОЕ: буквальный литерал \"UNKNOWN\" от Меты попадает в unclear", () => {
    const g = newGroup("gU", "с непонятным статусом", [{ profile: "k1aaa", act: "act_1" }]);
    const s: Snapshot = {
      generated_at: "2026-08-14T09:00:00+02:00",
      profiles: { k1aaa: { accounts: [{ id: "act_1", name: "act_1", status: "UNKNOWN" }] } },
    };
    expect(membersByStatus(g, s).unclear).toEqual(["act_1"]);
  });

  it("любой другой нераспознанный код статуса — туда же, а не только буквальный UNKNOWN", () => {
    const g = newGroup("gU2", "новый статус Меты", [{ profile: "k1aaa", act: "act_1" }]);
    const s: Snapshot = {
      generated_at: "x",
      profiles: { k1aaa: { accounts: [{ id: "act_1", name: "act_1", status: "SOME_NEW_META_STATUS" }] } },
    };
    expect(membersByStatus(g, s).unclear).toEqual(["act_1"]);
  });

  it("missing (нет в снапшоте) и unclear (есть, статус не опознан) — разные корзины", () => {
    const g = newGroup("gMU", "missing vs unclear", [
      { profile: "k1aaa", act: "act_ghost" }, // отсутствует в снапшоте вовсе
      { profile: "k1aaa", act: "act_weird" }, // есть, но статус незнакомый
    ]);
    const s: Snapshot = {
      generated_at: "x",
      profiles: { k1aaa: { accounts: [{ id: "act_weird", name: "w", status: "UNKNOWN" }] } },
    };
    const st = membersByStatus(g, s);
    expect(st.missing).toEqual(["act_ghost"]);
    expect(st.unclear).toEqual(["act_weird"]);
  });

  it("unclear не блокирует: missingOf пуст, каб остаётся в spec.accounts", () => {
    const g = { ...group(), form: целая };
    const s: Snapshot = {
      generated_at: "x",
      profiles: {
        k1aaa: { accounts: [{ id: "act_1", name: "a", status: "UNKNOWN" }] },
        k1bbb: { accounts: [{ id: "act_2", name: "b", status: "ACTIVE" }] },
      },
    };
    expect(missingOf(g, s)).toEqual([]);
    const accounts = buildBundle([g], { ...ctx, snapshot: s }).flatMap((i) => i.spec.accounts as string[]);
    expect(accounts).toContain("act_1");
  });

  it("billing (неоплаченный счёт) тоже не попадает ни в одну корзину здесь — у него свой отдельный лист", () => {
    // Решение, не продиктованное явно задачей: billing не блокирует и не
    // заводит пятую корзину в membersByStatus — как active, он просто не
    // попадает никуда. Список кабов с проблемой оплаты уже есть отдельным
    // листом панели, дублировать его тут значит завести вторую копию.
    const g = newGroup("gB", "billing", [{ profile: "k1aaa", act: "act_1" }]);
    const s: Snapshot = {
      generated_at: "x",
      profiles: { k1aaa: { accounts: [{ id: "act_1", name: "a", status: "UNSETTLED" }] } },
    };
    expect(membersByStatus(g, s)).toEqual({ dead: [], review: [], unclear: [], missing: [] });
  });

  it("каждый каб попадает ровно в одну корзину; сумма корзин плюс активные = все члены группы", () => {
    const members = [
      { profile: "k1aaa", act: "act_active" },
      { profile: "k1aaa", act: "act_dead" },
      { profile: "k1aaa", act: "act_review" },
      { profile: "k1aaa", act: "act_unclear" },
      { profile: "k1aaa", act: "act_missing" },
    ];
    const g = newGroup("gAll", "все статусы разом", members);
    const s: Snapshot = {
      generated_at: "x",
      profiles: {
        k1aaa: {
          accounts: [
            { id: "act_active", name: "a", status: "ACTIVE" },
            { id: "act_dead", name: "d", status: "DISABLED" },
            { id: "act_review", name: "r", status: "PENDING_RISK_REVIEW" },
            { id: "act_unclear", name: "u", status: "UNKNOWN" },
            // act_missing нарочно отсутствует в снапшоте.
          ],
        },
      },
    };
    const st = membersByStatus(g, s);
    const bucketed = [...st.dead, ...st.review, ...st.unclear, ...st.missing];
    // Ни одного дубля между корзинами — то есть ровно одна корзина на каб.
    expect(new Set(bucketed).size).toBe(bucketed.length);
    expect(st.dead).toEqual(["act_dead"]);
    expect(st.review).toEqual(["act_review"]);
    expect(st.unclear).toEqual(["act_unclear"]);
    expect(st.missing).toEqual(["act_missing"]);
    // «Активные» — всё, что не попало ни в одну корзину. Их сумма с корзинами
    // обязана дать весь состав группы: если бы UNKNOWN снова провалился мимо
    // всех веток, bucketed.length оказался бы на 1 меньше, а active — на 1 больше.
    const active = members.filter((m) => !bucketed.includes(m.act));
    expect(active.map((m) => m.act)).toEqual(["act_active"]);
    expect(bucketed.length + active.length).toBe(members.length);
  });
});

/* objectsOfGroup(g) — чистая арифметика формы, снапшота не знает и знать не
 * обязана. Но bundleText складывает её с уже ОТФИЛЬТРОВАННЫМ списком (buildBundle
 * выбрасывает мёртвые кабы) — и если сложение идёт по g.members.length, а не по
 * items, шапка промпта обещает объекты на кабы, которых в спеке уже нет. */
describe("bundleText: счётчик объектов в шапке — по тому, что реально уедет", () => {
  it("мёртвый каб выброшен из спеки — из счётчика объектов тоже, не только из числа кабинетов", () => {
    const g = {
      ...group(),
      form: {
        ...blankForm(), videoLines: "creo_1", geo: "EG", daily: 45, link: "https://x.co",
        nCamp: 1, nAdset: 1, nAd: 1,
      },
    };
    // group() кладёт act_1 на k1aaa и act_2 на k1bbb; хороним только act_1.
    const s: Snapshot = {
      generated_at: "2026-08-14T09:00:00+02:00",
      profiles: {
        k1aaa: { accounts: [{ id: "act_1", name: "act_1", status: "DISABLED" }] },
        k1bbb: { accounts: [{ id: "act_2", name: "act_2", status: "ACTIVE" }] },
      },
    };
    const t = bundleText([g], { ...ctx, snapshot: s });
    // Выжил один каб (act_2): 1×(1 кампания + 1 адсет + 1×1 объявление) = 3.
    // Счётчик по g.members.length (двум кабам) обещал бы 6 — вдвое больше
    // того, что движок реально создаст.
    expect(t.match(/(\d+) кабинет/)?.[1]).toBe("1");
    expect(t.match(/(\d+) объект/)?.[1]).toBe("3");
  });

  it("две группы с ОДИНАКОВЫМ именем не схлопывают счётчик в одну запись", () => {
    // Свободный ввод имени без проверки уникальности — частый случай, две
    // группы под одно гео разными срезами крео. survivedByGroup раньше
    // ключевался именем (g.name), и обе группы писали в один и тот же ключ
    // Map: вторая запись перетирала не сумму, а весь подсчёт для обеих.
    const form = { ...blankForm(), videoLines: "creo_1", geo: "EG", daily: 45, link: "https://x.co",
      nCamp: 1, nAdset: 1, nAd: 1 };
    const a = { ...newGroup("gSameA", "Same", [{ profile: "k1aaa", act: "act_1" }]), form };
    const b = { ...newGroup("gSameB", "Same", [{ profile: "k1bbb", act: "act_2" }]), form };
    const t = bundleText([a, b], ctx);
    // Каждая группа: 1 живой каб × (1 кампания + 1 адсет + 1 объявление) = 3.
    // Итого 2 каба, 6 объектов — не 12 (задвоенный подсчёт одной из групп) и
    // не 3 (потерянный подсчёт другой).
    expect(t.match(/(\d+) кабинет/)?.[1]).toBe("2");
    expect(t.match(/(\d+) объект/)?.[1]).toBe("6");
  });

  it("тёзка по имени не даёт связке чужую форму (таргетинг/бюджет/структуру)", () => {
    // groups.find(x => x.name === it.group) резолвился бы в ПЕРВУЮ группу с
    // этим именем всегда — вторая связка описалась бы формой первой группы.
    const formA = { ...blankForm(), videoLines: "creo_1", geo: "EG", daily: 10, link: "https://a.co",
      nCamp: 1, nAdset: 1, nAd: 1 };
    const formB = { ...blankForm(), videoLines: "creo_1", geo: "DZ", daily: 99, link: "https://b.co",
      nCamp: 1, nAdset: 1, nAd: 1 };
    const a = { ...newGroup("gTwinA", "Twin", [{ profile: "k1aaa", act: "act_1" }]), form: formA };
    const b = { ...newGroup("gTwinB", "Twin", [{ profile: "k1bbb", act: "act_2" }]), form: formB };
    const t = bundleText([a, b], ctx);
    expect(t).toContain("EG");
    expect(t).toContain("DZ");
    expect(t).toContain("$10");
    expect(t).toContain("$99");
  });
});

describe("превью: пустое состояние различает «нет кабов» и «все забанены»", () => {
  it("группа без кабов вообще — это не то же самое, что группа с одними банами", () => {
    // Регресс, который проверка снаружи (превью) уже не отличала: buildBundle
    // отдаёт пустой items в обоих случаях, а текст на экране говорил только
    // "No group has any ad accounts" — неправда, когда кабы есть и забанены.
    const empty = { ...newGroup("gEmpty", "Пустая"), members: [] };
    expect(buildBundle([empty], ctx)).toHaveLength(0);

    const allDead = newGroup("gDead", "Все забанены", [{ profile: "k1aaa", act: "act_1" }]);
    const s: Snapshot = {
      generated_at: "2026-08-14T09:00:00+02:00",
      profiles: { k1aaa: { accounts: [{ id: "act_1", name: "act_1", status: "DISABLED" }] } },
    };
    expect(buildBundle([allDead], { ...ctx, snapshot: s })).toHaveLength(0);
    // Оба случая дают пустой items — компонент обязан различать их не по
    // buildBundle, а по составу групп (groups.some(g => g.members.length)),
    // это и проверяется в PreviewView напрямую, здесь фиксируем сам факт,
    // что buildBundle оба случая честно схлопывает в "нечего слать".
  });
});

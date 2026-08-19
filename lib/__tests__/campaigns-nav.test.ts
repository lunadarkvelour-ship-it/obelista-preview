/* Навигация листа кампаний: соц → кабинет → дерево.
 *
 * ПОЧЕМУ ЭТО ПРОВЕРЯЕТСЯ. Верхние два уровня — наши, их в Ads Manager нет, и
 * ошибиться в них можно молча: показать соца, которым нельзя управлять; потерять
 * общий кабинет, потому что он «не у этого соца»; сложить ответы нескольких
 * кабинетов так, что одна и та же кампания встанет двумя ветками; подписать
 * пачку строк возрастом самой свежей из них.
 *
 * Всё это выглядит как работающий лист. Разница видна только на данных, и вот
 * они.
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  МАКС_КАБОВ, активные, загрузитьМного, кабинетыСоца, ограничить, переключитьКаб,
  свести, соцыДляЛиста, type ЗагрузкаКаба,
} from "@/lib/campaigns-nav";
import { NoHandle, type CampaignRow, type CampaignsResponse } from "@/lib/campaigns";
import type { UnifiedAccount } from "@/lib/cloud-accounts";
import type { AccountOwner } from "@/lib/account-rows";
import {
  AccountLevel, CampRow, CampaignsView, SocialLevel,
} from "@/components/views/CampaignsView";
import { buildTree, flatten, картаБюджетов } from "@/lib/campaigns-tree";
import { CAMP_DEFAULT_VISIBLE, колонки } from "@/lib/campaigns-columns";

const соц = (p: Partial<AccountOwner> & { profile: string }): AccountOwner => ({
  label: "", present: true, fresh: true, oauth: false, ...p,
});

const каб = (p: Partial<UnifiedAccount> & { act_id: string }): UnifiedAccount => ({
  name: null, bm_name: null, status: null, status_checked_at: null,
  funding_type: null, funding_display_string: null,
  owners: [], profile: null, profileLabel: "", pixels: [], personal: false,
  inSnapshot: false, inCloud: true, ...p,
});

/* Два ТЕКУЩИХ профиля (токен и открытое окно), один с токеном без окна и один
   выбывший — форма живого парка владельца после переезда между вендорами
   антидетекта. */
const МОНИК = соц({ profile: "00076f0a", label: "Monique Mujinga", oauth: true });
const ЭНДАХ = соц({ profile: "a896ef95", label: "Endah Sukamto", oauth: true });
const ДАЗТ = соц({ profile: "2fcc2d23", label: "Dahzztt Febrianti", oauth: true, present: false });
const ВЫБЫВШИЙ = соц({ profile: "k1fhk1yb", present: false });

/* Ничего не спрятано: у этого набора вне листа нет ни одного кабинета. Там, где
   есть, число обязано быть на экране — см. проверку ниже. */
const ПУСТОЕ_ВНЕ = { токенБезОкна: 0, неизвестные: 0, отключённые: 0 };

const парк: UnifiedAccount[] = [
  каб({ act_id: "act_1", name: "MeDuA6aeP 17/7-8", status: "ACTIVE",
        profile: "00076f0a", owners: [МОНИК] }),
  /* Общий каб: виден с двух соцев сразу. Он обязан находиться с каждого. */
  каб({ act_id: "act_2", name: "Ko Swe", status: "DISABLED",
        profile: "00076f0a", owners: [МОНИК, ЭНДАХ] }),
  каб({ act_id: "act_3", name: "Hiuhiu_MediaBuyer3_8.8_6",
        profile: "a896ef95", owners: [ЭНДАХ] }),
  /* Токен есть, окна нет: управлять нечем — браузер открыть негде. */
  каб({ act_id: "act_8", name: "перелив 12.8", status: "ACTIVE", owners: [ДАЗТ] }),
  /* Кабинет выбывшего профиля: управлять им нечем, и на этом листе его нет. */
  каб({ act_id: "act_9", name: "старый перелив", owners: [ВЫБЫВШИЙ] }),
];

describe("первый уровень — соцы, и только те, которыми можно управлять", () => {
  const соцы = соцыДляЛиста(парк);
  const по = (p: string) => соцы.find((s) => s.profile === p)!;

  it("в лист идут только ТЕКУЩИЕ профили: токен И открытое окно", () => {
    /* Пауза и включение уходят в Мету токеном соца, а браузер открывается в
       окне антидетекта. У профиля с токеном, но без окна, нет второй половины,
       и показать его первым уровнем значит предложить работу, которой нет.

       Здесь же лежит промах, который владелец увидел на проде: `oauth` у соца
       базы считается через ЧЕЛОВЕКА, и прежние профили того же человека тоже
       приезжают «подключёнными». Правило одно на продукт и лежит в
       `cloud-filter.правилоСоца`. */
    expect(соцы.map((s) => s.profile).sort()).toEqual(["00076f0a", "a896ef95"]);
  });

  it("порядок — где больше кабинетов; при равенстве по имени, а не как легло", () => {
    /* Порядок, зависящий от того, как база сложила выборку, меняется сам от
       перезагрузки к перезагрузке, и человек ищет соца глазами каждый раз
       заново. */
    expect(соцы.map((s) => s.label)).toEqual(["Endah Sukamto", "Monique Mujinga"]);
  });

  it("живые и забаненные посчитаны РАЗНЫМИ числами, как их и спрашивают", () => {
    /* Слова владельца: «мне нужно видеть живые кабы и забаненные». Бан — это
       его деньги, и одной цифрой «не активных» он не отвечается. */
    expect(по("00076f0a")).toMatchObject({ кабов: 2, активных: 1, забаненных: 1 });
    expect(по("a896ef95")).toMatchObject({ кабов: 2, активных: 0, забаненных: 1 });
  });

  it("«не собрано» считается отдельно и от живых, и от банов", () => {
    /* Ноль вместо неизвестного — та же ложь, что ноль вместо несобранного
       спенда (#122). */
    expect(по("a896ef95")).toMatchObject({ неснятых: 1 });
    expect(по("00076f0a")).toMatchObject({ неснятых: 0 });
  });
});

describe("второй уровень — кабинеты соца", () => {
  it("общий кабинет находится с КАЖДОГО своего соца", () => {
    expect(кабинетыСоца(парк, "00076f0a").map((a) => a.act_id)).toEqual(["act_2", "act_1"]);
    expect(кабинетыСоца(парк, "a896ef95").map((a) => a.act_id)).toEqual(["act_3", "act_2"]);
  });

  it("«все подключённые» — это все, но НЕ кабинеты профилей без окна и выбывших", () => {
    expect(кабинетыСоца(парк, null).map((a) => a.act_id))
      .toEqual(["act_3", "act_2", "act_1"]);
  });

  it("отметка ставится и снимается, порядок отметок сохраняется", () => {
    /* Порядок отметок — он же порядок запросов и порядок появления деревьев. */
    let выбор = переключитьКаб([], "act_2");
    выбор = переключитьКаб(выбор, "act_1");
    expect(выбор).toEqual(["act_2", "act_1"]);
    expect(переключитьКаб(выбор, "act_2")).toEqual(["act_1"]);
  });

  it("предел открытия ЗАЯВЛЕН, а не применён молча", () => {
    const много = Array.from({ length: МАКС_КАБОВ + 7 }, (_, i) => `act_${i}`);
    const { взяли, отброшено } = ограничить(много);
    expect(взяли).toHaveLength(МАКС_КАБОВ);
    expect(отброшено).toBe(7);
    /* Молчаливое усечение читается как «вот всё, что есть». Число отброшенных
       возвращается затем, чтобы попасть на экран. */
    expect(ограничить(["act_1"]).отброшено).toBe(0);
  });
});

describe("«всё активное» — это ACTIVE, и ничего кроме", () => {
  it("забаненные и неопрошенные в набор не попадают", () => {
    /* Цифры владельца: из 72 кабинетов профиля активных ШЕСТЬ, забаненных 63.
       «Открыть все» на таком наборе даёт дерево, где девять веток из десяти
       мертвы, — кнопка есть, а пользоваться ею нельзя. */
    /* Считается по СТАТУСУ и только по нему: кого показывать, решено уровнем
       выше (`кабинетыСоца`), и второе правило внутри этой функции разошлось бы
       с первым. Поэтому проверяем на уже отобранном наборе — так её и зовёт
       вьюха. */
    expect(активные(кабинетыСоца(парк, null)).map((a) => a.act_id)).toEqual(["act_1"]);
    /* А на сыром парке в неё попадает и активный каб профиля без окна: это не
       ошибка, это ответ на другой вопрос. */
    expect(активные(парк).map((a) => a.act_id)).toEqual(["act_1", "act_8"]);
  });

  it("«не собрано» активным НЕ считается", () => {
    /* Неизвестное — не утверждение. Записать его в активные значит открыть
       человеку то, про что мы ничего не знаем, под видом работающего. */
    const неснятые = [каб({ act_id: "act_x", owners: [МОНИК] })];
    expect(активные(неснятые)).toEqual([]);
  });

  it("считается общим словарём статусов, а не своим списком", () => {
    /* PENDING_CLOSURE — не активный, хотя и не DISABLED. Свой список из одного
       значения здесь однажды уже заводили в другом месте продукта. */
    const пёстрые = [
      каб({ act_id: "a", status: "ACTIVE", owners: [МОНИК] }),
      каб({ act_id: "b", status: "PENDING_CLOSURE", owners: [МОНИК] }),
      каб({ act_id: "c", status: "UNSETTLED", owners: [МОНИК] }),
    ];
    expect(активные(пёстрые).map((a) => a.act_id)).toEqual(["a"]);
  });
});

describe("несколько кабинетов сразу: спрашиваем и сводим", () => {
  const ответ = (act_id: string, n: number, at: string): CampaignsResponse => ({
    ok: true, generated_at: at,
    rows: Array.from({ length: n }, (_, i) => ({
      fb_id: `${act_id}-${i}`, level: "campaign", parent_id: null, act_id,
      name: `camp ${i}`, status: "ACTIVE", checked_at: at, owner: "00076f0a",
    })) as CampaignRow[],
  });

  it("порядок ответов — порядок запроса, а не порядок прихода", async () => {
    /* Иначе дерево перестраивается под человеком, пока грузится. */
    const из = await загрузитьМного(
      ["act_3", "act_1", "act_2"],
      async (id) => {
        await new Promise((r) => setTimeout(r, id === "act_3" ? 15 : 1));
        return ответ(id, 1, "2026-08-15T08:00:00Z");
      },
    );
    expect(из.map((о) => о.act_id)).toEqual(["act_3", "act_1", "act_2"]);
  });

  it("«ручки нет» обрывает остальные запросы — это свойство деплоя, а не каба", async () => {
    const звали: string[] = [];
    const из = await загрузитьМного(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      async (id) => {
        звали.push(id);
        throw new NoHandle("/campaigns");
      },
      2,
    );
    /* Первая пачка ушла — по ней и узнали. Остальные шесть запросов не сделаны,
       а кабинеты вернулись честно, с тем же признаком. */
    expect(звали).toEqual(["a", "b"]);
    expect(из).toHaveLength(8);
    expect(из.every((о) => о.noHandle)).toBe(true);
  });

  it("отказ по одному кабинету не роняет остальные", async () => {
    const из = await загрузитьМного(["ok", "bad"], async (id) => {
      if (id === "bad") throw new Error("(#100) Invalid parameter");
      return ответ(id, 2, "2026-08-15T08:00:00Z");
    });
    const св = свести(из);
    expect(св.rows).toHaveLength(2);
    expect(св.ошибки).toEqual([{ act_id: "bad", error: "(#100) Invalid parameter" }]);
    expect(св.сДанными).toBe(1);
  });

  it("одна и та же строка из двух кабинетов не даёт двух веток", async () => {
    /* Общий каб можно выбрать дважды — с двух соцев. Вторая копия дала бы
       вторую ветку дерева с теми же деньгами. */
    const из = await загрузитьМного(["act_1", "act_1"], async (id) =>
      ответ(id, 3, "2026-08-15T08:00:00Z"));
    expect(свести(из).rows).toHaveLength(3);
  });

  it("возраст подписывается по САМОМУ СТАРОМУ ответу", async () => {
    /* Подпись обещает возраст всего показанного. По самому свежему она
       подписала бы трёхдневные строки минутной давностью. */
    const из = await загрузитьМного(["new", "old"], async (id) =>
      ответ(id, 1, id === "old" ? "2026-08-12T00:00:00Z" : "2026-08-15T08:00:00Z"));
    expect(свести(из).собрано).toBe("2026-08-12T00:00:00Z");
  });

  it("пустой ответ — это не ошибка и не «ручки нет»", async () => {
    const из = await загрузитьМного(["empty"], async () => ({ ok: true, rows: [] }));
    const св = свести(из);
    expect(св).toMatchObject({ пустых: 1, сДанными: 0, ручкиНет: false });
    expect(св.ошибки).toEqual([]);
  });
});

describe("строка дерева отвечает на «почему не идёт» словом, а не догадкой", () => {
  const строка = (r: Partial<CampaignRow> & { fb_id: string }) => {
    const row = {
      level: "campaign", parent_id: null, act_id: "act_1", name: "камп",
      status: "ACTIVE", ...r,
    } as CampaignRow;
    const [item] = flatten(buildTree([row]), new Set());
    return renderToStaticMarkup(createElement(CampRow, {
      item, now: Date.parse("2026-08-15T12:00:00Z"), pending: {},
      onToggle: () => {}, onSwitch: () => {},
      колонки: { метрики: колонки(CAMP_DEFAULT_VISIBLE) },
      бюджет: картаБюджетов([row]).get(row.fb_id),
    }));
  };

  it("число живых подписано ДОСТАВКОЙ, а не выключателем", () => {
    /* «active» в этом продукте — положение выключателя, а считается здесь
       доставка. На их расхождении и строится весь ответ «почему не идёт»:
       объявление, включённое внутри выключенного адсета, не доставляется.
       Слово переехало из клетки в ЗАГОЛОВОК и подсказку (у листа появилась
       шапка колонок, #153), но сказано оно по-прежнему про доставку — и
       проверяется здесь же, чтобы «active» не вернулось тихо. */
    const h = строка({ fb_id: "c1", active_ads: 0 });
    expect(h).toMatch(/data-col="delivering"[^>]*>0</);
    expect(h).toMatch(/delivering right now/);
    expect(h).not.toContain("0 active");
  });

  it("«не считали» рисуется прочерком, а не нулём", () => {
    /* Слово «delivering» останется в подсказке — она как раз объясняет, что
       не считали. Проверяем ЯЧЕЙКУ: числа с подписью в ней нет. */
    expect(строка({ fb_id: "c2" })).not.toMatch(/\d+ delivering/);
  });

  it("у объявления бюджета не бывает вовсе, и сказано именно это", () => {
    const h = строка({ fb_id: "a2", level: "ad", parent_id: null });
    expect(h).toMatch(/Ads have no budget of their own/i);
    /* И никакого «не собрано»: это норма, а не пробел. */
    expect(h).not.toMatch(/not collected/i);
  });

  it("бюджет на соседнем уровне — сказано ГДЕ он, а не что его нет", () => {
    /* Самый полезный из четырёх ответов: человек сразу знает, куда идти.
       Строится по всему ответу (`картаБюджетов`), потому что по одной строке
       сосед не виден. */
    const дерево = [
      { fb_id: "c1", level: "campaign", parent_id: null, act_id: "act_1", name: "к",
        status: "ACTIVE", daily_budget: 7000 },
      { fb_id: "s1", level: "adset", parent_id: "c1", act_id: "act_1", name: "а",
        status: "ACTIVE" },
    ] as CampaignRow[];
    const карта = картаБюджетов(дерево);
    const [, адсет] = flatten(buildTree(дерево), new Set(["c1"]));
    const h = renderToStaticMarkup(createElement(CampRow, {
      item: адсет, now: Date.parse("2026-08-15T12:00:00Z"), pending: {},
      onToggle: () => {}, onSwitch: () => {},
      колонки: { метрики: колонки(CAMP_DEFAULT_VISIBLE) },
      бюджет: карта.get("s1"),
    }));
    expect(h).toContain("on campaign");
    expect(h).toMatch(/CBO/);
  });

  it("ноль — это «потолка нет», а не сумма ноль", () => {
    /* «$0.00» читается как «денег не выделено», а ноль у Меты значит обратное:
       ограничения нет. Разные утверждения — разные слова. */
    const h = строка({ fb_id: "c4", daily_budget: 0, currency: "USD" });
    expect(h).toContain("no cap");
    expect(h).not.toContain("$0.00");
  });

  it("расхождение доставки показано СЛОВОМ Меты", () => {
    /* «Не доставляется» человек уже видит фильтром; лечится каждая причина
       по-своему, и точное слово — единственное, по чему он поймёт, куда идти. */
    const h = строка({ fb_id: "a1", level: "ad", status: "ACTIVE",
                       effective_status: "DISAPPROVED" });
    expect(h).toContain("disapproved");
  });
});

describe("уровни рисуются и говорят правду о том, чего нет", () => {
  it("без подключённых соцев лист зовёт подключить, а не показывает пустоту", () => {
    const h = renderToStaticMarkup(
      createElement(SocialLevel, {
        соцы: [], всего: 0, вне: ПУСТОЕ_ВНЕ, активных: 0, onОткрытьАктивные: () => {}, onВыбрать: () => {},
      }),
    );
    expect(h).toContain("No connected profile yet");
    /* И объясняет, куда делись кабинеты выбывших профилей: они не пропали. */
    expect(h).toMatch(/Ad accounts page/);
    expect(h).toContain("/socials");
  });

  it("первый уровень показывает соцев с их числами", () => {
    const h = renderToStaticMarkup(
      createElement(SocialLevel, {
        соцы: соцыДляЛиста(парк), всего: 3,
        вне: { токенБезОкна: 1, неизвестные: 0, отключённые: 1 }, активных: 1, onОткрытьАктивные: () => {}, onВыбрать: () => {},
      }),
    );
    expect(h).toContain("All connected profiles");
    expect(h).toContain("Monique Mujinga");
    expect(h).toContain("Endah Sukamto");
    /* Живые и забаненные — двумя числами рядом, его словами. */
    expect(h).toContain("active");
    expect(h).toContain("banned");
    /* Профиль с токеном, но без открытого окна, сюда не попадает вовсе. */
    expect(h).not.toContain("Dahzztt Febrianti");
  });

  it("лист целиком рисуется без данных сервера и начинает с соцев", () => {
    /* Самая дешёвая проверка из существующих: серверный рендер не выполняет
       эффектов, поэтому ни ответа `/accounts`, ни профилей антидетекта нет —
       и лист обязан быть целым, а не белым экраном в ожидании. Такое ловится
       только рендером: переехавший экспорт или хук, зовущий браузер, ни одним
       тестом чистых функций не виден. */
    const h = renderToStaticMarkup(createElement(CampaignsView));
    expect(h).toContain("Campaigns");
    expect(h).toContain("read from our database");
    expect(h).toContain("No connected profile yet");
  });

  it("то, чего на этом листе НЕТ, названо числом и причиной", () => {
    /* Правило «токен и открытое окно» выкидывает отсюда часть парка. Молчать об
       этом нельзя: показать МЕНЬШЕ, чем есть, и не сказать — та же неправда,
       что показать лишнее, только тише. Вопрос пришёл от соседнего воркера, и
       он был верный: до этого такие кабинеты исчезали с обоих уровней молча. */
    const h = renderToStaticMarkup(
      createElement(SocialLevel, {
        соцы: соцыДляЛиста(парк), всего: 3,
        вне: { токенБезОкна: 22, неизвестные: 8, отключённые: 130 },
        активных: 1, onОткрытьАктивные: () => {}, onВыбрать: () => {},
      }),
    );
    expect(h).toContain("22 ad accounts whose profile has a token but no open window");
    expect(h).toContain("8 ad accounts we cannot attribute to any profile yet");
    expect(h).toContain("130 ad accounts from profiles that are no longer connected");
    /* И сказано, куда идти: кабинеты не пропали, они на своём листе. */
    expect(h).toContain("/accounts");
  });

  it("прятать нечего — строки про непоказанное нет вовсе", () => {
    const h = renderToStaticMarkup(
      createElement(SocialLevel, {
        соцы: соцыДляЛиста(парк), всего: 3, вне: ПУСТОЕ_ВНЕ, активных: 1, onОткрытьАктивные: () => {}, onВыбрать: () => {},
      }),
    );
    expect(h).not.toContain("Not on this page");
  });

  it("второй уровень: поиск, счёт выбранных и кнопка открыть", () => {
    const h = renderToStaticMarkup(
      createElement(AccountLevel, {
        кабинеты: кабинетыСоца(парк, "00076f0a"), всего: 2, отмечено: ["act_2"],
        поиск: "", onПоиск: () => {}, onОтметить: () => {}, onОтметитьМного: () => {},
        onОткрыть: () => {},
      }),
    );
    expect(h).toContain("Open selected (1)");
    expect(h).toContain("2 of 2 ad accounts");
    expect(h).toContain("1 selected");
    /* Состояние кабинета словом, и «не снимали» — тоже словом, а не пустотой. */
    expect(h).toContain("disabled");
    expect(h).toContain("Ko Swe");
  });
});

/* ── СУТКИ КАБИНЕТА ≠ НАШИ СУТКИ (#154, показывает #153) ─────────────────────
 *
 * Мета режет дни по часам самого кабинета, мы считаем сутки в поясе продукта, и
 * переложить одно в другое нечем: внутри дня разбивки не существует. У восьми
 * кабов парка это Лос-Анджелес, у 137 из 268 пояс неизвестен вовсе. Цифра при
 * этом выглядит точной — и молчать об этом нельзя.
 */
describe("сводка считает расхождение суток покабинетно", () => {
  const сПериодом = (act_id: string, same: boolean | null): ЗагрузкаКаба => ({
    act_id, rows: [], generated_at: "2026-08-15T08:00:00Z", error: null, noHandle: false,
    period: {
      since: "2026-08-14", until: "2026-08-14", tz: "UTC+3", days: 1,
      today: "2026-08-15", same_day_boundary: same,
    },
  });

  it("расхождение и неизвестный пояс считаются ОТДЕЛЬНО", () => {
    /* «Не знаем» и «не совпадает» — разные утверждения, и валить их в одно
       значит соврать в обе стороны сразу. */
    const св = свести([
      сПериодом("act_1", true), сПериодом("act_2", false), сПериодом("act_3", null),
    ]);
    expect(св).toMatchObject({ границыДругие: 1, границыНеизвестны: 1 });
  });

  it("все совпали — оговорки нет вовсе", () => {
    /* Отрицательный контроль данными: на добром наборе счётчики обязаны быть
       нулями, иначе плашка стояла бы на экране всегда и перестала читаться. */
    const св = свести([сПериодом("act_1", true), сПериодом("act_2", true)]);
    expect(св).toMatchObject({ границыДругие: 0, границыНеизвестны: 0 });
  });

  it("окно берётся ИЗ ОТВЕТА, а не из кнопок панели", () => {
    /* Панель дат не считает вовсе: «какое сегодня число» знает один
       `core/period.py` в поясе продукта, а браузер живёт в поясе своего
       человека. Разошлись бы в первую же ночь на границе суток. */
    expect(свести([сПериодом("act_1", true)]).период)
      .toMatchObject({ since: "2026-08-14", until: "2026-08-14", tz: "UTC+3" });
  });

  it("ответа с периодом нет — период НЕ выдумывается", () => {
    const св = свести([{
      act_id: "act_9", rows: [], generated_at: null, period: null,
      error: null, noHandle: false,
    }]);
    expect(св.период).toBeNull();
    expect(св).toMatchObject({ границыДругие: 0, границыНеизвестны: 0 });
  });
});

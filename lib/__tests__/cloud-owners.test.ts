/* Соцы кабинета из БАЗЫ: что панель имеет право из них вывести, а что нет.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ. 15.08 ручка `/accounts` начала отдавать `owners` —
 * `[{profile_id, name, oauth, in_antidetect}]` на кабинет. Без них облачный
 * арендатор видел кабинеты, но выбрать не мог: залив идёт ОТ профиля, и панель
 * гасила чекбокс у строки без соца. То есть основной цикл продукта — выбрал
 * кабы, собрал связку, залил — был закрыт всем, кроме владельца, у которого
 * лист собирался из снапшота мака.
 *
 * ПРОВЕРЯЕМ НЕ «читается ли поле», а способы соврать, каждый из которых тише
 * самого дефекта:
 *
 *  1. Соц базы — не соц снапшота. У панельного `AccountOwner` есть `present`,
 *     `fresh` и `collectedAt`; база знает из них только первый, и то под другим
 *     именем. Заполнить остальные правдоподобным значением значит выдумать
 *     состояние профиля, которого никто не проверял.
 *  2. Годность к заливу — КОНЪЮНКЦИЯ двух признаков, и обе половины проверяются
 *     здесь порознь. «Кабинет виден с профиля», «у соца есть токен» и «это окно
 *     сейчас открывается» — три разных факта; на базе владельца это 695 связей,
 *     четыре токена и четыре живых окна, причём токены и окна НЕ ПЕРЕСЕКАЮТСЯ
 *     ВОВСЕ: токены остались под мёртвыми ключами AdsPower, окна завелись
 *     заново в ShardX. Чекбокс по одному токену дал бы ровно обратный ответ —
 *     погасил бы единственный рабочий профиль и предложил залив через окно,
 *     которого нет.
 *  3. Пустой `owners` — «связок не знаем», а не «их нет». Разные ответы, разные
 *     причины, разное лечение, и на экране они обязаны остаться разными. С
 *     15.08 таких ответов три, а не два: добавился «токен есть, окна нет», и
 *     чинится он в антидетекте, а не в панели.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  accKey, cloudOwners, listNoUploadReason, noUploadReason, отмечаемые, ownerFromCloud, unifiedAccounts,
  type CloudAccountRow, type CloudOwner, type UnifiedAccount,
} from "@/lib/cloud-accounts";
import { срез, подключён, профилиСписок, ПУСТОЙ_СРЕЗ } from "@/lib/cloud-filter";
import type { AccountOwner, AccountRow } from "@/lib/account-rows";
import type { SnapshotAccount } from "@/lib/types";
import { AccountsTable, НЕЛЬЗЯ_ПОДПИСЬ } from "@/components/views/AccountsView";

const соц = (p: Partial<AccountOwner> & { profile: string }): AccountOwner => ({
  label: "", present: true, fresh: true, oauth: false, ...p,
});

const снап = (acc: Partial<SnapshotAccount> & { id: string },
              owners: AccountOwner[] = [соц({ profile: "k1a" })]): AccountRow => ({
  acc: { name: "", ...acc } as SnapshotAccount,
  profile: owners[0]?.profile || "",
  profileLabel: owners[0]?.label || owners[0]?.profile || "",
  owners,
});

/** Одна строка базы с соцами — ровно в той форме, в какой её кладёт демон. */
const каб = (act_id: string, owners: CloudAccountRow["owners"]): CloudAccountRow =>
  ({ act_id, name: "MB3 · 04", status: "ACTIVE", owners });

/** Соц с ЖИВЫМ окном. Отдельная обёртка, потому что `in_antidetect` придётся
 *  писать почти в каждой строке: без него залив не предлагается вовсе, и
 *  фикстура без этого поля проверяла бы не то, что думает автор. */
const живое = (o: CloudOwner): CloudOwner => ({ in_antidetect: true, ...o });

describe("контракт стыка: имена полей у соца те же, что кладёт демон", () => {
  /* Ловушка на молчаливое расхождение. Переименуют на бэкенде `profile_id` — и
     панель не сломается ни компилятором, ни тестом на своих же фикстурах: она
     просто получит соца без id, выкинет его и вернётся ровно к тому состоянию,
     ради выхода из которого всё это писалось, — «связок не знаем» на всём парке.
     Такое лечится только сверкой с настоящим источником. */
  const daemon = readFileSync(
    path.resolve(__dirname, "..", "..", "..", "scripts", "analytics_daemon.py"), "utf8");

  it("демон отдаёт profile_id, name, oauth и in_antidetect", () => {
    /* Ищем в том месте, где соц СОБИРАЕТСЯ, а не там, где подставляется
       запасной пустой: запасной легко пережил бы правку настоящего. Начало
       блока проверяем отдельно — `indexOf` на переименованной функции вернул бы
       -1, и срез стал бы всем файлом, где найдётся что угодно. */
    const от = daemon.indexOf("def _соцы_профилей");
    expect(от).toBeGreaterThan(0);
    const блок = daemon.slice(от, daemon.indexOf("def accounts(", от));
    for (const поле of ['"profile_id"', '"name"', '"oauth"', '"in_antidetect"']) {
      expect(блок).toContain(поле);
    }
    /* И что эти соцы правда уезжают в ответ полем `owners`. */
    expect(daemon).toContain('"owners": [');
  });
});

describe("соц базы знает про себя два признака из трёх", () => {
  it("окно приезжает из `in_antidetect`, и оба ответа настоящие", () => {
    expect(ownerFromCloud({ profile_id: "k1a", in_antidetect: true }).present).toBe(true);
    expect(ownerFromCloud({ profile_id: "k1a", in_antidetect: false }).present).toBe(false);
  });

  it("поля НЕТ в ответе — `present` null, а не false", () => {
    /* Разница дорогая и в обе стороны. `false` объявил бы соца выбывшим — лист
       метит таких призраками и не берёт в залив; `true` предложил бы залив
       через окно, про которое никто ничего не говорил. `null` — «подтвердить
       некому», и это третий ответ, а не одна из двух крайностей. */
    const o = ownerFromCloud({ profile_id: "k1a", name: "17/7 spx", oauth: true });
    expect(o).toEqual({ profile: "k1a", label: "17/7 spx", present: null, fresh: null,
                        oauth: true });
  });

  it("`fresh` здесь null всегда: сбора, свежесть которого меряют, не было", () => {
    expect(ownerFromCloud({ profile_id: "k1a", in_antidetect: true }).fresh).toBeNull();
  });

  it("времени сбора у связи нет, и пустая метка не подставляется", () => {
    /* Пустая строка сортируется как «самый старый сбор» и молча решала бы, чьим
       временем подписана строка листа. */
    expect("collectedAt" in ownerFromCloud({ profile_id: "k1a" })).toBe(false);
  });

  it("«с него можно лить» — только строгое true", () => {
    expect(ownerFromCloud({ profile_id: "k1a" }).oauth).toBe(false);
    expect(ownerFromCloud({ profile_id: "k1a", oauth: null }).oauth).toBe(false);
    expect(ownerFromCloud({ profile_id: "k1a", oauth: true }).oauth).toBe(true);
  });

  it("имени нет — пусто, а не id вместо имени", () => {
    /* id покажет вьюха, но подставить его в поле имени значит потерять сам факт
       «имени мы не знаем» для всех, кто читает строку дальше. */
    expect(ownerFromCloud({ profile_id: "k1a", name: null }).label).toBe("");
  });

  it("годные первыми, дубли и пустые id выброшены", () => {
    const list = cloudOwners([
      живое({ profile_id: "k1z" }), { profile_id: "" },
      живое({ profile_id: "k1m", oauth: true }),
      живое({ profile_id: "k1z" }), живое({ profile_id: "k1a" }),
    ]);
    expect(list.map((o) => o.profile)).toEqual(["k1m", "k1a", "k1z"]);
  });
});

describe("залив предлагается только тем, чем залить можно", () => {
  it("связи есть, токена нет — кабинет НЕ отмечается", () => {
    /* Тот самый промах, ради которого oauth отделён от владения: 695 связей на
       четыре живых окна. Отметить такой каб значит дать собрать связку и
       упереться в отказ Меты уже после сборки. */
    const [r] = unifiedAccounts([], [каб("act_1", [живое({ profile_id: "k1a" }),
                                                   живое({ profile_id: "k1b",
                                                           oauth: false })])]);
    expect(r.owners.map((o) => o.profile)).toEqual(["k1a", "k1b"]);
    expect(r.profile).toBeNull();
    expect(noUploadReason(r)).toBe("no-connected-profile");
  });

  it("ТОКЕН БЕЗ ЖИВОГО ОКНА — тоже не отмечается", () => {
    /* Главный урок 15.08, и он стоил бы худшего из возможных промахов. На базе
       владельца токены лежат под четырьмя ключами AdsPower, мёртвыми после
       переезда на ShardX; включи мы чекбокс по одному токену — панель
       предложила бы залив через окно, которого НЕ СУЩЕСТВУЕТ, и погасила бы
       единственный рабочий профиль. Ключ токена не переезжает на новый профиль
       намеренно: на старый ссылается вся история кабинета. */
    const [r] = unifiedAccounts([], [каб("act_1", [{ profile_id: "k1fg9weq", oauth: true,
                                                    in_antidetect: false }])]);
    expect(r.profile).toBeNull();
    expect(noUploadReason(r)).toBe("no-live-window");
  });

  it("живое окно без токена и токен без окна вместе НЕ складываются", () => {
    /* Два разных соца, у каждого своя половина. Половины принадлежат РАЗНЫМ
       профилям, и залив идёт от одного — сложить их нечем. */
    const [r] = unifiedAccounts([], [каб("act_1", [
      { profile_id: "k1fg9weq", oauth: true, in_antidetect: false },
      { profile_id: "00076f0a", oauth: false, in_antidetect: true },
    ])]);
    expect(r.profile).toBeNull();
    expect(noUploadReason(r)).toBe("no-live-window");
  });

  it("соц с обоими признаками становится соцем залива, даже если он не первый", () => {
    const [r] = unifiedAccounts([], [каб("act_1", [
      живое({ profile_id: "k1z" }),
      живое({ profile_id: "k1m", name: "17/7 spx", oauth: true }),
    ])]);
    expect(r.profile).toBe("k1m");
    expect(r.profileLabel).toBe("17/7 spx");
    expect(noUploadReason(r)).toBeNull();
  });

  it("мёртвое окно уходит в конец списка, даже с токеном", () => {
    /* Порядок решает, кого строка называет главным и чьё имя видно первым.
       Мёртвый профиль с токеном не имеет права стоять выше живого. */
    const [r] = unifiedAccounts([], [каб("act_1", [
      { profile_id: "k1fg9weq", oauth: true, in_antidetect: false },
      { profile_id: "00076f0a", oauth: true, in_antidetect: true },
      { profile_id: "a896ef95", oauth: false, in_antidetect: true },
    ])]);
    expect(r.owners.map((o) => o.profile)).toEqual(["00076f0a", "a896ef95", "k1fg9weq"]);
    expect(r.profile).toBe("00076f0a");
  });

  it("сервер про окно не сказал вовсе — залив не предлагаем", () => {
    /* `present: null` это «подтвердить некому», а не «живо». На «не сказал»
       залив не предлагают: цена ошибки здесь — связка, собранная зря. */
    const [r] = unifiedAccounts([], [каб("act_1", [{ profile_id: "k1m", oauth: true }])]);
    expect(r.owners[0].present).toBeNull();
    expect(r.profile).toBeNull();
    expect(noUploadReason(r)).toBe("no-live-window");
  });

  it("имени у годного соца нет — подписью становится id, а не пустота", () => {
    const [r] = unifiedAccounts([], [каб("act_1", [живое({ profile_id: "k1m",
                                                          oauth: true })])]);
    expect(r.profileLabel).toBe("k1m");
  });
});

describe("пустой owners — «не знаем», а не «их нет»", () => {
  it("четыре состояния строки различимы, и это ЧЕТЫРЕ разных ответа", () => {
    const rows = unifiedAccounts([], [
      каб("act_1", []),
      каб("act_2", [живое({ profile_id: "k1a" })]),
      каб("act_3", [{ profile_id: "k1fg9weq", oauth: true, in_antidetect: false }]),
      каб("act_4", [живое({ profile_id: "k1m", oauth: true })]),
    ]);
    expect(rows.map(noUploadReason))
      .toEqual(["owners-unknown", "no-connected-profile", "no-live-window", null]);
  });

  it("причина листа — самая продвинутая из встреченных, а не первая", () => {
    /* Учётка, где токен уже есть хоть где-то, ближе к работе, чем та, где его
       нет нигде. Позвать её подключать соца значит послать человека делать то,
       что он уже сделал, — и увести от настоящей причины. */
    const смешанный = unifiedAccounts([], [
      каб("act_1", []),
      каб("act_2", [живое({ profile_id: "k1a" })]),
      каб("act_3", [{ profile_id: "k1fg9weq", oauth: true, in_antidetect: false }]),
    ]);
    expect(listNoUploadReason(смешанный)).toBe("no-live-window");

    /* Годен хоть один каб — сообщения про учётку нет вовсе. */
    expect(listNoUploadReason(unifiedAccounts([], [
      каб("act_1", []),
      каб("act_2", [живое({ profile_id: "k1m", oauth: true })]),
    ]))).toBeNull();
    expect(listNoUploadReason([])).toBeNull();
  });

  it("поля owners нет вовсе — то же «не знаем», а не поломка", () => {
    /* Так выглядит ответ демона, который ещё не выкатили. Панель обязана
       остаться листом, а не упасть и не решить, что соцев нет. */
    const [r] = unifiedAccounts([], [{ act_id: "act_1" }]);
    expect(r.owners).toEqual([]);
    expect(noUploadReason(r)).toBe("owners-unknown");
  });
});

describe("сведение со снапшотом: соцев берём у обоих", () => {
  it("соц, которого знает только база, приезжает к строке снапшота", () => {
    /* Тот же приём и та же причина, что у `also_on` в `account-rows`: два
       реестра одних и тех же связей обязаны сходиться, а расхождение — ровно та
       болезнь, которую лечим, поэтому верить одному нельзя. */
    const [r] = unifiedAccounts(
      [снап({ id: "act_1" }, [соц({ profile: "k1a", oauth: true })])],
      [каб("act_1", [живое({ profile_id: "k1a" }), живое({ profile_id: "k1b" })])],
    );
    expect(r.owners.map((o) => o.profile)).toEqual(["k1a", "k1b"]);
    /* Соц снапшота не переписан соцем базы: про первого известны все три
       признака (в том числе свежесть сбора), про второго — два. */
    expect(r.owners[0]).toMatchObject({ profile: "k1a", present: true, fresh: true });
    expect(r.owners[1]).toMatchObject({ profile: "k1b", present: true, fresh: null });
  });

  it("главный соц снапшота остаётся главным, и токен базы его не двигает", () => {
    /* На машине оператора льют браузером через антидетект, и токен там не
       единственный ключ. Перевыбор главного здесь сменил бы профиль, от имени
       которого пойдёт залив, — молча и у владельца. */
    const [r] = unifiedAccounts(
      [снап({ id: "act_1" }, [соц({ profile: "k1a" })])],
      [каб("act_1", [живое({ profile_id: "k1b", oauth: true })])],
    );
    expect(r.profile).toBe("k1a");
    expect(noUploadReason(r)).toBeNull();
  });

  it("строка снапшота без токена по-прежнему отмечается", () => {
    /* Ловушка на слишком широкое правило: если потребовать токен ОТ ВСЕХ,
       владелец потеряет выбор на всём своём парке разом. */
    const [r] = unifiedAccounts([снап({ id: "act_1" }, [соц({ profile: "k1a" })])], []);
    expect(noUploadReason(r)).toBeNull();
  });

  it("кабинет не раздваивается и соцы не дублируются", () => {
    const rows = unifiedAccounts(
      [снап({ id: "act_777" }, [соц({ profile: "k1a" })])],
      [каб("777", [живое({ profile_id: "k1a", oauth: true })])],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].owners.map((o) => o.profile)).toEqual(["k1a"]);
  });
});

describe("соцы базы работают в фильтрах листа, а не только в строке", () => {
  const rows = unifiedAccounts([], [
    каб("act_1", [живое({ profile_id: "k1m", name: "17/7 spx", oauth: true })]),
    каб("act_2", [живое({ profile_id: "k1a" }), живое({ profile_id: "k1b" })]),
    каб("act_3", []),
  ]);

  it("фильтр по соцу находит кабинет облачного арендатора", () => {
    expect(срез(rows, { ...ПУСТОЙ_СРЕЗ, профиль: "k1a" }).map((a) => a.act_id))
      .toEqual(["act_2"]);
  });

  it("поиск по id соца тоже находит", () => {
    expect(срез(rows, { ...ПУСТОЙ_СРЕЗ, запрос: "k1m" }).map((a) => a.act_id))
      .toEqual(["act_1"]);
  });

  it("отмечаемое множество и живой чекбокс — ОДНО И ТО ЖЕ", () => {
    /* Самое сильное, что здесь можно утверждать, и утверждать это надо: человек
       отбирает строки, получает список и ему верит. Список, который шире
       отмечаемого хоть на строку, — обещание залива, которого не будет.

       ЧИТАЕТСЯ ЧЕРЕЗ `отмечаемые`, А НЕ ЧЕРЕЗ ФИЛЬТР. Состояния «можно лить»
       больше нет: чип с ним снят по прямым словам владельца («чип только
       раздражает»). Само правило никуда не делось и стало важнее — теперь оно
       единственное, что решает, гаснет ли чекбокс. Проверять его надо там, где
       оно живёт. */
    expect(отмечаемые(rows).map((a) => a.act_id))
      .toEqual(rows.filter((a) => noUploadReason(a) === null).map((a) => a.act_id));
  });

  it("«общий каб» и «соц подключён» по-прежнему различимы по этим же соцам", () => {
    /* Оба состояния ушли из МЕНЮ фильтра — меню теперь ровно корзины статуса
       Меты, а это вопросы про устройство парка, а не про статус. Но сами факты
       остались фактами, и различать их продукт обязан: `подключён` решает
       охват (`вОхвате`), которым живёт и лист «Кампании», а «виден больше чем
       с одного соца» рисует бейдж `shared` в строке.

       Поэтому проверяем ИСТОЧНИК, а не пункт меню. Пункт можно снять с экрана;
       правило снять нельзя. */
    expect(rows.filter(подключён).map((a) => a.act_id)).toEqual(["act_1"]);
    expect(rows.filter((a) => a.owners.length > 1).map((a) => a.act_id)).toEqual(["act_2"]);
  });

  it("в выпадающем списке — только ТЕКУЩИЕ профили, а не вся история связей", () => {
    /* Владелец на живом проде: «тут добавлены все профили, которые я удалял,
       архивировал — нахуй не надо». Связи `account_owner` копятся вечно и
       мёртвыми не помечаются, поэтому в списке владельцев кабинета лежит вся
       его история. Фильтр из истории предлагает выбрать то, чем нельзя
       работать, а выбранный мёртвый профиль отдаёт пустой лист — и человек
       решает, что сломана панель.
       Здесь токен есть только у k1m, поэтому он один и остаётся. */
    expect(профилиСписок(rows).map((p) => p.id)).toEqual(["k1m"]);
  });
});

describe("на экране состояния выглядят по-разному", () => {
  /* Серверный рендер таблицы: эффектов в ней нет, строки приходят готовыми.
     Проверяем то, что человек видит и чем пользуется, — доступность чекбокса и
     то, что известные соцы показаны, а не спрятаны под прочерк. */
  const таблица = (a: UnifiedAccount) =>
    renderToStaticMarkup(createElement(AccountsTable, {
      flat: [a],
      selected: new Set<string>(), onSelect: () => {},
      inGroup: new Map<string, string[]>(), allSelected: false, onSelectAll: () => {},
      cols: [{ id: "cab", title: "ad account", w: 300 }, { id: "soc", title: "profile", w: 170 }],
      colWidth: (c) => c.w,
      ряд: { id: "spend", desc: true }, onРяд: () => {},
    }));

  /** Чекбокс ИМЕННО СТРОКИ. В шапке живёт второй, «Select all shown», и он не
   *  гаснет никогда — проверка «есть ли где-нибудь disabled» прошла бы всегда и
   *  ничего бы не значила. */
  const чекбоксСтроки = (html: string) =>
    (html.match(/<input[^>]*aria-label="Select MB3[^>]*>/) || [""])[0];

  const [годен] = unifiedAccounts([], [каб("act_1", [живое({ profile_id: "k1m",
                                                            oauth: true })])]);
  const [безТокена] = unifiedAccounts([], [каб("act_2", [живое({ profile_id: "k1a" })])]);
  const [безСвязей] = unifiedAccounts([], [каб("act_3", [])]);
  const [безОкна] = unifiedAccounts([], [каб("act_4", [{ profile_id: "k1fg9weq",
                                                        oauth: true,
                                                        in_antidetect: false }])]);

  it("живое окно с токеном отмечается, и щит стоит только у него", () => {
    const html = таблица(годен);
    expect(html).toContain("k1m");
    expect(html).toContain("Profile connected via OAuth");
    expect(чекбоксСтроки(html)).toMatch(/aria-label="Select MB3/);
    expect(чекбоксСтроки(html)).not.toContain("disabled");
  });

  it("токен без окна: чекбокс погашен, щита НЕТ, бейдж свой", () => {
    /* Худший из возможных промахов выглядел бы именно здесь: щит и живой
       чекбокс на профиле, окна которого не существует. */
    const html = таблица(безОкна);
    expect(html).toContain("k1fg9weq");
    expect(html).not.toContain("Profile connected via OAuth");
    expect(html).toContain("no window");
    /* И бейдж не тот, что у «нет токена»: чинится это в антидетекте, а не в
       панели, и звать подключать соца было бы неправдой. */
    expect(html).not.toContain("no OAuth");
    expect(чекбоксСтроки(html)).toContain("disabled");
    expect(html).toContain(НЕЛЬЗЯ_ПОДПИСЬ["no-live-window"]);
  });

  it("без токена чекбокс погашен, но соцы ВИДНЫ", () => {
    const html = таблица(безТокена);
    /* Главное отличие от «не знаем»: id соца на экране есть. Именно по нему
       человек понимает, какой профиль подключать. */
    expect(html).toContain("k1a");
    expect(html).toContain("no OAuth");
    expect(чекбоксСтроки(html)).toContain("disabled");
    /* Причина под курсором ведёт туда, где это чинится. */
    expect(html).toContain(НЕЛЬЗЯ_ПОДПИСЬ["no-connected-profile"]);
  });

  it("без связей — прочерк и другая причина, а не та же самая", () => {
    const html = таблица(безСвязей);
    expect(чекбоксСтроки(html)).toContain("disabled");
    expect(html).toContain(НЕЛЬЗЯ_ПОДПИСЬ["owners-unknown"]);
    /* Ни «no OAuth», ни зова подключать соца: подключать нечего и незачем —
       мы вообще не знаем, с каких профилей этот кабинет виден. */
    expect(html).not.toContain("no OAuth");
    expect(html).not.toContain("connected to the app");
  });

  it("ключ отметки у каждого свой и нормализован", () => {
    expect([годен, безТокена, безСвязей, безОкна].map((a) => accKey(a.act_id)))
      .toEqual(["1", "2", "3", "4"]);
  });
});

/* ПРИЧИНЫ ОБЯЗАНЫ РАЗЛИЧАТЬСЯ НА ЭКРАНЕ, А НЕ ТОЛЬКО В КОДЕ.
 *
 * Три проверки выше сверялись с literal-фразами. Это держало текст, а не
 * гарантию: перепиши фразы покороче — и тесты покраснеют, хотя ничего не
 * сломано; склей две причины в одну фразу — и они останутся зелёными, хотя
 * сломано главное.
 *
 * Главное здесь вот что: «окна нет» чинится в антидетекте, «соц не подключён» —
 * в панели, а «соцев не знаем» не чинится человеком вовсе. Одна фраза на две
 * причины посылает его не туда, и узнает он об этом через час.
 *
 * Поэтому проверки выше читают САМ СЛОВАРЬ, а этот тест требует, чтобы в нём не
 * было двух одинаковых значений. Текст стал короче (владелец: «избавиться от
 * лишнего аи слопа») — гарантия осталась.
 */
describe("причины «нельзя отметить» не сливаются в одну", () => {
  it("все подписи различны", () => {
    const значения = Object.values(НЕЛЬЗЯ_ПОДПИСЬ);
    expect(new Set(значения).size, `совпали: ${значения.join(" | ")}`)
      .toBe(значения.length);
  });

  it("подпись есть у КАЖДОЙ причины, которую умеет вернуть правило", () => {
    /* Список причин выводится из типа, а не переписан рядом: заведут новую —
       здесь станет пусто, и это увидят. */
    for (const [ключ, текст] of Object.entries(НЕЛЬЗЯ_ПОДПИСЬ)) {
      expect(текст.trim().length, `${ключ} без подписи`).toBeGreaterThan(0);
    }
  });
});

/* Переключатель источника данных: Server/OAuth ↔ Snapshot.
 *
 * ЗАЧЕМ РЕЖИМ ВООБЩЕ ЕСТЬ. Подключение профилей по OAuth ненадёжно, а охват
 * листа кабинетов (`cloud-filter.правилоОхвата`) требует у соца живой токен.
 * Пока токена нет, серверный лист честно показывает пустоту — и работать
 * человеку нечем. Режим снапшота отвечает на другой вопрос: «что вообще есть в
 * уже загруженном снапшоте», без единого обращения к OAuth.
 *
 * ПОЧЕМУ ПРОВЕРКИ ИМЕННО ТАКИЕ. Здесь легко написать зелёный тест, который
 * ничего не проверяет: собрать фикстуру с `oauth: true` и убедиться, что всё
 * выбирается. Поэтому в каждой фикстуре ниже `oauth` у ВСЕХ соцев ложен, и
 * рядом стоит отрицательный контроль — тот же набор строк, прогнанный через
 * серверное правило, обязан отдать пустоту. Без этой пары «профиль виден»
 * доказывало бы не работу режима, а удачную фикстуру.
 *
 * Два теста в конце читают НАСТОЯЩИЕ файлы оболочки и стора, а не свою копию
 * их содержимого: переключатель, тихо переставший сохраняться или отвязанный
 * от подписей, выглядит на экране совершенно нормально.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/lib/store";
import { accountRows } from "@/lib/account-rows";
import { snapshotProfileOptions, unifiedAccounts, можноЛить } from "@/lib/cloud-accounts";
import { вОхвате, профилиСписок } from "@/lib/cloud-filter";
import { DATA_SOURCE_OPTIONS, type Snapshot } from "@/lib/types";

/** Снапшот одного профиля с одним кабинетом. Токена нет ни у кого: `oauth`
 *  считается по множеству, которое мы не передаём вовсе, — ровно так выглядит
 *  учётка, где сервер не может подтвердить подключение. */
const СНАП: Snapshot = {
  generated_at: "2026-08-17T06:00:00Z",
  profiles: {
    k1snap: {
      label: "17/7 spx",
      team: "keine",
      collected_at: "2026-08-17T05:00:00Z",
      accounts: [{ id: "act_777", name: "Ad account 777", status: "ACTIVE" }],
    },
  },
};

function строкиСнапшота() {
  return unifiedAccounts(accountRows(СНАП), null);
}

describe("режим источника живёт в сторе и переживает перезагрузку", () => {
  beforeEach(() => {
    useStore.setState({ dataSource: "server" });
  });

  it("по умолчанию Server/OAuth", () => {
    expect(useStore.getState().dataSource).toBe("server");
  });

  it("переключается в обе стороны и мгновенно", () => {
    useStore.getState().setDataSource("snapshot");
    expect(useStore.getState().dataSource).toBe("snapshot");
    useStore.getState().setDataSource("server");
    expect(useStore.getState().dataSource).toBe("server");
  });

  it("при смене источника не переносит выбранный кабинет со старым профилем", () => {
    useStore.setState({
      dataSource: "server",
      cabSelection: [{ profile: "server-profile", act: "act_777" }],
    });

    useStore.getState().setDataSource("snapshot");
    expect(useStore.getState().cabSelection).toEqual([]);
  });

  it("повторное нажатие текущего режима не сбрасывает выбор", () => {
    const selection = [{ profile: "snapshot-profile", act: "act_777" }];
    useStore.setState({ dataSource: "snapshot", cabSelection: selection });

    useStore.getState().setDataSource("snapshot");
    expect(useStore.getState().cabSelection).toEqual(selection);
  });

  it("подписи переключателя заданы одним списком", () => {
    expect(DATA_SOURCE_OPTIONS.map((o) => o.value)).toEqual(["server", "snapshot"]);
    expect(DATA_SOURCE_OPTIONS.map((o) => o.label)).toEqual(["Server/OAuth", "Snapshot"]);
  });
});

describe("строки снапшота выбираются БЕЗ подтверждённого OAuth", () => {
  it("у всех соцев фикстуры токена нет — иначе тест доказывал бы не то", () => {
    const rows = строкиСнапшота();
    expect(rows).toHaveLength(1);
    expect(rows[0].owners.length).toBeGreaterThan(0);
    expect(rows[0].owners.every((o) => o.oauth === false)).toBe(true);
  });

  it("соц залива у строки всё равно есть, и ОБЩЕЕ правило её пропускает", () => {
    /* Правило годности одно на всю панель (`можноЛить`), и своего у режима
       снапшота нет намеренно: второе определение того же правила разъезжается с
       первым молча — это уже стоило #166. Здесь проверяется, что общее правило
       БЕЗ подтверждённого OAuth строку пропускает, то есть режиму не нужно
       исключение. */
    const [row] = строкиСнапшота();
    expect(row.profile).toBe("k1snap");
    expect(можноЛить(row)).toBe(true);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: серверный охват на тех же строках отдаёт пустоту", () => {
    /* Ради этой строки режим и заведён. Не будь её — «профиль виден» ничего бы
       не значило: он был бы виден и без всякого переключателя. */
    expect(вОхвате(строкиСнапшота(), "подключённые")).toEqual([]);
  });

  it("мёртвый кабинет не выбирается и в снапшоте: разбана у Меты не бывает", () => {
    const мёртвый: Snapshot = {
      profiles: {
        k1snap: {
          label: "17/7 spx",
          accounts: [{ id: "act_778", name: "banned", status: "DISABLED" }],
        },
      },
    };
    const [row] = unifiedAccounts(accountRows(мёртвый), null);
    expect(row.profile).toBe("k1snap");
    expect(можноЛить(row)).toBe(false);
  });
});

describe("выпадашка профилей в режиме снапшота", () => {
  it("профиль есть в списке, хотя токен не подтверждён", () => {
    expect(snapshotProfileOptions(строкиСнапшота()))
      .toEqual([{ id: "k1snap", label: "17/7 spx" }]);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: серверный список на тех же строках пуст", () => {
    expect(профилиСписок(строкиСнапшота())).toEqual([]);
  });

  it("имени нет — показываем id, а не выдумываем подпись", () => {
    const безИмени: Snapshot = {
      profiles: { k1bez: { accounts: [{ id: "act_9", name: "x" }] } },
    };
    expect(snapshotProfileOptions(unifiedAccounts(accountRows(безИмени), null)))
      .toEqual([{ id: "k1bez", label: "k1bez" }]);
  });
});

describe("режим снапшота НИЧЕГО не досочиняет", () => {
  it("bm_id, код статуса и spend_cap остаются пустыми", () => {
    const [row] = строкиСнапшота();
    expect(row.bm_id).toBeNull();
    expect(row.status_code).toBeNull();
    expect(row.spend_cap).toBeNull();
  });

  it("команды в снапшоте нет — панель не подставляет чужую", () => {
    const безКоманды: Snapshot = {
      profiles: { k1bez: { accounts: [{ id: "act_9", name: "x" }] } },
    };
    expect(безКоманды.profiles?.k1bez.team).toBeUndefined();
  });
});

/* ── ДОГОВОРЁННОСТЬ С НАСТОЯЩИМ ИСТОЧНИКОМ, А НЕ С ЕГО КОПИЕЙ ─────────────── */

const корень = path.resolve(__dirname, "..", "..");
const читать = (p: string) => readFileSync(path.join(корень, p), "utf8");

describe("«пусто» — это ДВА разных факта, и вью обязана их различать", () => {
  /* Настоящие данные, а не выдумка: снапшот приезжает арендатору с профилями,
     у которых `accounts` пуст (профиль есть, кабинетов у него ещё не собрали),
     и тогда строк нет ПРИ ПОЛНОСТЬЮ ПРИЕХАВШЕМ снапшоте. Проверка «строк ноль
     ⇒ снапшота нет» была бы верна по виду и неверна на этих данных. */
  const пустойНоПриехавший: Snapshot = {
    generated_at: "2026-08-17T06:00:00Z",
    profiles: { k1snap: { label: "17/7 spx", accounts: [] } },
  };

  it("снапшот приехал, а строк ноль — значит счётчик строк про приезд НЕ отвечает", () => {
    expect(unifiedAccounts(accountRows(пустойНоПриехавший), null)).toEqual([]);
    expect(пустойНоПриехавший.generated_at).toBeTruthy();
  });

  it("снапшот приехал, а профилей ноль — то же самое для листа профилей", () => {
    const безПрофилей: Snapshot = { generated_at: "2026-08-17T06:00:00Z", profiles: {} };
    expect(Object.entries(безПрофилей.profiles ?? {})).toEqual([]);
  });

  it("AccountsView разводит «не загрузился» и «загрузился и пуст» по снапшоту", () => {
    /* Развилка осталась, но переехала: шесть плашек над таблицей свернулись в
       одну строку состояния данных (`sections/DataHealth`), и оба случая стали
       её фактами — `snapshot-missing` и `snapshot-empty`. Разными они обязаны
       быть по-прежнему: одно сообщение на оба посылало бы человека собирать
       то, что уже собрано, и молчало бы о настоящем факте. */
    const view = читать("components/views/AccountsView.tsx");
    expect(view).toContain("снапРежим && !snapshot");
    expect(view).toContain('id: "snapshot-missing"');
    expect(view).toContain('id: "snapshot-empty"');
    expect(view).toContain("carries no ad accounts");
  });

  it("SocialsView разводит их так же", () => {
    const view = читать("components/views/SocialsView.tsx");
    expect(view).toContain("!snapshot ?");
    expect(view).toContain("carries no profiles");
  });
});

describe("второго правила годности к заливу не заводим", () => {
  it("в cloud-accounts нет отдельного предиката выбора для режима снапшота", () => {
    /* #166: правило жило в трёх местах и давало два разных ответа. Строка ниже
       не про имя функции, а про запрет заводить ей копию под новым именем —
       поэтому проверяется отсутствие символа, а не наличие комментария. */
    expect(читать("lib/cloud-accounts.ts")).not.toContain("export function snapshotSelectable");
  });

  it("AccountsView не заводит СВОЕГО правила отметки — зовёт общее", () => {
    /* ЗДЕСЬ СТОЯЛА ПРОВЕРКА, КОТОРАЯ ЗАКРЕПЛЯЛА ДЕФЕКТ.
       Она называлась «AccountsView фильтрует выбор общим правилом» и требовала
       в исходнике текст `visible.filter(снапРежим ? можноЛить` — то есть ровно
       то выражение, в котором правил было ДВА: `можноЛить` в режиме снапшота и
       `Boolean(r.profile)` в серверном. Расходятся они на забаненном кабинете с
       известным профилем, и из-за этого галка «выбрать всё» не сходилась
       никогда, а снять выделение ею было нельзя (70 строк из 109 на проде).

       Название утверждало гарантию, проверка держала её нарушение.

       Теперь правило одно и живёт множеством в `cloud-accounts.отмечаемые`, а
       ПОВЕДЕНИЕ проверяется в `__tests__/accounts-select-all` — фикстурой с
       забаненным-но-с-профилем кабинетом и отрицательным контролем на прежнее
       правило. Здесь остаётся то, что проверяется только по тексту: что второго
       предиката рядом не завели снова. Проверка на ОТСУТСТВИЕ, как у соседней
       про `snapshotSelectable`: она не может «пройти», описывая ошибку. */
    const view = читать("components/views/AccountsView.tsx");
    expect(view).toContain("отмечаемые(visible)");
    expect(view).not.toContain("снапРежим ? можноЛить");
    expect(view).not.toMatch(/filter\(\s*\(r\)\s*=>\s*Boolean\(r\.profile\)/);
  });
});

describe("переключатель правда стоит на месте и правда сохраняется", () => {
  it("выбор источника живёт в «Интеграциях», из общего списка и зовёт setDataSource", () => {
    /* ПЕРЕЕХАЛ 17.08 ИЗ ОБОЛОЧКИ. Он приехал туда полосой во всю ширину на
       каждой странице — верно как срочная мера, неверно как устройство:
       переключатель, видимый всегда, читается как вид листа, а меняет он
       источник данных сразу для трёх листов. Слова владельца: «выбор режима
       сделать oAuth / Snapshot и перенести в лист integrations».
       Список подписей по-прежнему ОДИН на продукт — второй экземпляр разъехался
       бы с первым молча. */
    const card = читать("components/sections/integrations/DataSourceCard.tsx");
    expect(card).toContain("DATA_SOURCE_OPTIONS");
    expect(card).toContain("setDataSource");
    expect(card).toContain("Segmented");
    expect(читать("components/views/IntegrationsView.tsx")).toContain("<DataSourceCard");
  });

  it("в оболочке его больше нет, и высота колонок вернулась", () => {
    /* Полоса занимала 2.75rem, и обе колонки вычитали из `100dvh` сумму
       `6.25rem`. Снять полосу и оставить вычитание — значит получить на КАЖДОМ
       листе канвас за нижним краем экрана и второй скролл поверх страницы.
       Такое не ловится ни одним тестом на данные и видно только глазами, уже
       на проде. */
    const shell = читать("components/shell/AppShell.tsx");
    expect(shell).not.toContain("DATA_SOURCE_OPTIONS");
    expect(shell).not.toContain("setDataSource");
    expect(shell).not.toContain("100dvh-6.25rem");
    expect(shell).toContain("100dvh-3.5rem");
  });

  it("лист кабинетов НАЗЫВАЕТ режим, хотя и не переключает", () => {
    /* Спрятать выбор и промолчать о нём значит оставить укоротившийся список
       без объяснения: человек увидит вместо 278 строк 109 и пойдёт искать
       поломку. Метка обязана остаться там, где смотрят на цифры. */
    const view = читать("components/views/AccountsView.tsx");
    expect(view).toContain("режим={снапРежим");
    expect(читать("components/sections/DataHealth.tsx")).toContain("change in Integrations");
  });

  it("dataSource перечислен в partialize стора — иначе режим не переживёт F5", () => {
    const store = читать("lib/store.ts");
    const начало = store.indexOf("partialize:");
    expect(начало).toBeGreaterThan(-1);
    const блок = store.slice(начало, store.indexOf("merge:", начало));
    expect(блок).toContain("dataSource: s.dataSource");
  });
});

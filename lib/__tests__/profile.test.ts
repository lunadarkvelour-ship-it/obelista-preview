/* Модель листа `/profile` (иссус #127).
 *
 * Что этот файл обязан удержать правдой:
 *
 *  1. Профиль НИКУДА не уезжает — сервера нет. Черновик лежит в браузере, и
 *     лист говорит это словами. Тест держит формулировку, а не только факт:
 *     «сохранено» здесь — видимая ложь.
 *  2. `not_wired` ≠ «не подключено». Строка про интеграцию, которой в
 *     продукте нет, не должна выглядеть как строка с кнопкой, которую просто
 *     не нажали.
 *  3. Ни одна дверь не ведёт в никуда: у двери либо есть страница на диске,
 *     либо явно нет ссылки и сказано почему (тот же приём, что в
 *     `leaves.test.ts`).
 *  4. Купон не выдаётся, пока некому связать приведённого с приводящим.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileHeader } from "@/components/views/ProfileView";
import {
  PROFILE_DOORS,
  PROFILE_DRAFT_KEY,
  PROFILE_DRAFT_NOTICE,
  PROFILE_FIELDS,
  REFERRAL_REWARD,
  REFERRAL_SERVER_READY,
  REFERRAL_TERMS,
  integrationRows,
  ктоВошёл,
  сессияДо,
  looksLikeEmail,
  looksLikeUrl,
  normalizeProfileValue,
  normalizeTelegram,
  normalizeUrl,
  profileFieldError,
  profileFilled,
  readProfileDraft,
  referralState,
  writeProfileDraft,
  type DraftStore,
  type ProfileValues,
} from "@/lib/profile";

const APP = path.resolve(__dirname, "../../app");

/** Хранилище-заглушка: обычный объект, а не изображённый браузер. */
function магазин(начальное: Record<string, string> = {}): DraftStore & { data: Record<string, string> } {
  const data = { ...начальное };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe("поля профиля — имя, соцсети, контакты, и ни одного платёжного", () => {
  it("id полей уникальны, у каждого есть подпись, подсказка и плейсхолдер", () => {
    const ids = PROFILE_FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(PROFILE_FIELDS.length);
    for (const f of PROFILE_FIELDS) {
      expect(f.label.trim().length).toBeGreaterThan(0);
      // Подсказка не украшение: поле без объяснения человек пропускает.
      expect(f.hint.trim().length).toBeGreaterThan(10);
      expect(f.placeholder.trim().length).toBeGreaterThan(0);
    }
  });

  it("названы ровно три вещи из задачи владельца: имя, контакты, соцсети", () => {
    const ids = PROFILE_FIELDS.map((f) => f.id);
    expect(ids).toContain("display_name");
    expect(ids).toContain("contact_email");
    expect(ids).toContain("telegram");
    expect(ids).toContain("facebook");
    expect(ids).toContain("instagram");
  });

  it("в профиле нет ни одного поля про деньги — они живут на /billing", () => {
    const плохие = /card|wallet|crypto|iban|payment|price|plan/i;
    for (const f of PROFILE_FIELDS) expect(f.id).not.toMatch(плохие);
  });
});

describe("проверка значений — придираемся только к форме записи", () => {
  it("пустое поле ошибкой не считается: обязательных полей в профиле нет", () => {
    for (const f of PROFILE_FIELDS) {
      expect(profileFieldError(f.kind, "")).toBeNull();
      expect(profileFieldError(f.kind, "   ")).toBeNull();
    }
  });

  it("телеграм нормализуется из любой формы, в которой его копируют", () => {
    expect(normalizeTelegram("obelista")).toBe("@obelista");
    expect(normalizeTelegram("@obelista")).toBe("@obelista");
    expect(normalizeTelegram("https://t.me/obelista")).toBe("@obelista");
    expect(normalizeTelegram("t.me/obelista")).toBe("@obelista");
    expect(normalizeTelegram("  ")).toBe("");
  });

  it("короткий и кривой телеграм отвергается, нормальный — нет", () => {
    expect(profileFieldError("telegram", "@ivanov")).toBeNull();
    // Телеграм не выдаёт хендлы короче пяти символов — и мы не выдумываем
    // своё правило поверх чужого.
    expect(profileFieldError("telegram", "@iv")).not.toBeNull();
    expect(profileFieldError("telegram", "@иван")).not.toBeNull();
    expect(profileFieldError("telegram", "https://t.me/obelista")).toBeNull();
  });

  it("почта: ловим только заведомо не адрес, живые адреса не трогаем", () => {
    expect(looksLikeEmail("a+tag@example.co.uk")).toBe(true);
    expect(looksLikeEmail("dawoodbloss@gmail.com")).toBe(true);
    expect(looksLikeEmail("нет собаки")).toBe(false);
    expect(looksLikeEmail("a@b")).toBe(false);
    expect(profileFieldError("email", "a@b.c")).toBeNull();
    expect(profileFieldError("email", "просто текст")).not.toBeNull();
  });

  it("ссылка без схемы дописывается, а не отвергается — иначе href уводит внутрь панели", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("")).toBe("");
    expect(looksLikeUrl("example.com")).toBe(true);
    expect(looksLikeUrl("просто слова")).toBe(false);
    // Главное следствие: нормализованная ссылка не может быть прочитана как
    // путь внутри панели.
    expect(normalizeProfileValue("url", "example.com").startsWith("/")).toBe(false);
  });

  it("имя длиннее 64 символов отвергается, обычное — нет", () => {
    expect(profileFieldError("text", "Иван")).toBeNull();
    expect(profileFieldError("text", "и".repeat(65))).not.toBeNull();
  });

  it("заполненность считает поля со значением, пробелы за значение не идут", () => {
    const v: ProfileValues = { display_name: "Иван", telegram: "@ivan", site: "   " };
    expect(profileFilled(v)).toBe(2);
    expect(profileFilled({})).toBe(0);
  });
});

describe("черновик — в браузере и только в браузере", () => {
  it("текст над формой говорит, что ничего не отправляется и лежит в этом браузере", () => {
    expect(PROFILE_DRAFT_NOTICE).toMatch(/nothing here is sent anywhere/i);
    expect(PROFILE_DRAFT_NOTICE).toMatch(/this browser only/i);
    // «Сохранено» без оговорки — ровно та ложь, которую этот текст закрывает.
    expect(PROFILE_DRAFT_NOTICE).not.toMatch(/\bsaved\b/i);
  });

  it("записанное читается обратно, пустые значения не хранятся", () => {
    const s = магазин();
    writeProfileDraft(s, { display_name: "Иван", telegram: "@ivan", site: "  " });
    expect(readProfileDraft(s)).toEqual({ display_name: "Иван", telegram: "@ivan" });
    expect(s.data[PROFILE_DRAFT_KEY]).toBeTruthy();
  });

  it("мусор в ключе не роняет лист — читается как пустой профиль", () => {
    expect(readProfileDraft(магазин({ [PROFILE_DRAFT_KEY]: "{не json" }))).toEqual({});
    expect(readProfileDraft(магазин({ [PROFILE_DRAFT_KEY]: "[1,2]" }))).toEqual({});
    expect(readProfileDraft(магазин({ [PROFILE_DRAFT_KEY]: '{"display_name":7}' }))).toEqual({});
  });

  it("чужих ключей из черновика не берём — только объявленные поля", () => {
    const s = магазин({ [PROFILE_DRAFT_KEY]: '{"display_name":"Иван","role":"admin"}' });
    expect(readProfileDraft(s)).toEqual({ display_name: "Иван" });
  });

  it("без хранилища (серверный рендер, приватный режим) читается пусто и не бросает", () => {
    expect(readProfileDraft(null)).toEqual({});
    expect(() => writeProfileDraft(null, { display_name: "Иван" })).not.toThrow();
  });

  it("хранилище, которое бросает, не роняет ни чтение, ни запись", () => {
    const злое: DraftStore = {
      getItem() {
        throw new Error("nope");
      },
      setItem() {
        throw new Error("nope");
      },
    };
    expect(readProfileDraft(злое)).toEqual({});
    expect(() => writeProfileDraft(злое, { display_name: "Иван" })).not.toThrow();
  });
});

describe("интеграции — актуальные, а не список из головы", () => {
  it("подключённые соцы считаются из живых фактов", () => {
    const rows = integrationRows({ socials: { connected: 3, total: 7 }, ws: 4 });
    const meta = rows.find((r) => r.id === "meta_profiles")!;
    expect(meta.status).toBe("connected");
    expect(meta.detail).toBe("3 of 7 connected");
    expect(meta.href).toBe("/socials");
  });

  it("ноль подключённых и упавший запрос — РАЗНЫЕ строки, а не одна", () => {
    const ноль = integrationRows({ socials: { connected: 0, total: 7 }, ws: 1 });
    const упало = integrationRows({ socials: null, ws: 1 });
    const a = ноль.find((r) => r.id === "meta_profiles")!.detail;
    const b = упало.find((r) => r.id === "meta_profiles")!.detail;
    expect(a).not.toBe(b);
    expect(b).toMatch(/could not ask/i);
  });

  it("не вошедший не получает выдуманный номер воркспейса", () => {
    const rows = integrationRows({ socials: null, ws: null });
    const ws = rows.find((r) => r.id === "workspace")!;
    expect(ws.status).toBe("none");
    expect(ws.detail).not.toMatch(/#\d/);
  });

  it("not_wired-интеграции никуда не ведут: ссылки нет, состояние отличается от «не подключено»", () => {
    const rows = integrationRows({ socials: { connected: 1, total: 1 }, ws: 1 });
    const нетВПродукте = rows.filter((r) => r.status === "not_wired");
    expect(нетВПродукте.length).toBeGreaterThan(0);
    for (const r of нетВПродукте) {
      expect(r.href).toBeNull();
      expect(r.detail).not.toMatch(/^not connected$/i);
    }
  });

  it("у каждой строки уникальный id и объяснение словами, а не названием протокола", () => {
    const rows = integrationRows({ socials: { connected: 1, total: 2 }, ws: 1 });
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.title.trim().length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(20);
      expect(r.detail.trim().length).toBeGreaterThan(0);
    }
  });

  it("каждая ссылка интеграции ведёт на существующий лист", () => {
    const rows = integrationRows({ socials: { connected: 1, total: 2 }, ws: 1 });
    for (const r of rows) {
      if (!r.href) continue;
      expect(existsSync(path.join(APP, r.href.replace(/^\//, ""), "page.tsx")), r.href).toBe(true);
    }
  });
});

describe("профиль не заводит второй список подключений", () => {
  it("трекеров и CRM в строках профиля нет — у них свой лист /integrations (#126)", () => {
    const rows = integrationRows({ socials: { connected: 1, total: 2 }, ws: 1 });
    const всё = rows.map((r) => r.id + " " + r.title).join(" ").toLowerCase();
    // Два ответа на один вопрос расходятся в первый же день: там знают про
    // каждого вендора «настроен / не отвечает / не настроен», здесь — нет.
    expect(всё).not.toMatch(/tracker/);
    expect(всё).not.toMatch(/\bcrm\b/);
  });

  it("но дорога туда есть — дверью, а не строкой-двойником", () => {
    const d = PROFILE_DOORS.find((x) => x.id === "integrations");
    expect(d?.href).toBe("/integrations");
  });
});

describe("двери — в /billing и /settings, и ни одной в никуда", () => {
  it("обе двери из задачи владельца на месте", () => {
    const ids = PROFILE_DOORS.map((d) => d.id);
    expect(ids).toContain("billing");
    expect(ids).toContain("settings");
  });

  it("у двери со ссылкой страница есть на диске", () => {
    for (const d of PROFILE_DOORS) {
      if (!d.href) continue;
      expect(existsSync(path.join(APP, d.href.replace(/^\//, ""), "page.tsx")), d.href).toBe(true);
    }
  });

  it("дверь без страницы не имеет ссылки и объясняет почему", () => {
    for (const d of PROFILE_DOORS) {
      if (d.href) continue;
      expect((d.missingWhy || "").length).toBeGreaterThan(20);
    }
  });

  it("/settings сегодня именно такая дверь: листа нет — ссылки нет", () => {
    const s = PROFILE_DOORS.find((d) => d.id === "settings")!;
    const есть = existsSync(path.join(APP, "settings", "page.tsx"));
    // Если лист однажды появится, этот тест заставит открыть дверь, а не
    // оставить объяснение про несуществующую страницу.
    expect(s.href === null).toBe(!есть);
  });
});

describe("реферальный купон — условия видны до создания, а создать пока нечем", () => {
  it("три условия владельца названы: три соца, четырнадцать дней, антифрод", () => {
    expect(REFERRAL_TERMS).toHaveLength(3);
    expect(REFERRAL_TERMS.join(" ")).toMatch(/three social/i);
    expect(REFERRAL_TERMS.join(" ")).toMatch(/fourteen days/i);
    expect(REFERRAL_TERMS.join(" ")).toMatch(/anti-fraud/i);
  });

  it("награда названа одной строкой и ведёт в телеграм", () => {
    expect(REFERRAL_REWARD).toMatch(/20%/);
    // Не 30% и не «от CPA». Владелец поправил 15.08 в комментарии к #129:
    // «20%, а не 30%, и считается от цены первой оплаты подписки приведённого».
    // Воркер прочитал ТЕЛО иссуса, комментарий не прочитал — и отменённая формула
    // уехала на прод, где обещала людям чужие деньги, запертая этим самым тестом.
    expect(REFERRAL_REWARD).toMatch(/first subscription/);
    expect(REFERRAL_REWARD).not.toMatch(/CPA/);
    expect(REFERRAL_REWARD).toMatch(/@obelista/);
  });

  it("сервера купонов сегодня нет — купон не создаётся и сказано почему", () => {
    expect(REFERRAL_SERVER_READY).toBe(false);
    const st = referralState(REFERRAL_SERVER_READY);
    expect(st.canIssue).toBe(false);
    expect(st.why).toMatch(/endpoint does not exist/i);
    // Не «скоро будет»: объяснение должно называть, ЧЕГО нет.
    expect(st.why.length).toBeGreaterThan(60);
  });

  it("когда сервер появится, состояние меняется само — без правки листа", () => {
    expect(referralState(true).canIssue).toBe(true);
  });
});


/* ── кто вошёл: четыре разных ответа ──────────────────────────────────────
 *
 * НАЙДЕНО РЕВИЗИЕЙ «что бэкенд отдаёт и нигде не показано» — тем же способом,
 * которым однажды нашлась пропажа ключа приёма воронки: ручка отдавала
 * настоящий ключ, а `grep` по панели давал ноль совпадений.
 */

/** Корень репозитория: `panel/lib/__tests__` → вверх на три. */
const КОРЕНЬ = path.resolve(__dirname, "..", "..", "..");

describe("«входа тут нет» — это ОТВЕТ сервера, а не отказ", () => {
  it("сервер в этом случае отвечает успехом без человека — читаем ИСХОДНИК гейта", () => {
    /* Не фикстура и не память: форма ответа берётся из `core/authweb.py`.
       Разъедется она — покраснеет здесь, а не на экране у человека, которому
       панель будет вечно показывать «спрашиваем сервер». */
    const src = readFileSync(path.join(КОРЕНЬ, "core/authweb.py"), "utf8");
    const с = src.indexOf("if not гейт_включён()");
    expect(с, "в core/authweb.py не нашлась ветка выключенного гейта").toBeGreaterThan(0);
    /* Режем по КОНЕЦ ответа этой ветки, а не «первые сколько-то символов»:
       комментарий внутри неё длиннее самого кода, и проверка по фиксированной
       длине измеряла бы длину комментария. */
    const ветка = src.slice(с, src.indexOf("})", с) + 2);
    expect(ветка).toContain('"ok": True');
    expect(ветка).toContain('"user": None');
    expect(ветка).toContain('"gate": False');
    // И объяснение приезжает вместе с признаком: без него панели нечего сказать.
    expect(ветка).toContain('"note"');
  });

  it("установка без входа больше не показывает вечное «спрашиваем сервер»", () => {
    const w = ктоВошёл({ ok: false, gate: false, note: "вход НЕ спрашивается: …" });
    expect(w.state).toBe("no_gate");
    expect(w.title.toLowerCase()).not.toContain("asking");
    expect(w.detail).toContain("вход НЕ спрашивается");
  });

  it("объяснения нет — говорим своими словами, но не молчим", () => {
    expect(ктоВошёл({ ok: false, gate: false }).detail.length).toBeGreaterThan(30);
  });

  it("демон старше контракта — это «не пустили», а не «входа нет»", () => {
    /* Поля `gate` в ответе нет. Сказать по этому молчанию «защиты не
       существует» значит успокоить человека тем, чего мы не знаем. */
    expect(ктоВошёл({ ok: false }).state).toBe("signed_out");
  });

  it("не спросили и не смогли спросить — разные состояния", () => {
    expect(ктоВошёл(null).state).toBe("asking");
    expect(ктоВошёл(null, true).state).toBe("unreachable");
    // Первое пройдёт само, второе лечится поднятием демона — и текст разный.
    expect(ктоВошёл(null).detail).not.toBe(ктоВошёл(null, true).detail);
  });

  it("вошёл — имя, а если имени нет, почта; и почта второй строкой", () => {
    const с_именем = ктоВошёл({ ok: true, user: { email: "a@b.c", name: "Иван", ws: 3 } });
    expect(с_именем.state).toBe("signed_in");
    expect(с_именем.title).toBe("Иван");
    expect(с_именем.detail).toBe("a@b.c");
    expect(ктоВошёл({ ok: true, user: { email: "a@b.c", name: "", ws: 3 } }).title).toBe("a@b.c");
  });

  it("у всех четырёх состояний разные подписи — иначе они сливаются на экране", () => {
    const все = [
      ктоВошёл(null),
      ктоВошёл(null, true),
      ктоВошёл({ ok: false }),
      ктоВошёл({ ok: false, gate: false }),
    ];
    expect(new Set(все.map((w) => w.title + w.detail)).size).toBe(4);
  });
});

describe("срок сессии показывается, а не теряется", () => {
  const СЕЙЧАС = Date.parse("2026-08-15T12:00:00Z");

  it("дата есть — сказано до какого дня и сколько осталось", () => {
    const t = сессияДо("2026-09-14T12:00:00Z", СЕЙЧАС)!;
    expect(t).toContain("2026-09-14");
    expect(t).toContain("30 days");
  });

  it("сказано, что срок СКОЛЬЗЯЩИЙ — иначе дата читается как обратный отсчёт", () => {
    /* Гейт продлевает сессию при каждом обращении панели
       (`core/auth._продлить`), поэтому «до 14 сентября» у работающего человека
       значит «тридцать дней от последнего захода», а не приближающийся конец. */
    expect(сессияДо("2026-09-14T12:00:00Z", СЕЙЧАС)).toMatch(/clock restarts/i);
  });

  it("срок уже прошёл — это не прячется", () => {
    const t = сессияДо("2026-08-01T12:00:00Z", СЕЙЧАС)!;
    expect(t).toMatch(/expired/i);
    expect(t).toContain("2026-08-01");
  });

  it("даты нет или она мусорная — молчим, а не рисуем «до Invalid Date»", () => {
    expect(сессияДо(null)).toBeNull();
    expect(сессияДо("")).toBeNull();
    expect(сессияДо("позавчера")).toBeNull();
  });
});

describe("НА ЭКРАНЕ, а не только в модели", () => {
  /* Ключ приёма воронки был потерян ровно между этими двумя местами: ручка
     отдавала, модель знала, а экрана не было ни одного. Поэтому обе находки
     проверяются отрисовкой. */
  const рисуем = (who: ReturnType<typeof ктоВошёл>, сессия: string | null = null) =>
    renderToStaticMarkup(createElement(ProfileHeader, { who, me: null, сессия }));

  it("на установке без входа экран говорит это словами сервера", () => {
    const html = рисуем(ктоВошёл({ ok: false, gate: false, note: "вход НЕ спрашивается: локальная база" }));
    expect(html).toContain("вход НЕ спрашивается");
    expect(html).not.toMatch(/Asking the server/i);
  });

  it("срок сессии виден человеку, а не только разбирается в lib", () => {
    const html = рисуем(
      ктоВошёл({ ok: true, user: { email: "a@b.c", name: "Иван", ws: 1 } }),
      сессияДо("2026-09-14T12:00:00Z", Date.parse("2026-08-15T12:00:00Z")),
    );
    expect(html).toContain("2026-09-14");
    expect(html).toMatch(/clock restarts/i);
  });

  it("положительный контроль: пока ответа нет — многоточие на месте", () => {
    /* Без него сторож выше позеленел бы и в тот день, когда шапка перестала бы
       показывать что-либо вообще. */
    expect(рисуем(ктоВошёл(null))).toMatch(/Asking the server/i);
  });
});

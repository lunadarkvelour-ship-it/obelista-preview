/* Снапшот принадлежит арендатору, а не «всякому вошедшему» (XR-50).
 *
 *  ЧТО ЭТИ ТЕСТЫ ОХРАНЯЮТ. Роут `/api/snapshot` держал пуш в двух переменных на
 *  весь процесс и спрашивал у демона ровно «вошёл ли ты» — булевым значением.
 *  Шесть живых арендаторов на проде получали ОДИН снапшот: состав кабинетов,
 *  `act_id`, статусы и причины банов, суммы, хвосты карт, БМ и пиксели того,
 *  кто запушил последним. И переписать его мог тоже любой вошедший.
 *
 *  ПОЧЕМУ ЭТО ПРОЖИЛО РЕВЬЮ. В шапке роута двадцать четыре строки объясняли
 *  защиту словами — и слова были ПРАВДОЙ: «отдаётся только тому, кто вошёл»
 *  исполнялось буквально. Разошлись не слово и код, а два разных вопроса:
 *  «кто вошёл» и «чей это снапшот». Комментарий такого не ловит никогда.
 *
 *  Поэтому граница здесь проведена не словом, а двумя арендаторами: один
 *  пушит, другой читает, и в его ответе не должно быть ни байта первого.
 *  Это тот самый тест, которого не было, — и он же ответ на вопрос «а как
 *  узнать, что оно не разъедется снова».
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WS_A = 7;
const WS_B = 9;

/** Приметы, по которым утечка узнаётся в СЫРОМ теле ответа, а не в разобранном:
 *  чужой `act_id` может уехать в любом поле, включая то, которого мы не ждём. */
const МЕТКА_A = "act_1111111111";
const МЕТКА_B = "act_2222222222";
const МЕТКА_ФАЙЛА = "act_3333333333";
const МЕТКА_URL = "act_4444444444";

const СНАПШОТ_A = {
  profiles: { "prof-a": { name: "парк A", accounts: [{ act_id: МЕТКА_A }] } },
};
const СНАПШОТ_B = {
  profiles: { "prof-b": { name: "парк B", accounts: [{ act_id: МЕТКА_B }] } },
};

const АДРЕС = "https://app.obelista.com/api/snapshot";
const ДЕМОН = "http://collector:8791";
const URL_СНАПШОТА = "http://snapshot.local/ui_snapshot.json";

/** Подмена чтения файла: сам роут ходит в `data/ui_snapshot.json`, которого в
 *  прогоне нет. Флаг живёт в `vi.hoisted`, потому что фабрика `vi.mock`
 *  поднимается наверх файла раньше обычных объявлений. */
const состояние = vi.hoisted(() => ({ файл: null as string | null }));

vi.mock("node:fs", async (оригинал) => {
  const настоящий = await оригинал<typeof import("node:fs")>();
  return {
    ...настоящий,
    default: настоящий,
    promises: {
      ...настоящий.promises,
      readFile: async (путь: string, кодировка?: unknown) => {
        if (состояние.файл !== null) return состояние.файл;
        return настоящий.promises.readFile(путь, кодировка as never);
      },
    },
  };
});

type Роут = {
  GET: (req: Request) => Promise<Response>;
  POST: (req: Request) => Promise<Response>;
};

const ПЕРЕМЕННЫЕ = [
  "ANALYTICS_API",
  "NEXT_PUBLIC_ANALYTICS_API",
  "SNAPSHOT_TOKEN",
  "SNAPSHOT_WS",
  "SNAPSHOT_URL",
  "SNAPSHOT_DIR",
] as const;

function окружение(env: Record<string, string | undefined>) {
  for (const имя of ПЕРЕМЕННЫЕ) delete process.env[имя];
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) process.env[k] = v;
  }
}

/** Каталоги пуша на диске, заведённые прогоном, — чтобы снести их после.
 *
 *  Каталог свой у КАЖДОГО случая, если он не задан явно: пуш теперь переживает
 *  перезапуск процесса, и общий каталог протащил бы снапшот одного случая в
 *  другой — тест повторял бы ровно ту утечку, которую охраняет. */
const каталоги: string[] = [];

function временныйКаталог(): string {
  const dir = mkdtempSync(join(tmpdir(), "snapshot-route-"));
  каталоги.push(dir);
  return dir;
}

/** Модуль берётся ЗАНОВО: кеш пуша живёт в модуле, и без сброса случаи
 *  протекали бы друг в друга — то есть тест повторял бы саму поломку.
 *
 *  `SNAPSHOT_DIR` подставляется всегда: без него роут писал бы в `../data/
 *  snapshots` рабочего дерева, то есть прогон тестов гадил бы в репозиторий и
 *  зависел бы от того, что осталось от прошлого прогона. */
async function роут(env: Record<string, string | undefined> = {}): Promise<Роут> {
  vi.resetModules();
  окружение({ ANALYTICS_API: ДЕМОН, SNAPSHOT_DIR: временныйКаталог(), ...env });
  return (await import("@/app/api/snapshot/route")) as unknown as Роут;
}

/** Демон в одном экземпляре: `/auth/me` отвечает по КУКЕ, как настоящий. */
function демон() {
  const кто: Record<string, unknown> = {
    A: { ok: true, gate: true, user: { id: 1, email: "a@x.io", ws: WS_A } },
    B: { ok: true, gate: true, user: { id: 2, email: "b@x.io", ws: WS_B } },
    // Так `/auth/me` отвечает экрану входа: код 200, а человека нет.
    none: { ok: true, gate: false, user: null },
    ws0: { ok: true, gate: true, user: { id: 3, email: "c@x.io", ws: 0 } },
    "ws-string": { ok: true, gate: true, user: { id: 4, email: "d@x.io", ws: "7" } },
    "no-ws": { ok: true, gate: true, user: { id: 5, email: "e@x.io" } },
  };
  const мок = vi.fn(async (url: unknown, init?: { headers?: Record<string, string> }) => {
    const адрес = String(url);
    if (адрес.endsWith("/auth/me")) {
      const кука = init?.headers?.cookie || "";
      const имя = кука.replace(/^s=/, "");
      if (имя === "boom") throw new Error("ECONNREFUSED");
      const тело = кто[имя];
      if (!тело) return new Response(null, { status: 401 });
      return new Response(JSON.stringify(тело), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (адрес === URL_СНАПШОТА) {
      return new Response(
        JSON.stringify({ profiles: { url: { accounts: [{ act_id: МЕТКА_URL }] } } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    throw new Error(`неожиданный адрес в тесте: ${адрес}`);
  });
  vi.stubGlobal("fetch", мок);
  return мок;
}

const ГЕТ = (кука?: string) =>
  new Request(АДРЕС, кука ? { headers: { cookie: `s=${кука}` } } : undefined);

const ПОСТ = (
  тело: unknown,
  опции: { кука?: string; bearer?: string; ещё?: Record<string, string> } = {},
) => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(опции.ещё || {}),
  };
  if (опции.кука) headers.cookie = `s=${опции.кука}`;
  if (опции.bearer) headers.authorization = `Bearer ${опции.bearer}`;
  return new Request(АДРЕС, { method: "POST", headers, body: JSON.stringify(тело) });
};

afterEach(() => {
  состояние.файл = null;
  окружение({});
  vi.unstubAllGlobals();
  for (const dir of каталоги.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("два арендатора: снапшот одного не виден другому", () => {
  it("A запушил — A и читает, целиком и с отметкой времени", async () => {
    демон();
    const { GET, POST } = await роут();
    const пуш = await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { кука: "A" }));
    expect(пуш.status).toBe(200);
    const { pushedAt } = (await пуш.json()) as { pushedAt: string };

    const res = await GET(ГЕТ("A"));
    expect(res.status).toBe(200);
    const тело = (await res.json()) as { snapshot: unknown; source: string; pushedAt: string };
    expect(тело.source).toBe("push");
    expect(тело.pushedAt).toBe(pushedAt);
    expect(тело.snapshot).toEqual(СНАПШОТ_A);
  });

  it("B не получает НИ БАЙТА снапшота A — это и есть XR-50", async () => {
    демон();
    const { GET, POST } = await роут();
    await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { кука: "A" }));

    const res = await GET(ГЕТ("B"));
    expect(res.status).toBe(200);
    const сырое = await res.text();
    // Ищем в СЫРОМ теле: чужой act_id мог уехать в поле, которого мы не ждём.
    expect(сырое).not.toContain(МЕТКА_A);
    expect(сырое).not.toContain("парк A");
    expect(JSON.parse(сырое)).toEqual({ snapshot: null, source: "none" });
  });

  it("B не может переписать то, что видит A", async () => {
    демон();
    const { GET, POST } = await роут();
    await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { кука: "A" }));
    expect((await POST(ПОСТ({ snapshot: СНАПШОТ_B }, { кука: "B" }))).status).toBe(200);

    const уA = await (await GET(ГЕТ("A"))).text();
    expect(уA).toContain(МЕТКА_A);
    expect(уA).not.toContain(МЕТКА_B);
    const уB = await (await GET(ГЕТ("B"))).json();
    expect(уB).toMatchObject({ source: "push", snapshot: СНАПШОТ_B });
  });

  it("арендатор из ТЕЛА и из ЗАГОЛОВКА не перебивает сессию", async () => {
    // Иначе починка косметическая: сосед пишет в чужое пространство одной
    // строкой JSON, а роут при этом «ключуется арендатором».
    демон();
    const { GET, POST } = await роут();
    await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { кука: "A" }));
    await POST(ПОСТ(
      { ws: WS_A, workspace: WS_A, snapshot: СНАПШОТ_B },
      { кука: "B", ещё: { "x-snapshot-ws": String(WS_A) } },
    ));

    const уA = await (await GET(ГЕТ("A"))).text();
    expect(уA).toContain(МЕТКА_A);
    expect(уA).not.toContain(МЕТКА_B);
  });
});

describe("не знаем, кто это, — не пускаем", () => {
  const отказ = async (кука?: string, env: Record<string, string | undefined> = {}) => {
    демон();
    const { GET, POST } = await роут(env);
    return [
      (await GET(ГЕТ(кука))).status,
      (await POST(ПОСТ({ snapshot: СНАПШОТ_B }, кука ? { кука } : {}))).status,
    ];
  };

  it("200 без человека (`user: null`) — это НЕ вход", async () => {
    // Так `/auth/me` отвечает экрану входа. Старая проверка читала только код.
    expect(await отказ("none")).toEqual([401, 401]);
  });

  it("сессия без `ws`, с нулём и со строкой вместо числа — тоже отказ", async () => {
    expect(await отказ("no-ws")).toEqual([401, 401]);
    expect(await отказ("ws0")).toEqual([401, 401]);
    expect(await отказ("ws-string")).toEqual([401, 401]);
  });

  it("демон не ответил — отказ, а не проход", async () => {
    expect(await отказ("boom")).toEqual([401, 401]);
  });

  it("куки нет вовсе — отказ, и демона не тревожим", async () => {
    const мок = демон();
    const { GET, POST } = await роут();
    expect((await GET(ГЕТ())).status).toBe(401);
    expect((await POST(ПОСТ({ snapshot: СНАПШОТ_B }))).status).toBe(401);
    expect(мок).not.toHaveBeenCalled();
  });

  it("адрес демона не задан — отказ", async () => {
    демон();
    const { GET, POST } = await роут({ ANALYTICS_API: undefined });
    expect((await GET(ГЕТ("A"))).status).toBe(401);
    expect((await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { кука: "A" }))).status).toBe(401);
  });

  it("неизвестная кука (демон ответил 401) — отказ", async () => {
    expect(await отказ("neznakomaya")).toEqual([401, 401]);
  });
});

describe("пуш токеном привязан к арендатору сервером", () => {
  it("токен БЕЗ `SNAPSHOT_WS` не пускает вовсе", async () => {
    // Пропуск, которым пишут кому угодно, — та же дыра в профиль.
    демон();
    const { POST } = await роут({ SNAPSHOT_TOKEN: "tok-a1b2c3d4" });
    const res = await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { bearer: "tok-a1b2c3d4" }));
    expect(res.status).toBe(401);
  });

  it("с `SNAPSHOT_WS` пуш ложится ровно в тот арендатор", async () => {
    демон();
    const { GET, POST } = await роут({
      SNAPSHOT_TOKEN: "tok-a1b2c3d4", SNAPSHOT_WS: String(WS_A),
    });
    expect((await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { bearer: "tok-a1b2c3d4" }))).status).toBe(200);

    expect(await (await GET(ГЕТ("A"))).text()).toContain(МЕТКА_A);
    expect(await (await GET(ГЕТ("B"))).text()).not.toContain(МЕТКА_A);
  });

  it("чужой токен не пускает, какой бы длины он ни был", async () => {
    демон();
    const { POST } = await роут({
      SNAPSHOT_TOKEN: "tok-a1b2c3d4", SNAPSHOT_WS: String(WS_A),
    });
    for (const плохой of ["tok-a1b2c3d", "tok-a1b2c3d4!", "sovsem-drugoe", ""]) {
      const req = new Request(АДРЕС, {
        method: "POST",
        headers: { authorization: `Bearer ${плохой}` },
        body: JSON.stringify({ snapshot: СНАПШОТ_A }),
      });
      expect((await POST(req)).status).toBe(401);
    }
  });

  it("мусор в `SNAPSHOT_WS` не превращается в арендатора", async () => {
    for (const мусор of ["0", "-1", "нет", "7.5", ""]) {
      демон();
      const { POST } = await роут({ SNAPSHOT_TOKEN: "tok-a1b2c3d4", SNAPSHOT_WS: мусор });
      expect((await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { bearer: "tok-a1b2c3d4" }))).status)
        .toBe(401);
      vi.unstubAllGlobals();
    }
  });

  it("сессия сильнее отсутствующего токена: человек пушит своё", async () => {
    демон();
    const { GET, POST } = await роут({ SNAPSHOT_TOKEN: "tok-a1b2c3d4", SNAPSHOT_WS: String(WS_A) });
    await POST(ПОСТ({ snapshot: СНАПШОТ_B }, { кука: "B" }));
    expect(await (await GET(ГЕТ("B"))).text()).toContain(МЕТКА_B);
    expect(await (await GET(ГЕТ("A"))).text()).not.toContain(МЕТКА_B);
  });
});

describe("запасные источники принадлежат ОДНОМУ арендатору", () => {
  it("`SNAPSHOT_URL` отдаётся только привязанному, остальным — пусто", async () => {
    демон();
    const { GET } = await роут({
      SNAPSHOT_URL: URL_СНАПШОТА, SNAPSHOT_WS: String(WS_A),
    });
    const уA = await (await GET(ГЕТ("A"))).json();
    expect(уA).toMatchObject({ source: "url" });
    expect(JSON.stringify(уA)).toContain(МЕТКА_URL);

    const уB = await (await GET(ГЕТ("B"))).text();
    expect(уB).not.toContain(МЕТКА_URL);
    expect(JSON.parse(уB)).toEqual({ snapshot: null, source: "none" });
  });

  it("без `SNAPSHOT_WS` URL не отдаётся НИКОМУ", async () => {
    демон();
    const { GET } = await роут({ SNAPSHOT_URL: URL_СНАПШОТА });
    for (const кука of ["A", "B"]) {
      expect(await (await GET(ГЕТ(кука))).text()).not.toContain(МЕТКА_URL);
    }
  });

  it("файл `data/ui_snapshot.json` — тоже только привязанному", async () => {
    состояние.файл = JSON.stringify({
      profiles: { файл: { accounts: [{ act_id: МЕТКА_ФАЙЛА }] } },
    });
    демон();
    const { GET } = await роут({ SNAPSHOT_WS: String(WS_A) });
    const уA = await (await GET(ГЕТ("A"))).json();
    expect(уA).toMatchObject({ source: "file" });
    expect(JSON.stringify(уA)).toContain(МЕТКА_ФАЙЛА);

    const уB = await (await GET(ГЕТ("B"))).text();
    expect(уB).not.toContain(МЕТКА_ФАЙЛА);
    expect(JSON.parse(уB)).toEqual({ snapshot: null, source: "none" });
  });

  it("без `SNAPSHOT_WS` файл не читается вовсе", async () => {
    состояние.файл = JSON.stringify({
      profiles: { файл: { accounts: [{ act_id: МЕТКА_ФАЙЛА }] } },
    });
    демон();
    const { GET } = await роут();
    for (const кука of ["A", "B"]) {
      expect(await (await GET(ГЕТ(кука))).text()).not.toContain(МЕТКА_ФАЙЛА);
    }
  });

  it("свой пуш сильнее запасных источников", async () => {
    состояние.файл = JSON.stringify({ profiles: { файл: {} } });
    демон();
    const { GET, POST } = await роут({
      SNAPSHOT_URL: URL_СНАПШОТА, SNAPSHOT_WS: String(WS_A),
    });
    await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { кука: "A" }));
    expect(await (await GET(ГЕТ("A"))).json()).toMatchObject({ source: "push" });
  });
});

describe("мелочи, на которых роут ломался бы молча", () => {
  it("тело без обёртки `snapshot` кладётся как есть", async () => {
    демон();
    const { GET, POST } = await роут();
    await POST(ПОСТ(СНАПШОТ_A, { кука: "A" }));
    expect(await (await GET(ГЕТ("A"))).json()).toMatchObject({ snapshot: СНАПШОТ_A });
  });

  it("битый JSON — 400, а не проглатывание", async () => {
    демон();
    const { POST } = await роут();
    const req = new Request(АДРЕС, {
      method: "POST",
      headers: { cookie: "s=A", "content-type": "application/json" },
      body: "{не json",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("кеш не растёт без предела: старейший арендатор вытесняется", async () => {
    // Ключ приходит снаружи, а снапшот весит мегабайты: без потолка процесс
    // панели растёт до конца памяти.
    const мок = vi.fn(async (url: unknown, init?: { headers?: Record<string, string> }) => {
      const ws = Number(String(init?.headers?.cookie || "").replace(/^s=/, ""));
      if (!String(url).endsWith("/auth/me")) throw new Error("не тот адрес");
      return new Response(JSON.stringify({ ok: true, user: { ws } }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", мок);
    const { GET, POST } = await роут();
    for (let ws = 1; ws <= 70; ws++) {
      await POST(ПОСТ({ snapshot: { мой: ws } }, { кука: String(ws) }));
    }
    // Последний на месте в памяти; первый из памяти вытеснен, но с диска
    // читается — потолок бережёт ОПЕРАТИВНУЮ память, а не выбрасывает парк.
    expect(await (await GET(ГЕТ("70"))).json())
      .toMatchObject({ source: "push", snapshot: { мой: 70 } });
    expect(await (await GET(ГЕТ("1"))).json())
      .toMatchObject({ source: "push", snapshot: { мой: 1 } });
  });
});

/* ── ПУШ ПЕРЕЖИВАЕТ ПЕРЕЗАПУСК ПАНЕЛИ ─────────────────────────────────────
 *
 * Пока снапшот лежал только в памяти процесса, каждая выкладка молча стирала
 * парк арендатора, и человек видел это как «панель перестала показывать
 * пиксели»: `/api/snapshot` отвечал `snapshot: null`, лист кабинетов рисовал
 * прочерк в колонке пикселя, а каждая строка группы — «кабинета нет в
 * снапшоте». Ни ошибки, ни записи в логе.
 *
 * Замер 18.08.2026: снапшот мака собран и запушен в 07:02 UTC, панель
 * перезапущена выкладкой в 07:27 — и с этой минуты снапшота не было ни у кого.
 *
 * Перезапуск здесь — это ВТОРОЙ `роут()` с тем же каталогом: `vi.resetModules`
 * заново поднимает модуль, то есть память пуша пуста ровно как у свежего
 * процесса. */
describe("пуш переживает перезапуск процесса", () => {
  it("после перезапуска A читает свой снапшот, а B — по-прежнему ничего", async () => {
    const dir = временныйКаталог();
    демон();
    const первый = await роут({ SNAPSHOT_DIR: dir });
    await первый.POST(ПОСТ({ snapshot: СНАПШОТ_A }, { кука: "A" }));

    демон();
    const второй = await роут({ SNAPSHOT_DIR: dir });   // новый процесс, память пуста
    const уA = await (await второй.GET(ГЕТ("A"))).json();
    expect(уA).toMatchObject({ source: "push", snapshot: СНАПШОТ_A });

    const уB = await (await второй.GET(ГЕТ("B"))).text();
    expect(уB).not.toContain(МЕТКА_A);
    expect(JSON.parse(уB)).toEqual({ snapshot: null, source: "none" });
  });

  it("свежий пуш перекрывает лежащий на диске", async () => {
    const dir = временныйКаталог();
    демон();
    const первый = await роут({ SNAPSHOT_DIR: dir });
    await первый.POST(ПОСТ({ snapshot: СНАПШОТ_A }, { кука: "A" }));

    демон();
    const второй = await роут({ SNAPSHOT_DIR: dir });
    await второй.POST(ПОСТ({ snapshot: { profiles: { "prof-a": { new: true } } } }, { кука: "A" }));

    демон();
    const третий = await роут({ SNAPSHOT_DIR: dir });
    const тело = await (await третий.GET(ГЕТ("A"))).text();
    expect(тело).not.toContain(МЕТКА_A);
    expect(JSON.parse(тело)).toMatchObject({ source: "push", snapshot: { profiles: { "prof-a": { new: true } } } });
  });

  it("каталога нет и завести нельзя — приём снапшота НЕ падает", async () => {
    // Тома может не быть вовсе (локальный запуск, только чтение). Пуш обязан
    // остаться рабочим в памяти: отказ приёма был бы хуже, чем потеря на
    // перезапуске.
    //
    // Непригодный путь делаем ФАЙЛОМ, а не системным каталогом: `mkdir` внутри
    // файла — это ENOTDIR на любой машине и мгновенно, а «/proc/...» ведёт себя
    // по-разному под root в контейнере (в CI шаг встал в таймаут).
    const занято = join(временныйКаталог(), "eto-fajl");
    writeFileSync(занято, "не каталог");
    демон();
    const { GET, POST } = await роут({ SNAPSHOT_DIR: join(занято, "snapshots") });
    expect((await POST(ПОСТ({ snapshot: СНАПШОТ_A }, { кука: "A" }))).status).toBe(200);
    expect(await (await GET(ГЕТ("A"))).json()).toMatchObject({ source: "push", snapshot: СНАПШОТ_A });
  });
});

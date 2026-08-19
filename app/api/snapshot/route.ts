/* Снапшот отдаётся тому, ЧЕЙ ОН, а не всякому вошедшему (XR-50).
 *
 * ЧТО ЗДЕСЬ БЫЛО СЛОМАНО. Проверка отвечала на вопрос «вошёл ли этот» —
 * булевым значением. А ответ роута зависит от другого вопроса: «ЧЕЙ снапшот
 * ему показать». Кеш при этом лежал в двух переменных на весь процесс, без
 * отметки арендатора: любой вошедший получал последнее, что запушил любой
 * другой, и мог это последнее переписать. На проде в тот день было шесть живых
 * арендаторов, то есть пять чужих читателей состава кабинетов, карт и БМ
 * владельца.
 *
 * Порода та же, что у `registration_open` (#143) и у `/collector` (#148):
 * граница была проведена СЛОВОМ в комментарии, а слово не умеет стареть вместе
 * с кодом. Поэтому здесь она проведена значением — `ws` из `/auth/me` — и
 * охраняется не этим абзацем, а `panel/lib/__tests__/snapshot-route.test.ts`:
 * два арендатора, пуш одним, чтение другим.
 *
 * ПРОВЕРЯЕМ НЕ САМИ — СПРАШИВАЕМ ДЕМОНА. Роут не разбирает куку и не знает, как
 * устроена сессия: он пересылает входящую куку на `/auth/me` и берёт оттуда
 * `user.ws`. Своя проверка кук в панели была бы вторым словарём про доступ:
 * разъедутся они молча и ровно тогда, когда кто-нибудь поменяет срок жизни
 * сессии. Источник правды один, панель у него спрашивает.
 *
 * АДРЕС — ВНУТРЕННИЙ. `ANALYTICS_API` (в облаке `http://collector:8891`), а не
 * публичный: публичный стоит за basic auth Caddy, и оттуда приедет его 401 вместо
 * ответа демона. Это ровно та же ошибка, что уже поймана в обратном пути согласия
 * Меты (#60), и второй раз наступать не будем.
 *
 * КУКУ ПЕРЕСЫЛАЕМ ЯВНО: серверный `fetch` не таскает куки сам, и без этой строки
 * проверка всегда отвечала бы «не вошёл» — то есть выглядела бы работающей.
 *
 * НЕ СМОГЛИ УЗНАТЬ, КТО ЭТО — НЕ ПУСКАЕМ. Демон не ответил, адрес не задан,
 * `/auth/me` вернул 200 без `user` (так он отвечает экрану входа), сеть легла:
 * любой из этих случаев даёт 401, а не проход. «Не знаю, кто ты» и «свой» — не
 * одно и то же.
 *
 * `SNAPSHOT_TOKEN` БЕЗ `SNAPSHOT_WS` НЕ РАБОТАЕТ ВОВСЕ. Токен без арендатора —
 * это пропуск, которым пишут КОМУ УГОДНО: та же дыра, только в профиль. Кому
 * именно принадлежит пуш локального генератора, решает сервер своей
 * переменной `SNAPSHOT_WS`, а не тело запроса и не заголовок — иначе владелец
 * пропуска сам себе выбирал бы жертву. Той же переменной привязаны и запасные
 * источники (`SNAPSHOT_URL`, `data/ui_snapshot.json`): файл на диске сервера
 * принадлежит одному арендатору, и отдавать его всем — та же утечка другим
 * путём.
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";

export const dynamic = "force-dynamic";

/** Пустой ответ, без тела: причина отказа посторонним не сообщается, а свой
 *  разберётся по коду — на 401 панель уводит на вход (`lib/session`). */
const DENIED = new NextResponse(null, { status: 401 });

function daemonBase(): string | null {
  const raw = process.env.ANALYTICS_API || process.env.NEXT_PUBLIC_ANALYTICS_API;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    /* Путь сохраняем: задокументированное значение бывает вида
       `https://домен/api/analytics`, и `origin` срезал бы его молча. */
    return (u.origin + u.pathname).replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Арендатор того, кто стучится, или `null`. Единственный источник — демон.
 *
 *  Отдаём НОМЕР, а не «да/нет»: булев ответ на вопрос «вошёл ли» и был той
 *  самой утечкой — он не различает шестерых. */
async function сессияWs(req: NextRequest): Promise<number | null> {
  const base = daemonBase();
  const cookie = req.headers.get("cookie");
  /* Куки нет вовсе — спрашивать не о чем, и лишний поход к демону не нужен. */
  if (!base || !cookie) return null;
  try {
    const r = await fetch(base + "/auth/me", {
      headers: { cookie },
      cache: "no-store",
    });
    if (r.status !== 200) return null;
    /* 200 здесь НЕ значит «вошёл»: `/auth/me` отвечает двумястами и экрану
       входа — `{ok:true, user:null, gate:false}`. Пускает только `user.ws`. */
    const тело = (await r.json()) as { user?: { ws?: unknown } | null };
    const ws = тело?.user?.ws;
    return typeof ws === "number" && Number.isInteger(ws) && ws > 0 ? ws : null;
  } catch {
    return null;
  }
}

/** Арендатор, к которому сервер привязал локальный пуш и запасные источники. */
function привязанныйWs(): number | null {
  const raw = process.env.SNAPSHOT_WS;
  if (!raw) return null;
  const ws = Number(raw);
  return Number.isInteger(ws) && ws > 0 ? ws : null;
}

/** Арендатор предъявителя токена, или `null`.
 *
 *  Без `SNAPSHOT_WS` не пускает НИКОГДА, даже с верным токеном: писать «куда
 *  скажут» — это ровно та дыра, что чинится в этом файле. */
function токеномWs(req: NextRequest): number | null {
  const t = process.env.SNAPSHOT_TOKEN;
  const ws = привязанныйWs();
  if (!t || ws === null) return null;
  const ждём = Buffer.from(`Bearer ${t}`);
  const дали = Buffer.from(req.headers.get("authorization") || "");
  /* Длины сверяем отдельно: `timingSafeEqual` на разных длинах бросает. */
  if (дали.length !== ждём.length) return null;
  return timingSafeEqual(дали, ждём) ? ws : null;
}

/* Пуш держится в памяти процесса — но ПО АРЕНДАТОРАМ, а не одной ячейкой на
   всех. Потолок стоит потому, что ключ приходит снаружи (сколько арендаторов
   завели — столько и ключей), а снапшот весит мегабайты: без него процесс
   панели растёт до конца памяти. Выбрасываем самый старый — `Map` хранит
   порядок вставки. */
const кеш = new Map<number, { данные: unknown; at: string }>();
const ПОТОЛОК = 64;

/* ── И ТОТ ЖЕ ПУШ НА ДИСКЕ, ПО АРЕНДАТОРАМ ────────────────────────────────
 *
 * ПАМЯТЬ ПРОЦЕССА НЕ ПЕРЕЖИВАЕТ ПЕРЕЗАПУСК, А ПАРК ЧЕЛОВЕКА ОБЯЗАН. Пока пуш
 * лежал ТОЛЬКО в памяти, каждый деплой и каждый рестарт панели молча стирал
 * снапшот арендатора: `/api/snapshot` начинал отвечать `snapshot: null`, и
 * панель показывала парк без единого пикселя, «кабинета нет в снапшоте» на
 * каждой строке группы и пустую колонку `pixel` на листе кабинетов. Ошибки при
 * этом не было нигде — ни в логе, ни на экране: выглядело как «панель перестала
 * видеть пиксели».
 *
 * Замер 18.08: снапшот мака собран в 07:02 UTC и запушен, панель перезапущена в
 * 07:27 UTC на выкладке — и с этой минуты у владельца не было снапшота вовсе.
 *
 * ФАЙЛ НА АРЕНДАТОРА, ИМЯ ИЗ ЧИСЛА. `ws` уже проверен выше (`сессияWs` /
 * `токеномWs`) и по построению целое положительное — но в имя файла он идёт
 * через `Number`, а не строкой из запроса: путь, собранный из внешней строки,
 * — это чтение чужих файлов через `../`.
 *
 * Каталог задаётся `SNAPSHOT_DIR`, по умолчанию `../data/snapshots` от рабочего
 * каталога панели (в образе это `/app/data/snapshots`, том `paneldata`). Диска
 * может не быть вовсе (только чтение, нет тома) — тогда пуш остаётся в памяти,
 * как и было: запись падает молча, а не роняет приём снапшота. */
const ДИСК = process.env.SNAPSHOT_DIR
  || path.join(process.cwd(), "..", "data", "snapshots");

function файлАрендатора(ws: number): string {
  return path.join(ДИСК, `ws-${Number(ws)}.json`);
}

async function наДиск(ws: number, данные: unknown, at: string): Promise<void> {
  try {
    await fs.mkdir(ДИСК, { recursive: true });
    /* Пишем во временный и переименовываем: снапшот весит мегабайты, а читатель
       приходит в любой момент — на прямой записи он поймал бы половину файла и
       разобрал бы её как «снапшота нет». */
    const врем = файлАрендатора(ws) + ".tmp";
    await fs.writeFile(врем, JSON.stringify({ данные, at }), "utf8");
    await fs.rename(врем, файлАрендатора(ws));
  } catch {
    /* Тома нет или он только на чтение — пуш остаётся в памяти. */
  }
}

async function сДиска(ws: number): Promise<{ данные: unknown; at: string } | null> {
  try {
    const raw = await fs.readFile(файлАрендатора(ws), "utf8");
    const тело = JSON.parse(raw) as { данные?: unknown; at?: string };
    return тело && тело.данные !== undefined && тело.данные !== null
      ? { данные: тело.данные, at: String(тело.at || "") }
      : null;
  } catch {
    return null;
  }
}

function положить(ws: number, данные: unknown): string {
  const at = new Date().toISOString();
  кеш.delete(ws);                       // чтобы обновление уехало в конец очереди
  кеш.set(ws, { данные, at });
  while (кеш.size > ПОТОЛОК) {
    const старейший = кеш.keys().next().value;
    if (старейший === undefined) break;
    кеш.delete(старейший);
  }
  return at;
}

async function fromFile(): Promise<unknown> {
  const candidates = [
    path.join(process.cwd(), "..", "data", "ui_snapshot.json"),
    path.join(process.cwd(), "data", "ui_snapshot.json"),
  ];
  for (const f of candidates) {
    try {
      const raw = await fs.readFile(f, "utf8");
      return JSON.parse(raw);
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fromUrl(): Promise<unknown> {
  const url = process.env.SNAPSHOT_URL;
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET(req: NextRequest) {
  const ws = await сессияWs(req);
  if (!ws) return DENIED;
  const своё = кеш.get(ws);
  if (своё && своё.данные !== null && своё.данные !== undefined) {
    return NextResponse.json({
      snapshot: своё.данные, source: "push", pushedAt: своё.at,
    });
  }
  /* Пуш пережил перезапуск процесса — читаем его с диска и поднимаем обратно в
     память, чтобы следующий запрос не ходил к файлу. Каталог свой на
     арендатора: чужой файл этим путём не открыть. */
  const сдиска = await сДиска(ws);
  if (сдиска) {
    кеш.set(ws, сдиска);
    return NextResponse.json({
      snapshot: сдиска.данные, source: "push", pushedAt: сдиска.at,
    });
  }
  /* Запасные источники — ОДНОГО арендатора, того, что назван сервером. Файл на
     диске и URL в окружении принадлежат установке, а не всякому вошедшему. */
  if (ws === привязанныйWs()) {
    const u = await fromUrl();
    if (u) return NextResponse.json({ snapshot: u, source: "url" });
    const f = await fromFile();
    if (f) return NextResponse.json({ snapshot: f, source: "file" });
  }
  return NextResponse.json({ snapshot: null, source: "none" });
}

// Local generator (scripts/make_ui_snapshot.py) pushes fresh data here so a hosted
// panel stays live even though the antidetect only exists on the operator's machine.
export async function POST(req: NextRequest) {
  /* Два разных пропуска, и оба называют АРЕНДАТОРА. Токеном стучится генератор
     с мака (`scripts/make_ui_snapshot.py --push`): у скрипта нет и не может
     быть сессии, он не человек с браузером, — поэтому его арендатор задан на
     сервере (`SNAPSHOT_WS`). Сессией — человек, и его арендатор приходит от
     демона.

     ИЗ ЗАПРОСА АРЕНДАТОР НЕ БЕРЁТСЯ НИКОГДА: ни из тела, ни из заголовка.
     Иначе вошедший сосед пишет в чужое пространство одной строкой JSON, и
     починка этого роута оказывается косметикой. */
  const ws = токеномWs(req) ?? (await сессияWs(req));
  if (!ws) return DENIED;
  try {
    const body = (await req.json()) as { snapshot?: unknown };
    const данные = body?.snapshot ?? body;
    const pushedAt = положить(ws, данные);
    /* Ждём запись: ответ «ok» должен означать «переживёт перезапуск», иначе
       выкладка через минуту после пуша снова оставит арендатора без парка. */
    await наДиск(ws, данные, pushedAt);
    return NextResponse.json({ ok: true, pushedAt });
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
}

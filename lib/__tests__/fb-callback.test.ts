/* Обратный путь согласия Меты: два режима, и выбор между ними (#36).
 *
 *  Зачем эти тесты. В роуте был жёстко зашит `http://127.0.0.1:8791/callback`,
 *  и на сервере подключить соц становилось нельзя вовсе — не из-за адреса, а по
 *  устройству: демон живёт во внутренней сети рядом с панелью, и БРАУЗЕР ДО НЕГО
 *  НЕ ДОСТАНЕТ, так что переброс отправил бы человека в никуда.
 *
 *  Проверять руками весь диалог согласия нечем — он у Меты. Поэтому здесь
 *  проверяется ровно то, что можно: КУДА роут собирается пойти, ЧЕМ именно
 *  (переброс или запрос сервер-серверу) и что он не превращается в открытый
 *  редирект, когда в окружении лежит мусор.
 *
 *  Владелец 14.08: «СОЦЫ Я ХОЧУ ПОДКЛЮЧАТЬ УЖЕ, ЧЕРЕЗ ОБЛАКО».
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const ЗАПРОС = (qs: string) =>
  new Request(`https://app.obelista.com/api/fb/callback${qs}`);

/** Роут читает окружение в момент запроса, поэтому модуль берём заново на
 *  каждый случай — иначе первый же импорт заморозил бы значение. */
async function route(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return (await import("@/app/api/fb/callback/route")).GET;
}

afterEach(() => {
  delete process.env.ANALYTICS_API;
  delete process.env.NEXT_PUBLIC_ANALYTICS_API;
  vi.unstubAllGlobals();
});

describe("выбор режима по адресу демона", () => {
  it("демон на петле — переброс браузером, как было на маке", async () => {
    const GET = await route({ ANALYTICS_API: "http://127.0.0.1:8791" });
    const res = await GET(ЗАПРОС("?code=abc&state=xyz") as never);
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin).toBe("http://127.0.0.1:8791");
    expect(loc.pathname).toBe("/callback");
    expect(loc.searchParams.get("code")).toBe("abc");
    expect(loc.searchParams.get("state")).toBe("xyz");
  });

  it("localhost и ::1 — тоже петля, не только 127.0.0.1", async () => {
    for (const base of ["http://localhost:8791", "http://[::1]:8791"]) {
      const GET = await route({ ANALYTICS_API: base });
      expect((await GET(ЗАПРОС("?code=a") as never)).status).toBe(307);
    }
  });

  it("демон по обычному адресу — идём САМИ, браузер туда не отправляем", async () => {
    // Это и есть весь смысл задачи: на сервере демон во внутренней сети, и
    // переброс увёл бы человека в никуда.
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const res = await GET(ЗАПРОС("?code=abc") as never);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const called = new URL(String((fetchMock.mock.calls as unknown as string[][])[0][0]));
    expect(called.origin).toBe("http://collector:8791");
    expect(called.searchParams.get("code")).toBe("abc");
  });
});

describe("что попадает дальше и что нет", () => {
  it("проброшены только известные параметры Меты", async () => {
    const GET = await route({ ANALYTICS_API: "http://127.0.0.1:8791" });
    const res = await GET(ЗАПРОС("?code=a&state=b&evil=1&host=attacker") as never);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.searchParams.get("evil")).toBeNull();
    expect(loc.searchParams.get("host")).toBeNull();
  });

  it("адрес НИКОГДА не берётся из запроса — только из окружения", async () => {
    const GET = await route({ ANALYTICS_API: "http://127.0.0.1:8791" });
    const res = await GET(ЗАПРОС("?code=a&redirect_uri=https://evil.example") as never);
    expect(new URL(res.headers.get("location")!).origin).toBe("http://127.0.0.1:8791");
  });

  it("мусор в окружении откатывает на петлю, а не выполняется", async () => {
    for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "не-адрес"]) {
      const GET = await route({ ANALYTICS_API: bad });
      const res = await GET(ЗАПРОС("?code=a") as never);
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).origin).toBe("http://127.0.0.1:8791");
    }
  });

  it("серверная переменная сильнее вшитой на сборке", async () => {
    // Образ панели приезжает готовым из GHCR: вшитое на сборке нельзя поменять,
    // не пересобрав. Поэтому рантайм-переменная обязана перебивать.
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await (await route({
      ANALYTICS_API: "http://collector:8791",
      NEXT_PUBLIC_ANALYTICS_API: "http://old-build-time:8791",
    }))(ЗАПРОС("?code=a") as never);
    expect(new URL(String((fetchMock.mock.calls as unknown as string[][])[0][0])).origin)
      .toBe("http://collector:8791");
  });
});

describe("человек узнаёт, чем кончилось", () => {
  it("отказ Меты показывается словами и дальше не пробрасывается", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const res = await GET(ЗАПРОС("?error=access_denied&error_description=User+denied") as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("User denied");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("демон не ответил — честная страница, а не пустота", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const res = await GET(ЗАПРОС("?code=a") as never);
    expect(res.status).toBe(502);
    expect(await res.text()).toContain("Nothing was connected");
  });

  it("тело ответа демона человеку НЕ показывается", async () => {
    // Там может оказаться что угодно, вплоть до кусков токена.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("EAAG...секрет...", { status: 500 })));
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const res = await GET(ЗАПРОС("?code=a") as never);
    const html = await res.text();
    expect(html).not.toContain("EAAG");
    expect(html).not.toContain("секрет");
    // Наружу отдаём 502 «мы не смогли», а в тексте — код, которым ответил
    // демон: по нему разбираются, не видя его тела.
    expect(res.status).toBe(502);
    expect(html).toContain("500");
  });
});


describe("две находки приёмки #60", () => {
  it("путь в адресе демона НЕ срезается", async () => {
    // `new URL(x).origin` отдаёт только протокол+хост+порт. Значение вида
    // `https://obelista.com/api/analytics` превратилось бы в `https://obelista.com`,
    // и код уехал бы не туда — молча, потому что домен верный.
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const GET = await route({ ANALYTICS_API: "https://obelista.com/api/analytics" });
    await GET(ЗАПРОС("?code=a") as never);
    const called = new URL(String((fetchMock.mock.calls as unknown as string[][])[0][0]));
    expect(called.pathname).toBe("/api/analytics/callback");
  });

  it("хвостовой слеш не даёт двойного", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const GET = await route({ ANALYTICS_API: "http://collector:8791/" });
    await GET(ЗАПРОС("?code=a") as never);
    expect(new URL(String((fetchMock.mock.calls as unknown as string[][])[0][0])).pathname)
      .toBe("/callback");
  });

  it("успех объявляется — но ТОЛЬКО на 200, и это новое право", async () => {
    // Раньше здесь стояло обратное: демон возвращал `200, CALLBACK_HTML` на
    // ЛЮБОЙ исход (`callback_page` — каждая ветка), и успех по коду определить
    // было нечем, поэтому панель писала «Sent to the collector». Теперь у
    // каждого исхода свой код, `200` означает ровно успех, и панель впервые
    // имеет право сказать «подключено».
    //
    // ЦЕНА ЭТОГО ПРАВА: против СТАРОГО демона ветка врёт на каждом исходе.
    // Мерж раньше правки `/callback` в линии Ядра запрещён.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>ok</html>", { status: 200 })));
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const html = await (await GET(ЗАПРОС("?code=a") as never)).text();
    expect(html).toContain("Account connected");
  });
});

/* Возврат не должен быть тупиком.
 *
 * Ссылка согласия живёт 600 секунд, одноразова и гасится деплоем — значит
 * неудача на возврате это ШТАТНЫЙ исход, а не авария, и человек обязан из неё
 * выйти. «Back to profiles» после неудачи читается как «иди посмотри», а ему
 * нужно знать, что попытка не последняя. Адрес у обоих случаев один: подключение
 * начинается кнопкой на листе профилей.
 */
describe("из неудачи есть выход", () => {
  it("отказ Меты предлагает попробовать снова", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const html = await (await GET(ЗАПРОС("?error=access_denied") as never)).text();
    expect(html).toContain("Try again");
    expect(html).toContain('href="/socials"');
  });

  it("демон ответил отказом — тоже предлагает снова, а не только объясняет", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const html = await (await GET(ЗАПРОС("?code=a") as never)).text();
    expect(html).toContain("Try again");
  });

  it("демон недоступен — тоже", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const html = await (await GET(ЗАПРОС("?code=a") as never)).text();
    expect(html).toContain("Try again");
  });

  it("удачный обмен НЕ зовёт пробовать снова — это не неудача", async () => {
    // Иначе человек, у которого всё получилось, получает приглашение
    // переподключиться и решает, что не получилось.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>ok</html>", { status: 200 })));
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const html = await (await GET(ЗАПРОС("?code=a") as never)).text();
    expect(html).not.toContain("Try again");
    expect(html).toContain("Open Profiles");
  });
});

/* Шесть исходов демона, каждый со своим кодом (контракт 14.08).
 *
 * Тело ответа демона человеку не показывается ни в одной ветке: там может
 * оказаться что угодно, вплоть до кусков токена. Слова наши, код — его.
 */
describe("исходы разбираются по коду, а не сваливаются в один", () => {
  const ответ = async (status: number, qs = "?code=a") => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>тело демона</html>", { status })));
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const res = await GET(ЗАПРОС(qs) as never);
    return { status: res.status, html: await res.text() };
  };

  it("410 — ссылка устарела: штатный исход, выход прямо здесь", async () => {
    // Ссылка живёт 600 секунд, одноразова и гасится деплоем. Это не авария.
    const { status, html } = await ответ(410);
    expect(status).toBe(410);
    expect(html).toContain("expired");
    expect(html).toContain("Try again");
  });

  it("403 — прав не хватает: НЕ «подключено», и сказано почему", async () => {
    // Записать токен без прав значит написать «подключено» и оставить спенд
    // пустым — человек уйдёт ждать данные, которых не будет.
    const { status, html } = await ответ(403);
    expect(status).toBe(403);
    expect(html).not.toContain("Account connected");
    expect(html).toContain("Try again");
  });

  it("400 — Мета отказала", async () => {
    const { status, html } = await ответ(400);
    expect(status).toBe(400);
    expect(html).toContain("Try again");
  });

  it("502 — обмен не удался, и это не вина человека", async () => {
    const { html } = await ответ(502);
    expect(html).toContain("not something you did wrong");
    expect(html).toContain("Try again");
  });

  it("неизвестный код НЕ выдаётся за успех", async () => {
    // Новый код означает, что контракт разошёлся с этим файлом. Честнее
    // сказать «не вышло», чем угадать, что он значил.
    const { html } = await ответ(418);
    expect(html).not.toContain("Account connected");
    expect(html).toContain("418");
  });

  it("тело демона не протекает ни в одной ветке", async () => {
    for (const s of [200, 410, 403, 400, 502, 418]) {
      expect((await ответ(s)).html).not.toContain("тело демона");
    }
  });
});

/* Седьмой выход, которого в контракте не было: адрес открыли руками.
 *
 * Демон на запрос без кода отвечает `200` — «страница возврата, открывать
 * незачем». По новому контракту `200` означает «подключено». Значит без
 * отдельной ветки человек, зашедший сюда по закладке, прочитал бы
 * «Account connected» — уверенное враньё на ровном месте.
 */
describe("адрес возврата, открытый руками", () => {
  it("без кода и без ошибки демон вообще не зовётся", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const GET = await route({ ANALYTICS_API: "http://collector:8791" });
    const res = await GET(ЗАПРОС("") as never);
    expect(fetchMock).not.toHaveBeenCalled();
    const html = await res.text();
    expect(html).not.toContain("Account connected");
    expect(html).toContain("Nothing to finish here");
  });
});

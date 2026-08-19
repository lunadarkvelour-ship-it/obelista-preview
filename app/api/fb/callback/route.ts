import { NextResponse } from "next/server";

/* Публичный адрес возврата из диалога согласия Меты (#36).
 *
 * Зачем он вообще нужен. Раньше redirect_uri вёл прямо на локальный демон —
 * http://localhost:8791/callback. В режиме разработки Мета пускает localhost
 * сама, и это работало. После публикации приложения (live mode, 07.08) перестало:
 * согласие проходит, а на возврате Мета показывает «Can't load URL — the domain
 * of this URL isn't included in the app's domains».
 *
 * Секрет приложения сюда не приезжает НИ В ОДНОМ из режимов ниже: обмен кода на
 * токен делает демон, и токен остаётся там же, где обменивался. Это решение 5
 * спеки, и оно не меняется.
 *
 *
 * ПОЧЕМУ РЕЖИМА ДВА, А НЕ ОДИН
 *
 * Здесь был жёстко зашит `http://127.0.0.1:8791/callback` и переброс на него
 * 307-м. На маке это верно: демон стоит на той же машине, где открыт браузер,
 * и браузер до него дотягивается. На сервере — неверно, и не из-за адреса, а по
 * устройству: демон живёт во внутренней сети рядом с панелью, и БРАУЗЕР ДО НЕГО
 * НЕ ДОСТАНЕТ. Переброс отправил бы человека в никуда.
 *
 * Лечить это выставлением демона наружу нельзя. Через порт 8791 отдаётся весь
 * API аналитики, и однажды его уже опубликовали наружу случайно (контур
 * tg-daily, снесён 09.08 — он слушал тот же порт, ронял демон и уезжал в
 * cloudflared). Второй раз наступать не будем.
 *
 * Поэтому:
 *
 *  • демон на петле (127.0.0.1 / localhost / ::1) — значит он на машине
 *    пользователя, а панель где-то ещё. Мост через браузер: 307, как раньше.
 *    Ходить туда с сервера бессмысленно — там будет ЕГО собственный localhost;
 *
 *  • демон по любому другому адресу — значит он рядом с нами. Забираем код
 *    сами, запросом сервер-серверу, и наружу демон не выставляем вовсе.
 *
 * Различаем по адресу, а не по отдельному флагу: флаг — это ещё одна вещь,
 * которую можно забыть выставить, и забытый даст молчаливо неверный режим.
 *
 *
 * ОТКУДА БЕРЁТСЯ АДРЕС
 *
 * `ANALYTICS_API` читается В МОМЕНТ ЗАПРОСА, а `NEXT_PUBLIC_ANALYTICS_API`
 * вшивается в бандл на сборке. Разница не косметическая: панель приезжает на
 * сервер готовым образом из GHCR (#22/#29), и вшитое на сборке нельзя поменять,
 * не пересобрав образ. Поэтому серверная переменная первая.
 *
 * ПУБЛИЧНАЯ — НЕ РАВНОЦЕННАЯ ЗАМЕНА, И НАДЕЯТЬСЯ НА НЕЁ ЗДЕСЬ НЕЛЬЗЯ. Прежде
 * тут стояло, что она «запасная, чтобы ничего не сломалось там, где настроена
 * только она». Настроена ровно только она — и именно там оно и ломается.
 *
 * Причина в том, что публичный и внутренний адрес одной службы — это РАЗНЫЕ
 * адреса, а не два написания одного. `NEXT_PUBLIC_*` по определению адрес для
 * БРАУЗЕРА: `panel/lib/analytics.ts` клиентский, и цифры за ним ходят с машины
 * человека. На нашем деплое он равен `https://<домен>/api/analytics`
 * (`deploy/docker-compose.yml`, `.github/workflows/deploy.yml`), а весь этот
 * путь стоит за basic auth Caddy — в матчере `@private` он не исключён.
 * Замер 14.08: `/api/analytics/{health,snapshot,leaderboard,callback}` отдают
 * 401 `www-authenticate: Basic`, все четыре. Значит серверный режим ниже,
 * взяв этот адрес, сходит по нему БЕЗ пароля, получит 401 и покажет человеку
 * «Could not finish connecting … status 401». Ошибка не исчезнет — сменит вид.
 *
 * Поэтому на сервере `ANALYTICS_API` обязана быть выставлена во внутренний
 * адрес демона (`http://collector:8891` — сеть compose одна, форвардер в
 * `deploy/entrypoint-collector.sh`). Публичное значение здесь остаётся
 * подпоркой ровно для случая, когда панель и демон стоят на одной машине, —
 * то есть для мака, где оно и так петлевое и уводит в мост через браузер.
 *
 * Открытым редиректом это не является: цель берётся из окружения, которое
 * задаём мы, и никогда из параметров запроса. Схема проверяется явно.
 */

const FALLBACK = "http://127.0.0.1:8791";

function daemonBase(): string {
  const raw = process.env.ANALYTICS_API || process.env.NEXT_PUBLIC_ANALYTICS_API || FALLBACK;
  try {
    const u = new URL(raw);
    /* Только http/https. Без этой проверки в окружение можно было бы положить
       `javascript:` или `file:` и получить из настройки то, чем настройка быть
       не должна. Значение наше, но проверка стоит одной строки. */
    if (u.protocol !== "http:" && u.protocol !== "https:") return FALLBACK;
    /* НЕ `u.origin`: он срезает путь. Задокументированное значение вида
       `https://obelista.com/api/analytics` превратилось бы в `https://obelista.com`,
       и код уехал бы не туда — молча, потому что домен-то верный. Держим всё,
       кроме хвостового слеша, чтобы не собрать `//callback`. */
    return (u.origin + u.pathname).replace(/\/+$/, "");
  } catch {
    return FALLBACK;
  }
}

/** Демон на петле = он на машине человека, а не рядом с нами. */
function isLoopback(base: string): boolean {
  const h = new URL(base).hostname;
  return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]";
}

/** Прокидываем ровно то, что присылает Мета, и ничего сверх. Список закрытый:
 *  иначе через этот адрес можно передать демону произвольные параметры. */
const PASS = ["code", "state", "error", "error_code", "error_description",
              "error_reason", "granted_scopes", "denied_scopes"];

/** Страница-ответ человеку. Демон в серверном режиме отвечает НАМ, а не ему,
 *  поэтому сказать, чем кончилось, обязаны мы. Молчаливая пустая страница на
 *  возврате из согласия читается как «не сработало», и человек жмёт заново.
 *
 *  `retry` меняет не адрес, а ОБЕЩАНИЕ ссылки. Уходят оба случая на один и тот
 *  же лист — подключение начинается кнопкой там, — но «Back to profiles» после
 *  неудачи читается как «иди посмотри», а человеку в этот момент нужно знать,
 *  что попытка не последняя. Выданные ссылки живут 600 секунд и гасятся
 *  деплоем, то есть неудача здесь — штатный исход, а не авария. */
function page(title: string, detail: string, status: number, retry = false): NextResponse {
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<body style="font:14px/1.6 system-ui;max-width:34rem;margin:12vh auto;padding:0 1rem">` +
      `<h1 style="font-size:1rem">${esc(title)}</h1><p>${esc(detail)}</p>` +
      `<p><a href="/socials">${retry ? "Try again" : "Open Profiles"}</a></p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/* `new URL(req.url)`, а не `req.nextUrl`: последнее есть только у `NextRequest`,
   и роут переставал быть проверяемым обычным `Request` — то есть непроверяемым
   вовсе, потому что весь диалог согласия живёт у Меты и руками его не погоняешь. */
export async function GET(req: Request) {
  const from = new URL(req.url).searchParams;
  const base = daemonBase();
  const to = new URL(base + "/callback");
  for (const key of PASS) {
    const v = from.get(key);
    if (v !== null) to.searchParams.set(key, v);
  }

  /* Отказ Меты доносим словами, не пробрасывая дальше: обменивать нечего, а
     человек должен прочитать причину, а не гадать по пустой странице. */
  const err = from.get("error_description") || from.get("error");
  if (err) return page("Facebook did not grant access", err, 400, true);

  /* Ни кода, ни отказа — значит адрес открыли руками, а не пришли из диалога.
     Дальше не идём НАМЕРЕННО: демон на запрос без кода отвечает `200`, и по
     контракту `200` теперь означает «соц подключён». То есть без этой ветки
     человек, зашедший на адрес возврата из любопытства или по старой закладке,
     прочитал бы «Account connected» — уверенное враньё на ровном месте, и
     обнаружилось бы оно не здесь, а на пустом листе кабинетов. */
  if (!from.get("code")) {
    return page(
      "Nothing to finish here",
      "This is the address Meta returns you to after the consent dialog. "
        + "Open it from the Profiles page instead.",
      400,
    );
  }

  if (isLoopback(base)) {
    /* Мост через браузер. 307, а не 302: код одноразовый, и метод обязан
       сохраниться при перебросе. */
    return NextResponse.redirect(to.toString(), 307);
  }

  try {
    const r = await fetch(to.toString(), { redirect: "manual", cache: "no-store" });

    /* Исходы демона — по КОДУ ответа, и это стало возможно только что.
       Раньше `callback_page` возвращал `200, CALLBACK_HTML` на любой исход —
       и при `scopes=0`, и без кода, и при исключении, — поэтому панель не имела
       права говорить «подключено» и честно писала «отправлено, проверь на
       листе». Теперь у каждого исхода свой код, и `200` означает ровно успех.

       Тело ответа демона человеку НЕ показываем ни в одной ветке: там может
       оказаться что угодно, вплоть до кусков токена. Слова наши, код — его.

       ВНИМАНИЕ ПРИ МЕРЖЕ: эта ветка верна только против НОВОГО демона. Против
       старого, который отвечает `200` всегда, «Account connected» станет
       уверенным враньём на каждом исходе. Мерж этого PR раньше правки
       `/callback` в линии Ядра запрещён — см. тело PR. */
    if (r.status === 200) {
      return page(
        "Account connected",
        "Meta granted access and the collector saved it. Ad accounts, their status and billing "
          + "will appear on their own — this takes a few minutes on the first run.",
        200,
      );
    }
    if (r.status === 410) {
      /* Штатный исход, а не авария: ссылка живёт 600 секунд, одноразова и
         гасится деплоем. Поэтому тон обычный и выход прямо здесь. */
      return page(
        "That link has expired",
        "Consent links are valid for ten minutes and can be used once. Start again from the "
          + "Profiles page — it takes one press.",
        410,
        true,
      );
    }
    if (r.status === 403) {
      return page(
        "Some permissions were not granted",
        "The account was not connected: without the full set of permissions the spend would "
          + "stay empty. Start again and leave every checkbox in Meta's dialog ticked.",
        403,
        true,
      );
    }
    if (r.status === 400) {
      return page(
        "Facebook did not grant access",
        "Meta refused the consent. Nothing was connected — you can start again from the "
          + "Profiles page.",
        400,
        true,
      );
    }
    /* 502 у демона и всё неизвестное. Неизвестное сюда попадает намеренно:
       новый код ответа означает, что контракт разошёлся с этим файлом, и
       честнее сказать «не вышло», чем угадать, что он значил. */
    return page(
      "Could not finish connecting",
      `The collector answered with status ${r.status}. The account is not connected — this is `
        + "not something you did wrong; try again from the Profiles page.",
      502,
      true,
    );
  } catch {
    return page(
      "Could not reach the collector",
      "The panel could not talk to the collector service. Nothing was connected.",
      502,
      true,
    );
  }
}

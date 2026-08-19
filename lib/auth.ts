"use client";

/* Разговор панели с гейтом: вход, выход, «кто я», приглашение, сброс.
 *
 * ГДЕ ЭТО ЖИВЁТ. Рядом с цифрами, на том же адресе (`API_BASE` + `/auth/*`), а не
 * на отдельном домене авторизации. Кука тогда одна на всё, и не приходится
 * объяснять браузеру, почему сессия с одного домена должна работать на другом.
 *
 * `credentials: "include"` СТОИТ ВЕЗДЕ, и это не перестраховка. На маке панель на
 * 8790, а демон на 8791 — разные origin, и без этого кука не поедет вовсе. В
 * облаке они на одном домене, там оно лишнее и безвредное. Один и тот же код
 * работает в обоих местах ровно потому, что здесь не экономят.
 *
 * КУКУ ПАНЕЛЬ НЕ ЧИТАЕТ И НЕ МОЖЕТ: она HttpOnly. Значит «вошёл или нет» нельзя
 * узнать, посмотрев на document.cookie, — только спросив `/auth/me`. Это не
 * неудобство, а то, ради чего HttpOnly и ставят: скрипт на странице не должен
 * иметь возможности украсть сессию.
 *
 * ОТКАЗЫ ВОЗВРАЩАЮТСЯ, А НЕ БРОСАЮТСЯ. Отказ гейта — это не сбой, а нормальный
 * ответ формы: «пара не подошла» надо показать рядом с полями, а не поймать
 * where-нибудь наверху. Бросается только то, что и правда сломалось: сеть, неJSON.
 */

import { API_BASE } from "./analytics";

/** Строка листа учёток. `status` — «активна» или «погашена»; своего словаря
 *  состояний панель не заводит и показывает то, что пришло. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  status: string;
  ws: number;
  created_at?: string | null;
  last_login_at?: string | null;
}

/** Ответ на заведение учётки и на перевыдачу приглашения: и человек, и ССЫЛКА. */
export type InviteResult =
  | { ok: true; user: AuthUser; inviteUrl: string; expiresAt: string | null }
  | { ok: false; code: string; status: number };

export interface AuthUser {
  email: string;
  name: string;
  role: "user" | "admin";
  ws: number;
}

/** Ответ гейта: либо человек, либо код отказа. Третьего нет. */
export type AuthResult =
  | {
      ok: true;
      user: AuthUser;
      expiresAt: string | null;
      registrationOpen?: boolean;
      firstTenant?: boolean;
    }
  | {
      ok: false;
      code: string;
      status: number;
      retryAfterS?: number;
      minLen?: number;
      /** Можно ли вообще завести учётку (`registration_open`). Сегодня всегда
       *  `true`: владелец открыл регистрацию всем 15.08.
       *
       *  Панель сегодня им не пользуется, и это осознанно, а не забыто. Раньше
       *  по нему выбиралась дверь — и это оказалось иссусом #143: имя пережило
       *  смысл, потому что до 15.08 «можно зарегистрироваться» и «установка
       *  свободна» были одним вопросом. Дверь теперь читает `firstTenant`.
       *  Место, где этот признак понадобится, — не дверь, а ссылка «Sign up»:
       *  когда регистрацию закроют обратно, предлагать её станет враньём. */
      registrationOpen?: boolean;
      /** Свежая ли установка (`first_tenant`): учёток нет, следующему достанется
       *  первое рабочее пространство.
       *
       *  Стоит В ОБЕИХ ветках намеренно, и отказная важнее успешной. Экран входа
       *  спрашивает `/auth/me`, НЕ будучи вошедшим — это его обычное состояние,
       *  — и на свежей установке получает 401. Живи признак только в успешном
       *  ответе, панель не узнала бы про свежую установку ровно в том
       *  единственном случае, ради которого признак существует: там, где войти
       *  ещё некем.
       *
       *  Отсюда же следует, что отдельной ручки под этот вопрос нет и не будет:
       *  два источника одной правды расходятся молча. */
      firstTenant?: boolean;
      /** ВХОДА НА ЭТОЙ УСТАНОВКЕ НЕТ ВОВСЕ (`gate: false` из `/auth/me`).
       *
       *  Это не отказ и не «сессия кончилась»: сервер ответил `ok: true`, но
       *  человека не назвал, потому что спрашивать некого — локальная база без
       *  единой заведённой учётки. Признак обязан быть отдельным полем: без
       *  него «входа нет» и «тебя не пустили» приезжают в панель одинаковым
       *  `ok: false`, и лист профиля на такой установке вечно показывает
       *  «спрашиваем сервер, кто вошёл» — сервер уже ответил, ответ просто
       *  некуда было положить.
       *
       *  `undefined` — поля в ответе не было (демон старше контракта), и это
       *  НЕ «гейт есть»: разницу между «нет входа» и «не знаем» держит именно
       *  третье значение. */
      gate?: boolean;
      /** Почему вход выключен, словами сервера (`note`). Показывается человеку
       *  как есть: там сказано и что проверки нет, и как её включить. Свой
       *  пересказ здесь был бы вторым источником той же правды. */
      note?: string;
    };

interface RawBody {
  ok?: boolean;
  user?: AuthUser;
  expires_at?: string | null;
  error?: string;
  code?: string;
  retry_after_s?: number;
  min_len?: number;
  /** Спрашивается ли вход на этой установке. `false` приезжает ВМЕСТЕ с
   *  `ok: true` и пустым `user` — см. `core/authweb.py`, ветка `гейт_включён()`. */
  gate?: boolean;
  note?: string;
  registration_open?: boolean;
  first_tenant?: boolean;
}

async function call(path: string, body?: unknown): Promise<AuthResult> {
  const r = await fetch(API_BASE + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  /* Тело читаем даже у отказа: код причины лежит именно в нём. Пустое или не-JSON
     тело — это уже поломка, а не отказ, и код придумывать нечего. */
  let data: RawBody = {};
  try {
    data = (await r.json()) as RawBody;
  } catch {
    if (r.ok) throw new Error(`${path}: ответ без тела`);
  }

  if (r.ok && data.ok !== false && data.user) {
    return {
      ok: true,
      user: data.user,
      expiresAt: data.expires_at ?? null,
      registrationOpen: data.registration_open,
      firstTenant: data.first_tenant,
    };
  }
  return {
    ok: false,
    status: r.status,
    /* «Входа нет вовсе» доезжает сюда ОТДЕЛЬНЫМ полем, а не растворяется в
       отказе. Сервер в этом случае отвечает `ok: true` и `user: null`, то есть
       по форме — успех без человека; свалив это в общий `ok: false`, панель
       теряет единственный признак, по которому лист профиля может сказать
       правду вместо вечного «спрашиваем сервер». */
    gate: data.gate,
    note: data.note,
    registrationOpen: data.registration_open,
    firstTenant: data.first_tenant,
    /* `error` и `code` — оба имени встречаются в ответах демона; берём что есть.
       Пустое место значит «сервер отказал, но не сказал чем», и текст под это
       есть отдельный (`auth-copy`), а не подстановка первого попавшегося. */
    code: data.code || data.error || "",
    retryAfterS: data.retry_after_s,
    minLen: data.min_len,
  };
}

/** Ответ, где важен не только человек, но и выданная ссылка. Отдельно от `call`,
 *  потому что `call` намеренно ничего не знает про приглашения: ему хватает пары
 *  «пустили или нет», а тут возвращается предмет, который админ понесёт человеку. */
async function callInvite(path: string, body: unknown): Promise<InviteResult> {
  const r = await fetch(API_BASE + path, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: RawBody & { invite_url?: string; invite_expires_at?: string | null } = {};
  try {
    data = await r.json();
  } catch {
    /* разберём как отказ без причины */
  }
  if (r.ok && data.ok !== false && data.user && data.invite_url) {
    return {
      ok: true,
      user: data.user,
      inviteUrl: data.invite_url,
      expiresAt: data.invite_expires_at ?? null,
    };
  }
  return { ok: false, status: r.status, code: data.code || data.error || "" };
}

export const auth = {
  login: (email: string, password: string) => call("/auth/login", { email, password }),

  /** Первая учётка установки. Открыто, ПОКА на установке нет ни одной учётки;
   *  первый зарегистрировавшийся становится админом, дальше только приглашение.
   *
   *  Успех сразу впускает — сервер ставит куку той же формы, что и вход. Гнать
   *  человека на форму входа с паролем, который он придумал секунду назад,
   *  значит заставить его усомниться, что регистрация сработала.
   *
   *  Отдельного «повторите пароль» здесь нет: поле показа пароля решает ту же
   *  задачу честнее, а вторая пустая клетка на первом экране продукта — это
   *  ещё один способ ошибиться, а не защита. */
  register: (email: string, name: string, password: string) =>
    call("/auth/register", { email, name, password }),

  /** Выход всегда считается удавшимся. Сервер и сам отвечает 200 без сессии:
   *  кнопка «выйти» обязана работать в том числе тогда, когда выходить уже не из
   *  чего, — иначе она ломается ровно в тот момент, когда нужнее всего. */
  logout: async (): Promise<void> => {
    try {
      await fetch(API_BASE + "/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch {
      /* Сети нет — куку всё равно погасит сервер при следующей встрече, а держать
         человека на странице из-за неудавшегося выхода нельзя. */
    }
  },

  /** Кто вошёл. ЕДИНСТВЕННЫЙ способ это узнать: кука HttpOnly, из скрипта не
   *  видна. Отказ здесь — обычное состояние («ещё не вошёл»), а не ошибка. */
  me: () => call("/auth/me"),

  /** Проверка ссылки-приглашения ДО того, как человек начнёт вводить пароль.
   *  Иначе он придумает пароль, наберёт его дважды и только тогда узнает, что
   *  ссылка протухла двое суток назад. */
  checkInvite: async (token: string): Promise<
    { ok: true; email: string; minLen: number } | { ok: false; code: string }
  > => {
    const r = await fetch(
      API_BASE + "/auth/invite/check?token=" + encodeURIComponent(token),
      { credentials: "include", cache: "no-store" },
    );
    let data: RawBody & { email?: string } = {};
    try {
      data = await r.json();
    } catch {
      return { ok: false, code: "" };
    }
    if (r.ok && data.ok !== false && data.email) {
      return { ok: true, email: data.email, minLen: data.min_len ?? 0 };
    }
    return { ok: false, code: data.code || data.error || "" };
  },

  /** Установка пароля по приглашению. Успех СРАЗУ впускает — сервер ставит куку,
   *  и гнать человека на форму входа с только что придуманным паролем незачем. */
  acceptInvite: (token: string, password: string) =>
    call("/auth/invite", { token, password }),

  /** Смена своего пароля, со старым. Успех гасит все прочие сессии, текущая живёт:
   *  угнанная вкладка не должна пережить смену пароля. */
  /* Поля называются `old` и `new` — ровно так их читает сервер
     (`core/authweb.py`, ветка `/auth/password`), и так же они стоят в его
     прогоне. Здесь до 15.08 отправлялось `old_password`/`new_password`:
     сервер брал бы из такого тела пустую строку и отвечал `bad_pair`, то есть
     «пароль не подходит» — и чинить пошли бы пароль, а не имя поля. Экрана
     смены пароля в панели пока нет, поэтому наружу это не вылезло; починено
     до того, как вылезет. */
  changePassword: (oldPassword: string, newPassword: string) =>
    call("/auth/password", { old: oldPassword, new: newPassword }),

  /* ── админское. Обычному человеку всё ниже отвечает 403 not_admin, без
        сессии — 401. Панель на это не полагается и всё равно прячет лист от
        неадминов: 403 в ответ на нажатие — это не «нельзя», это «зачем ты мне
        это показал». ────────────────────────────────────────────────────── */

  /** Список учёток арендатора. Хэша пароля в ответе нет никогда — по контракту и
   *  по обещанию юрстраницы, и проверять его тут нечем: его просто не приходит. */
  listUsers: async (): Promise<
    { ok: true; users: AdminUser[] } | { ok: false; code: string; status: number }
  > => {
    const r = await fetch(API_BASE + "/auth/users", {
      credentials: "include",
      cache: "no-store",
    });
    let data: { ok?: boolean; users?: AdminUser[]; error?: string; code?: string } = {};
    try {
      data = await r.json();
    } catch {
      /* пустое тело разберём ниже как отказ без причины */
    }
    if (r.ok && data.ok !== false) return { ok: true, users: data.users || [] };
    return { ok: false, status: r.status, code: data.code || data.error || "" };
  },

  /** Завести учётку. Пароль админ НЕ ЗАДАЁТ и не видит никогда — возвращается
   *  ссылка-приглашение целиком, и она единственный способ передать доступ.
   *  Это прямое исполнение обещания с /privacy, а не удобство. */
  createUser: (email: string, name: string, role: "user" | "admin") =>
    callInvite("/auth/users", { email, name, role }),

  /** Перевыдать приглашение, когда прежнее протухло. Прежнее при этом гаснет. */
  reinvite: (id: string) => callInvite("/auth/users/invite", { id }),

  /** Погасить учётку — вместе со всеми её сессиями разом. */
  suspendUser: (id: string) => call("/auth/users/suspend", { id }),
  activateUser: (id: string) => call("/auth/users/activate", { id }),

  /** УДАЛИТЬ учётку насовсем — вместе с сессиями, приглашениями и журналом
   *  попыток. Это не «гашение посильнее»: погашенного включают обратно кнопкой
   *  рядом, удалённого вернуть нечем — только завести заново, уже без истории.
   *
   *  Отсюда правило экрана, а не только этой функции: звать её без явного
   *  подтверждения человеком нельзя. Сервер про подтверждение ничего не знает и
   *  знать не должен — он и не может: у него нет способа отличить осознанное
   *  нажатие от промаха мышью.
   *
   *  Три отказа, которые сюда приезжают и означают разное:
   *    no_such_user — учётки нет В ЭТОМ пространстве (в том числе когда она
   *                   есть в чужом: чужую нам не показывают и не подтверждают);
   *    self_delete  — себя; удалить может только другой админ;
   *    last_admin   — последнего живого админа: пространство осталось бы без
   *                   владельца. */
  deleteUser: (id: string) => call("/auth/users/delete", { id }),

  /** Запрос сброса. Сервер ВСЕГДА отвечает 200 — есть такая почта или нет.
   *  Иначе форма сброса становится ровно той проверялкой существующих адресов,
   *  которую мы закрыли на входе. Значит и панель обязана показать один и тот же
   *  ответ в обоих случаях, а не радоваться найденной почте. */
  requestReset: async (email: string): Promise<void> => {
    try {
      await fetch(API_BASE + "/auth/reset/request", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* Молчим и здесь: разное поведение при сетевой ошибке тоже различало бы
         существующие адреса от несуществующих, если сеть отвалится не всегда. */
    }
  },
};

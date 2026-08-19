/* Что панель говорит человеку про вход, пароль и приглашение.
 *
 * ЗАЧЕМ ОТДЕЛЬНО ОТ ЭКРАНОВ. Тексты входа — это не оформление, а половина работы
 * экрана: человек, которого не пустили, узнаёт из них, что ему делать дальше. Их
 * надо проверять тестом (в правильный ли текст ложится код ошибки) и держать в
 * одном месте, потому что один и тот же код приходит на три разных экрана.
 *
 * ГЛАВНОЕ ПРАВИЛО ЗДЕСЬ — РАЗНЫЕ ПРИЧИНЫ ГОВОРЯТСЯ РАЗНЫМИ СЛОВАМИ. Соблазн свести
 * всё к «ссылка недействительна» велик, а цена конкретная: у ссылки-приглашения два
 * непохожих конца, и они требуют противоположных действий. `invite_used` — пароль по
 * ней УЖЕ ЗАВЕДЁН, человеку надо просто войти. `invite_expired` — 48 часов прошли,
 * входить нечем, надо просить новую у админа. Одинаковый текст отправит половину
 * людей не туда, и каждый второй пойдёт к админу за тем, что у него уже есть.
 *
 * ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО. Юрстраницы в main обещают дословно: пароль хранится в
 * виде, который нельзя превратить обратно, никто в Обелисте его прочитать не может,
 * и мы никогда его не спрашиваем. Значит нигде в этих текстах не появляется ни
 * «подтвердите пароль администратору», ни «сообщите свой прежний пароль», ни намёка
 * на то, что его можно восстановить: восстановления нет, есть сброс.
 */

/** Коды, которые присылает сервер. Список закрытый: неизвестный код показывается
 *  отдельным текстом, а не подставляется в первый попавшийся. */
export type AuthErrorCode =
  | "empty_fields"
  | "bad_pair"
  | "account_suspended"
  | "tenant_suspended"
  | "too_many"
  | "weak_password"
  | "invite_invalid"
  | "invite_used"
  | "invite_expired"
  | "no_session"
  | "session_expired"
  | "session_revoked"
  | "not_admin"
  | "bad_email"
  | "email_taken"
  | "self_suspend"
  | "self_delete"
  | "last_admin"
  | "no_such_user"
  | "tenant_missing"
  | "registration_closed";

const TEXTS: Record<AuthErrorCode, string> = {
  empty_fields: "Fill in both fields.",
  /* Не «неверный пароль» и не «нет такой почты»: какая именно половина пары не
     подошла, мы не говорим — иначе форма превращается в проверялку «есть ли у вас
     такой человек». Сервер по той же причине отвечает одинаково в обоих случаях. */
  /* Окно первой регистрации закрывается НАВСЕГДА первой заведённой учёткой.
     Поэтому текст не предлагает «попробовать позже» — пробовать нечего, — а
     называет единственный оставшийся путь внутрь. */
  registration_closed:
    "This Obelista already has an account. Ask its admin to invite you — sign-up is open only once, for the very first account.",
  bad_pair: "That email and password do not match.",
  account_suspended: "This account has been switched off. Ask your admin to turn it back on.",
  tenant_suspended: "This workspace has been switched off. Ask your admin.",
  too_many: "Too many attempts. Wait a moment and try again.",
  weak_password: "That password is too short or too easy to guess. Pick another one.",

  /* Три конца у ссылки-приглашения, и все три требуют РАЗНЫХ действий. Свести их
     к «ссылка недействительна» значит отправить две трети людей не туда. */
  invite_invalid: "This invitation link is not valid. Ask your admin for a new one.",
  invite_used:
    "A password has already been set with this link. Sign in with your email and password.",
  invite_expired:
    "This invitation has expired. Ask your admin for a new one — links are good for 48 hours.",

  /* Три конца у сессии — тоже разные разговоры. «Вышел на другом устройстве» и
     «просто истекла» человек переживает по-разному: во втором случае всё в
     порядке, в первом стоит вспомнить, кто ещё заходил под этой учёткой. */
  no_session: "Sign in to continue.",
  session_expired: "Your session has expired. Sign in again.",
  session_revoked: "This session was ended — on another device or by your admin. Sign in again.",

  not_admin: "That is available to admins only.",
  bad_email: "That does not look like an email address.",
  email_taken: "An account with that email already exists.",
  self_suspend: "You cannot switch off your own account.",
  /* Отдельным текстом от `self_suspend`, а не общим «нельзя трогать себя»:
     действия разные и лечатся по-разному. Выключить себя незачем, а вот уйти
     из продукта — законное желание, и человеку надо сказать, чем оно делается:
     чужой рукой. Слитый текст отправил бы его искать кнопку, которой нет. */
  self_delete: "You cannot delete your own account — another admin can do it for you.",
  /* Про ОБЕ операции разом: и гашение, и удаление последнего админа оставляют
     пространство без владельца. Слова подобраны так, чтобы не обещать, будто
     дело в кнопке «включить»: заводить и назначать админов больше будет некому. */
  last_admin: "This is the last admin of the workspace — make someone else an admin first.",
  no_such_user: "That account no longer exists. Refresh the list.",
  /* Учётка жива, а её рабочего пространства в базе нет. Человеку тут делать
     нечего, и «попробуйте ещё раз» было бы враньём: чинится это на стороне
     сервиса, а не повторным нажатием. */
  tenant_missing: "This account has no workspace. Ask your admin to sort it out.",
};

/** Текст под код. Незнакомый код — честная фраза, а не молчание и не чужой текст.
 *
 *  Сервер вправе завести новый код раньше, чем панель о нём узнает; подставить в
 *  этом случае «неверная пара» значило бы соврать о причине, а показать пустоту —
 *  оставить человека перед формой, которая просто не сработала. */
export function authErrorText(code?: string | null): string {
  if (code && code in TEXTS) return TEXTS[code as AuthErrorCode];
  return "Something went wrong on our side. Try again, and tell your admin if it repeats.";
}

/* ── правило пароля ───────────────────────────────────────────────────────── */

/** Правило показывается ДО ввода, а не после отказа.
 *
 *  Требование ПМ, и оно про то, как люди на самом деле заводят пароли: правило,
 *  всплывающее после отказа, читается как придирка, и человек подгоняет пароль под
 *  него наугад. Показанное заранее — это условие задачи.
 *
 *  Заглавных, цифр и спецзнаков не требуем НАМЕРЕННО: такие требования заставляют
 *  писать `Password1!` и делают пароли хуже, а не лучше. */
export const PASSWORD_MAX = 200;

/** Минимум приезжает от сервера (`{"min_len": 10}`) и НЕ зашивается в текст.
 *  Десятка здесь — только запасной вариант на случай, если ответ пришёл без неё:
 *  показать правило без числа хуже, чем показать с чуть устаревшим. */
export const PASSWORD_MIN_FALLBACK = 10;

export function passwordRule(minLen?: number | null): string {
  const min = typeof minLen === "number" && minLen > 0 ? minLen : PASSWORD_MIN_FALLBACK;
  return `At least ${min} characters. No capitals or symbols required — length is what matters.`;
}

/** Что не так с паролем, если это видно ДО отправки. `null` — можно отправлять.
 *
 *  Проверка на стороне панели не заменяет серверную и не притворяется ею: сервер
 *  знает больше (словари, утечки) и остаётся последним словом. Смысл здешней — не
 *  гонять человека за ответом по сети ради того, что видно сразу.
 *
 *  Сравнение с почтой — регистронезависимое и по обрезанной строке: `Ivan@x.ru ` и
 *  `ivan@x.ru` это один и тот же адрес, и пароль, равный ему, одинаково плох. */
export function passwordProblem(
  password: string,
  email: string,
  minLen?: number | null,
): string | null {
  const min = typeof minLen === "number" && minLen > 0 ? minLen : PASSWORD_MIN_FALLBACK;
  if (password.length < min) return `Too short — at least ${min} characters.`;
  if (password.length > PASSWORD_MAX) return `Too long — at most ${PASSWORD_MAX} characters.`;
  if (password.trim().toLowerCase() === email.trim().toLowerCase() && email.trim()) {
    return "That is your email address. Pick something else.";
  }
  return null;
}

/* Кабинеты, как их отдаёт БАЗА, и как они сводятся со снапшотом мака в ОДНУ строку.
 *
 * ЧТО ЗДЕСЬ ЛЕЖИТ. Разбор ответа демона (`GET /accounts`), сведение его со строками
 * снапшота (`unifiedAccounts`), группировка по Business Manager и счётчики листа.
 * Всё чистыми функциями: строки приезжают запросом, а тестовый рендер запросов не
 * делает — внутри компонента это непроверяемо.
 *
 * ПОЧЕМУ СВЕДЕНИЕ ЖИВЁТ ЗДЕСЬ, А НЕ В `account-rows.ts`. Тот собирает строку из
 * снапшота мака и знает про соцев антидетекта: `AccountOwner` несёт `present`,
 * `oauth`, `fresh`. Здесь — строка базы, у которой из трёх этих признаков есть
 * два (`oauth` и `present` из `in_antidetect`), а свежести нет и не будет
 * (решение 26 спеки: в облаке сущности «профиль антидетекта» не существует, и
 * сбора, свежесть которого можно было бы оценить, там не происходит). Свести их
 * обязан кто-то ТРЕТИЙ, иначе каждый из двух начнёт знать про другого.
 *
 * До 15.08 сведения не было вовсе: были два листа и развилка «есть снапшот —
 * рисуем один, нет — другой». Она и оказалась той парой источников правды, из-за
 * которой у владельца и у свежей учётки продукт выглядел по-разному (иссус #121).
 *
 *
 * ДЕНЬГИ ПРИХОДЯТ ЦЕЛЫМИ МИНОРНЫМИ ЕДИНИЦАМИ, И ЭТО НЕ ПРИДИРКА
 *
 * Мета отдаёт `balance`/`amount_spent`/`spend_cap` в минимальных единицах валюты
 * (`'1234'` = 12.34), демон кладёт их в базу целыми как есть — в схеме проекта
 * запрещён REAL, а `float(x)/100` в сборщике терял бы копейки молча на сумме по сотне
 * кабинетов (`core/fbspend.py:_money_int`, `core/registry.py:_money_units`). Делит на
 * сто тот, кто рисует экран, и делает это РОВНО ЗДЕСЬ, в одном месте. Снапшот те же
 * величины отдаёт человеческой строкой с валютой внутри («12.34 USD») — и умножает
 * их обратно тоже это место (`snapshotMoney`), чтобы в строке листа не встретились
 * два формата денег: это прямая дорога показать сумму в сто раз больше.
 *
 * Ноль и «не приехало» — РАЗНЫЕ вещи, и различать их обязаны все, кто это читает.
 * `balance = 0` значит «денег на кабе не осталось» и объясняет, почему встал залив;
 * `null` значит «Мета не ответила». Сборщик их уже различает (`is not None`, а не
 * `if значение`), и терять эту разницу на экране нельзя: вчерашние 800 с отметкой
 * «снято минуту назад» — это ложь дважды.
 */

import { isDeadStatus, statusLabel, type StatusLabel } from "./account-status";
import { ВЕНДОР_НЕТ } from "./analytics";
import type { AccountOwner, AccountRow } from "./account-rows";
import type { SnapshotPixel } from "./types";

/** Строка `account` из базы, как её отдаёт демон (`GET /accounts`).
 *
 *  Все поля необязательные, кроме `act_id`: колонки биллинга довозятся на живую базу
 *  миграцией (`core/registry._ensure_billing_columns`), и до её прохода строка честно
 *  приезжает без них. Пустое поле обязано выглядеть как «не знаем», а не как ноль. */
export interface CloudAccount {
  act_id: string;
  name?: string | null;
  bm_id?: string | null;
  bm_name?: string | null;
  currency?: string | null;
  /** Статус СЛОВОМ: ACTIVE, DISABLED, UNSETTLED… (`core/catalog.ACCOUNT_STATUS`). */
  status?: string | null;
  /** Он же кодом Меты — на случай статуса, которого словарь ещё не знает. */
  status_code?: number | null;
  /** Причина отключения текстом, ПО-АНГЛИЙСКИ: словарь один и он в `core/catalog.py`,
   *  туда же добавлена английская колонка. Своей карты «код → текст» панель не
   *  заводит — второй словарь разъедется с первым на первом же новом коде Меты. */
  disable_reason?: string | null;
  disable_reason_code?: number | null;
  /** Минорные единицы валюты кабинета. `null` — не приехало, `0` — именно ноль. */
  balance?: number | null;
  amount_spent?: number | null;
  spend_cap?: number | null;
  funding_type?: string | null;
  funding_display_string?: string | null;
  /** Словесный отказ: дневной лимит токеном приложения не снимается вовсе. Это не
   *  значение лимита и не его отсутствие — это «этим путём не измеряется». */
  daily_limit_note?: string | null;
  /** Когда СНЯТ этот набор полей. Отдельно от `updated_at`, который двигает любой
   *  писатель, включая тех, кто статуса и биллинга не видел. */
  status_checked_at?: string | null;
}

/** Соц кабинета, как его отдаёт БАЗА (`GET /accounts`, поле `owners` —
 *  `scripts/analytics_daemon.py:_соцы_профилей`).
 *
 *  ПРИЗНАКОВ ДВА, И СКЛАДЫВАТЬ ИХ НАДО, А НЕ ВЫБИРАТЬ ОДИН. «У соца есть токен»
 *  (`oauth`) и «это окно сейчас открывается» (`in_antidetect`) — разные вещи, и
 *  лить можно, только когда верны обе.
 *
 *  Это не осторожность, а разбор живого промаха. Первая редакция ручки считала
 *  `oauth` совпадением `profile_id` со строкой в `token`, и на базе владельца
 *  15.08 ответ выходил РОВНО НАОБОРОТ: токены лежали под четырьмя ключами
 *  ПРЕЖНЕГО вендора антидетекта, мёртвыми после переезда, а четыре живых окна
 *  своей строки в `token` не имели вовсе. Панель, включи она чекбокс по одному
 *  `oauth`, погасила бы единственный рабочий профиль и предложила бы залив через
 *  окно, которого нет. Ключ токена намеренно не переезжает на свежий профиль
 *  (`core/fbapp.social_key`): на старый ссылается история кабинетов.
 *
 *  Оба признака отделены и от самого факта владения: «кабинет виден с профиля»
 *  — третий вопрос, и на живой базе 695 связей против четырёх живых окон. */
export interface CloudOwner {
  profile_id: string;
  /** Человеческое имя соца; пусто — покажем id. */
  name?: string | null;
  /** У СОЦА этого профиля есть живой токен приложения. */
  oauth?: boolean | null;
  /** Окно профиля существует в антидетекте прямо сейчас. */
  in_antidetect?: boolean | null;
  /** Вердикт Обелисты про вендора этого профиля (`core/registry.py`, #163).
   *  `нет_вендора` — профиль лежит у антидетекта, которого у нас нет вовсе:
   *  окно не «выключено», а не может быть открыто НИКОГДА, и человеку это
   *  чинить нечем. Поля может не быть — так отвечает демон постарше. */
  vendor_state?: string | null;
  /** Provider label persisted by the provider-bound profile bridge (XR-44). */
  vendor?: string | null;
}

/** Строка ответа целиком: поля `account` плюс связи с соцами.
 *
 *  Отдельным типом, а не полем в `CloudAccount`, и это не вкус. `UnifiedAccount`
 *  расширяет `CloudAccount` и держит в `owners` СВОЙ тип — соца панели; два
 *  разных `owners` под одним именем в одной цепочке наследования не живут. Они и
 *  правда разные: у соца базы нет двух признаков из трёх, см. `ownerFromCloud`. */
export interface CloudAccountRow extends CloudAccount {
  owners?: CloudOwner[] | null;
}

export interface CloudAccountsResponse {
  ok?: boolean;
  accounts?: CloudAccountRow[] | null;
  /** Когда демон собрал ответ. Не то же, что свежесть строки: строки снимались
   *  каждая в своё время, и это видно в `status_checked_at`. */
  generated_at?: string | null;
}

/* ── деньги ──────────────────────────────────────────────────────────────── */

/** Валюты, у которых минимальная единица И ЕСТЬ единица: делить на сто нечего.
 *
 *  Список короткий намеренно — только то, что реально встречается у закупщиков
 *  трафика. Незнакомая валюта считается двузначной, и это верно для подавляющего
 *  большинства ISO 4217. Ошибка здесь видна глазом (сумма в сто раз не та), а не
 *  прячется, поэтому лучше короткий честный список, чем полный несопровождаемый. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "PYG", "RWF", "UGX",
                              "VUV", "XAF", "XOF", "XPF"]);

/** Прочерк вместо нуля там, где ноль означал бы «данных нет» — правило всей панели
 *  (`analytics.ts`, `DASH`). Здесь оно работает НАОБОРОТ для самого нуля: ноль
 *  печатается цифрой, потому что он факт, а прочерк достаётся только `null`. */
export const DASH = "—";

/** Сколько кабинетов группы или листа мы посчитать НЕ МОЖЕМ, потому что статуса у
 *  них нет вовсе.
 *
 *  Заведено по разбору живого сервера: сегодня статуса нет ни у одного кабинета из
 *  261, и шапка показывала «0 active · 0 disabled» — то есть складывала неизвестное
 *  как ноль. Уровень ячейки был честен (прочерк вместо выдумки), а этажом выше та же
 *  пустота превращалась в утверждение, и читают её ПЕРВОЙ и не перепроверяют.
 *
 *  Правило: «не знаем» — отдельное состояние агрегата, а не ноль. */
export function unknownCount(counts: Record<StatusLabel, number>): number {
  return counts.unknown;
}

/** Сколько минорных единиц в единице валюты. */
export function minorFactor(currency?: string | null): number {
  return currency && ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
}

/** Минорные единицы → человеческая сумма. ЕДИНСТВЕННОЕ место деления на сто.
 *
 *  Валюта неизвестна — печатаем число без знака, а не подставляем доллар:
 *  «$185» у кабинета в донгах это не округление, а другая сумма. */
export function money(units?: number | null, currency?: string | null): string {
  if (units === null || units === undefined || !Number.isFinite(units)) return DASH;
  const value = units / minorFactor(currency);
  const code = (currency || "").toUpperCase();
  if (!code) return value.toLocaleString("en-US", { minimumFractionDigits: 2,
                                                   maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code })
      .format(value);
  } catch {
    /* Код валюты, которого не знает Intl (или сломанная строка из базы). Показываем
       число и код рядом — это по-прежнему читается, в отличие от исключения. */
    return `${value.toLocaleString("en-US", { minimumFractionDigits: 2,
                                             maximumFractionDigits: 2 })} ${code}`;
  }
}

/* ── поля, у которых два имени ────────────────────────────────────────────── */

/** Код статуса Меты. Имя ОДНО — `status_code`, и это решение, а не умолчание.
 *
 *  Первая редакция читала два имени сразу (`status_code` и метино `account_status`)
 *  «на случай расхождения на стыке». Так делать нельзя: чтение двух имён не защищает
 *  от рассинхрона, а ПРЯЧЕТ его — колонка продолжает заполняться, и никто не узнает,
 *  что стороны договорились о разном. Пусть лучше поле окажется пустым и это будет
 *  видно сразу. Контракт фиксирует ПМ, меняется он тоже через ПМ. */
export function statusCode(a: CloudAccount): number | null {
  const v = a.status_code;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Статус словом, а если слова нет — кодом. Пусто у обоих значит «не снимали».
 *
 *  Код без слова печатается как `status 42`, а не прячется: незнакомый статус — это
 *  «Мета завела новый», и человек должен его увидеть, чтобы спросить. */
export function statusText(a: CloudAccount): string | null {
  if (a.status) return a.status;
  const code = statusCode(a);
  return code === null ? null : `status ${code}`;
}

/** Причина бана текстом; код без текста — «reason 12», по той же причине. */
export function disableReasonText(a: CloudAccount): string | null {
  if (a.disable_reason) return a.disable_reason;
  const code = a.disable_reason_code;
  /* Ноль у Меты значит «причины нет», и это нормальное состояние живого кабинета,
     а не пропуск: показывать «reason 0» было бы выдумкой. */
  if (typeof code !== "number" || !Number.isFinite(code) || code === 0) return null;
  return `reason ${code}`;
}

/** Карта оплаты одной строкой. `funding_display_string` — то, как её показывает сам
 *  ФБ («Visa · 1234»); тип без строки лучше пустоты, пустота значит «карты нет». */
export function fundingText(a: CloudAccount): string | null {
  return a.funding_display_string || a.funding_type || null;
}

/* ── ОДИН КАБИНЕТ — ОДНА СТРОКА, СКОЛЬКО БЫ ИСТОЧНИКОВ НИ БЫЛО ─────────────── */

/* Иссус #121. До 15.08 лист кабинетов существовал в ДВУХ видах: снапшотный
 * (`AccountsView` — соцы, пиксели, выбор, группы) и облачный (`CloudAccountsView`
 * — сводка, разрез по Business Manager). Разными были не данные, а КОД: две вьюхи,
 * две раскладки, два набора фильтров. Владелец увидел их рядом и сказал, что «они
 * между собой спорят»; ровно так две копии одного экрана и расходятся — молча и в
 * разные стороны.
 *
 * Поэтому источник у листа теперь один — вот этот тип. Снапшот и база сводятся ДО
 * разметки, а вьюха видит только готовую строку и не знает, откуда что приехало.
 *
 * КЛЮЧ — КАБИНЕТ, а не пара «соц × кабинет» и не «строка базы». Общий каб, который
 * видно с трёх соцев и который лежит в базе, — это ОДНА строка: соцы в `owners`,
 * и она находится поиском по каждому из них. Дублировать её значит соврать в
 * счётчике «всего» ровно на число пересечений (13.08 это стоило 71 лишней строки
 * из 209).
 *
 * ЧЬЁ ЗНАЧЕНИЕ ПОБЕЖДАЕТ. Берём у того, у кого поле ЕСТЬ; если есть у обоих —
 * у базы. Не потому, что она «главнее», а потому, что демон снимает состояние по
 * кругу и сам ставит отметку времени, а снапшот живёт ровно до следующего обхода
 * антидетекта и на сервере не появляется вовсе (решение 26 спеки). Поля, которых у
 * базы нет физически — пиксели, соцы-владельцы, дневной лимит, признак лички, —
 * приезжают только из снапшота, и никакой развилки для них не нужно.
 *
 * ЧЕГО ЗДЕСЬ НЕ ПРОИСХОДИТ. Ноль и «не приехало» не смешиваются ни в одном поле:
 * `null` остаётся `null`. Деньги снапшота («1.96 USD») переводятся в минорные
 * единицы ЗДЕСЬ и один раз — второй формат в строке листа означал бы сумму в сто
 * раз не ту, и заметить это было бы некому.
 */

/** Соц кабинета в сведённой строке.
 *
 *  Это НЕ `AccountOwner` снапшота, хотя тот сюда и подходит. Разница в одном
 *  поле, и она принципиальная: у соца, приехавшего из базы, `fresh` — не `false`,
 *  а `null`. `false` значит «данные этого соца собраны давно», то есть
 *  утверждение про сбор, которого в облаке не было вовсе: сущности «профиль
 *  антидетекта» там нет (решение 26 спеки), и подтвердить свежесть некому.
 *  Ровно та же развилка, что уже сделана для `present` в `account-rows`, и по
 *  той же причине. */
export interface UnifiedOwner extends Omit<AccountOwner, "fresh"> {
  fresh: boolean | null;
  /** Профиль лежит у вендора, которого у Обелисты нет. Отдельно от
   *  `present === false`: «окно сейчас закрыто» человек чинит на своей машине,
   *  а это — не чинит вообще, и звать его в антидетект значит врать. Соц мака
   *  про вендора не знает, и у него поля нет вовсе. */
  vendorGone?: boolean;
  provider?: string;
  providerProfileId?: string;
}

export interface FieldEvidence {
  source: "snapshot" | "oauth";
  observedAt?: string | null;
}

export interface MembershipEvidence extends FieldEvidence {
  provider?: string;
  providerProfileId?: string;
  snapshotRevision?: string;
}

export interface UnifiedAccount extends CloudAccount {
  /** Соцы, с которых кабинет виден: и те, что видно с мака, и те, что знает
   *  база. Пусто — про соцев мы не знаем НИЧЕГО; это не то же самое, что «соцев
   *  нет», и различать их обязан каждый, кто это читает (`noUploadReason`). */
  owners: UnifiedOwner[];
  /** Соц, от имени которого пойдёт залив. `null` — заливать нечем, и это НЕ
   *  ошибка данных: в облаке так выглядит весь парк. Строка без соца показывается
   *  наравне со всеми, но в выбор не идёт — движок резолвит кабы ВНУТРИ профиля.
   *
   *  Пустое поле при НЕПУСТОМ `owners` — отдельные случаи, а не тот же самый:
   *  соцы известны, но токена нет ни у кого — или токен есть, а окна нет.
   *  Почему обоих мало, написано у `ктоЗальёт`, а различает их
   *  `noUploadReason`. */
  profile: string | null;
  profileLabel: string;
  /** Пиксели кабинета. Только из снапшота: в `account` их нет. */
  pixels: SnapshotPixel[];
  /** Личный кабинет FB — залив в него значит мгновенный бан вместе с профилем. */
  personal: boolean;
  /** ДНЕВНОЙ лимит, минорными единицами. Отдельно от `spend_cap`, потому что это
   *  разные величины: `spend_cap` — предел трат за всё время, а дневной лимит
   *  токеном приложения не отдаётся вовсе (`daily_limit_note`) и приезжает только
   *  из снапшота. Слить их в одно поле значило бы подписать «в день» сумму,
   *  которая относится ко всему сроку жизни кабинета. */
  daily_limit?: number | null;
  inSnapshot: boolean;
  inCloud: boolean;
  /** Always populated by `unifiedAccounts`; optional only for legacy fixtures/callers. */
  membership?: MembershipEvidence;
  fieldSources?: Record<string, FieldEvidence>;
}

/** Тождество кабинета. `act_` — префикс показа, а не часть id: снапшот и база
 *  пишут его по-разному, и без нормализации общий каб раздваивается. */
export function accKey(id: string): string {
  return String(id).replace(/^act_/i, "").toLowerCase();
}

/* ── СОЦ БАЗЫ ЗНАЕТ ПРО СЕБЯ ОДНО ИЗ ТРЁХ ─────────────────────────────────── */

/** Соц базы → соц листа. ЯВНЫЙ маппинг, а не приведение типа: форма у них
 *  похожа, смысл — нет, и то, чего база не знает, обязано отсутствовать, а не
 *  получить правдоподобное значение.
 *
 *  • `present` — есть ли окно профиля в антидетекте. Приезжает из
 *    `in_antidetect`: демон снимает это с моста с машины и знает ответ. Поля
 *    НЕТ в ответе — вот тогда `null`, «подтвердить некому», и разница дорогая:
 *    выбывшего соца лист помечает призраком и не берёт в залив, а с
 *    неизвестным так поступать нельзя.
 *  • `fresh` — здесь `null` всегда: сбора, свежесть которого можно было бы
 *    оценить, в облаке не происходит.
 *  • `collectedAt` не ставим СОВСЕМ, а не пустой строкой: времени сбора у связи
 *    нет, а пустая метка сортируется как «самый старый сбор» и молча решала бы,
 *    чьим временем подписана строка (`изСнапшота`, выбор `собрано`).
 *  • `oauth` — есть ли у СОЦА этого профиля живой токен. Берём строго
 *    `=== true`: «с него можно лить» это утверждение, и ни пустое поле, ни
 *    отсутствующее его не дают. Для самого залива этого мало — нужен ещё
 *    `present`, см. `ктоЗальёт`. */
export function ownerFromCloud(o: CloudOwner): UnifiedOwner {
  const provider = String(o.vendor || "").trim().toLowerCase();
  const свой: UnifiedOwner = {
    profile: o.profile_id,
    label: o.name || "",
    present: typeof o.in_antidetect === "boolean" ? o.in_antidetect : null,
    fresh: null,
    oauth: o.oauth === true,
    ...(provider ? { provider, providerProfileId: o.profile_id } : {}),
  };
  /* ПОЛЕ ПОЯВЛЯЕТСЯ, ТОЛЬКО КОГДА ДОКАЗАНО, — по тому же правилу, что `present`
     остаётся `null`, когда сервер про окно не сказал. `vendorGone: false` от
     демона, который про вендоров не знает вовсе, был бы утверждением «вендор в
     порядке», которого никто не проверял. Строку сравниваем с КОНСТАНТОЙ
     движка, а не с «чем-нибудь непустым»: вердиктов три, и только один из них
     значит «не чинится» (совпадение имён держит `__tests__/vendor-state.test.ts`,
     читающий сам питон). */
  if (o.vendor_state === ВЕНДОР_НЕТ) свой.vendorGone = true;
  return свой;
}

/** Насколько соц годится в главные. Меньше — лучше.
 *
 *  Тот же порядок и та же формула, что у `account-rows.вес`, и это не
 *  копирование ради удобства: правило одно на продукт. Выбывшее окно уходит в
 *  конец всегда — лить с несуществующего профиля нельзя, сколько бы у него ни
 *  было токенов, а токен в базе переживает уход окна и на живых данных ровно
 *  так и лежит. Дальше решает токен. Свежесть у соца базы неизвестна и потому
 *  ничего не решает. */
function вес(o: UnifiedOwner): number {
  return (o.present === false ? 8 : 0) + (o.oauth ? 0 : 2);
}

/** Соцы строки базы, готовые к показу: без пустых id, без дублей, годные к
 *  заливу первыми.
 *
 *  Порядок не косметика. Первым в списке стоит тот, кого строка называет
 *  главным, а главным может быть только соц с живым окном И токеном; при
 *  равенстве решает id, чтобы порядок не зависел от того, как база сложила
 *  выборку. */
export function cloudOwners(list?: CloudOwner[] | null): UnifiedOwner[] {
  const seen = new Set<string>();
  const out: UnifiedOwner[] = [];
  for (const o of list || []) {
    if (!o?.profile_id || seen.has(o.profile_id)) continue;
    seen.add(o.profile_id);
    out.push(ownerFromCloud(o));
  }
  return out.sort((a, b) => вес(a) - вес(b) || a.profile.localeCompare(b.profile));
}

/** Соц, от имени которого пойдёт залив: живое окно И токен, оба сразу.
 *
 *  Здесь живёт требование, нарушить которое проще всего, и оно уже нарушалось
 *  дважды подряд в разных местах.
 *
 *  ПЕРВЫЙ ПРОМАХ — включить выбор по самому наличию связей. «Кабинет виден с
 *  профиля» и «с профиля можно лить» — разные факты (695 связей против четырёх
 *  живых окон на базе владельца).
 *
 *  ВТОРОЙ — включить его по одному токену. На живых данных 15.08 это дало бы
 *  ровно обратный ответ: токены лежали под четырьмя ключами прежнего вендора
 *  антидетекта, мёртвыми после переезда, а четыре живых окна нового своей
 *  строки в `token` не имели. Чекбокс погас бы
 *  на единственном рабочем профиле и загорелся бы на окне, которого нет.
 *
 *  Поэтому условие — конъюнкция, и `present === true` строго: `null` значит
 *  «сервер про окно не сказал», а на «не сказал» залив не предлагают.
 *
 *  Строку снапшота это правило не трогает: там главный соц уже выбран
 *  `account-rows.вес`, и на машине оператора залив едет браузером через
 *  антидетект, где токен не единственный ключ. */
function ктоЗальёт(owners: UnifiedOwner[]): UnifiedOwner | null {
  return owners.find((o) => o.oauth && o.present === true) || null;
}

/** Почему кабинет нельзя отметить. `null` — можно.
 *
 *  Ответа ТРИ, и разными они обязаны остаться на экране: у них разные причины и
 *  разное лечение, а два из трёх человек чинит сам и разными действиями.
 *
 *  • `owners-unknown` — связей не приехало вовсе. Это «мы не знаем, с каких
 *    соцев виден кабинет», а НЕ «соцев у него нет»: строки `account_owner`
 *    приезжают мостиком с машины, и до первого моста их нет ни у кого. Написать
 *    здесь «соца нет» значило бы утверждать про каждый каб то, чего никто не
 *    проверял. Человеком не чинится вообще.
 *  • `no-live-window` — токен есть, а окна нет. Именно этот случай и есть весь
 *    живой парк владельца после переезда между вендорами антидетекта: токен
 *    остался под прежним ключом, окно завелось новое. Чинится в антидетекте, а не в панели.
 *  • `no-connected-profile` — ни у одного соца нет токена. Чинится подключением.
 *  • `vendor-gone` — кабинет виден ТОЛЬКО с профилей вендора, которого у
 *    Обелисты нет (#163). Отдельно от `no-live-window`, и это не оттенок:
 *    та фраза зовёт человека в антидетект — «заведи окно снова», — а здесь
 *    заводить его негде, вендор снесён. Именно так выглядели те 131 кабинет
 *    без статуса: у соца с рабочим токеном 36 кабинетов и ни одного без
 *    статуса, у соца на мёртвом вендоре — 39 и 38.
 *
 *  ПОРЯДОК ОТВЕТОВ НЕ АЛФАВИТНЫЙ. Когда токен есть хоть у кого-то, недостающая
 *  половина — окно, и говорить про подключение значит послать человека делать
 *  то, что уже сделано. `vendor-gone` проверяется ПЕРВЫМ среди непустых: он
 *  сильнее остальных не важностью, а точностью — про эти кабинеты известно
 *  больше всего, и любая другая фраза послала бы чинить нечинимое.
 *
 *  • `account-dead` — САМ КАБИНЕТ выключен Метой навсегда. Соц тут ни при чём,
 *    и это единственная причина, которая не про нас, а про кабинет.
 *
 *    ЗАЧЕМ ОНА ЗДЕСЬ ПОЯВИЛАСЬ (#166). Владелец увидел на своём экране строку
 *    «all 145 · banned 99 · ready to upload 145» и спросил, как заливаемых может
 *    быть столько же, сколько всех, если 99 забанены. Ответ был неприятный:
 *    «можно лить» отвечало только на вопрос «есть ли кем», а собиратель спеки
 *    (`lib/groups.ts:335`) мёртвые кабинеты из залива ВЫБРАСЫВАЕТ. То есть лист
 *    обещал 145, а поехало бы 46, и разницу человек узнал бы после нажатия.
 *
 *    Условие ровно одно — `disabled`, и это не осторожность, а совпадение с
 *    тем, что делает спека: `billing` она пропускает («лечится оплатой»),
 *    `review` тоже. Запретить здесь больше, чем запрещает залив, значит спрятать
 *    от человека кабинеты, в которые залить МОЖНО.
 *
 *    Проверяется ПЕРВОЙ. Сказать про мёртвый кабинет «нет живого окна» значит
 *    послать человека заводить окно ради кабинета, который не оживёт никогда. */
export type NoUploadReason =
  "account-dead" | "owners-unknown" | "no-live-window" | "no-connected-profile"
  | "vendor-gone";

export function noUploadReason(a: UnifiedAccount): NoUploadReason | null {
  if (isDeadStatus(a.status || undefined)) return "account-dead";
  if (a.profile) return null;
  if (!a.owners.length) return "owners-unknown";
  if (a.owners.every((o) => o.vendorGone)) return "vendor-gone";
  return a.owners.some((o) => o.oauth) ? "no-live-window" : "no-connected-profile";
}

/** Можно ли залить в этот кабинет — ОДИН предикат на весь лист.
 *
 *  Ровно `noUploadReason(a) === null`, и существует он затем, чтобы не было
 *  второго вычисления того же правила. Их и было два: фильтр «ready to upload»
 *  смотрел `Boolean(a.profile)`, чекбокс строки — тоже `a.profile`, а спека
 *  залива — ещё и статус кабинета. Три места, два разных ответа, и разъезд
 *  виден только после нажатия «залить». */
export function можноЛить(a: UnifiedAccount): boolean {
  return noUploadReason(a) === null;
}

/** Строки, которые лист имеет право отметить. То же `можноЛить`, но множеством.
 *
 *  ЗАЧЕМ ОТДЕЛЬНОЕ ИМЯ ДЛЯ ОДНОГО `filter`. Затем, что здесь уже стоял ВТОРОЙ
 *  предикат, и он молча ломал шапку таблицы.
 *
 *  Как это выглядело. Галка «выбрать всё» считала отмечаемыми строки по
 *  `Boolean(r.profile)`, а сам выбор клал в набор только `можноЛить`. Разница
 *  между правилами — забаненный кабинет с известным профилем: `noUploadReason`
 *  проверяет бан ПЕРВЫМ, раньше профиля, поэтому такая строка считалась
 *  отмечаемой и не могла быть отмечена никогда. На парке владельца это 70
 *  строк из 109, то есть галка не сходилась ВСЕГДА — а раз она всегда `false`,
 *  «выбрать всё» отправляло `true` при каждом нажатии, и снять выделение ею
 *  было нельзя вообще.
 *
 *  Заметить это тестом было нечем: правило жило выражением внутри компонента,
 *  а сторож рядом сверял НЕ поведение, а кусок текста этого выражения — тот
 *  самый, который и содержал ошибку.
 *
 *  Поэтому правило одно и лежит здесь: у множества отмечаемых и у множества
 *  отмеченных обязан быть один источник, и он должен вызываться, а не
 *  переписываться. */
export function отмечаемые(rows: UnifiedAccount[]): UnifiedAccount[] {
  return rows.filter(можноЛить);
}

/** То же про ВЕСЬ лист: `null` — хоть что-то отмечается.
 *
 *  Отдельная функция, а не «первая причина первой строки»: сообщение над
 *  таблицей говорит про учётку целиком, и выбирать его надо по самой
 *  продвинутой из причин. Учётка, где у части кабов токен уже есть, ближе к
 *  работе, чем та, где его нет нигде, и звать её подключать соца — неправда. */
export function listNoUploadReason(
  rows: UnifiedAccount[] | null | undefined,
): NoUploadReason | null {
  const строки = rows || [];
  if (!строки.length || строки.some(можноЛить)) return null;
  const причины = new Set(строки.map(noUploadReason));
  /* `vendor-gone` стоит ПОСЛЕ починимых: если хоть у части кабинетов дело в
     окне или в токене, учётка ближе к работе, чем к списанию, и звать человека
     хоронить парк рано. Перед `owners-unknown` — потому что про эти кабинеты
     мы знаем всё, а про те не знаем ничего. */
  for (const с of ["no-live-window", "no-connected-profile", "vendor-gone",
                   "owners-unknown"] as const) {
    if (причины.has(с)) return с;
  }
  return null;
}

/* ── РЕЖИМ «SNAPSHOT»: ПРАВИЛА ВЫБОРА БЕЗ OAUTH ───────────────────────────── */

/* Оба правила ниже живут ЗДЕСЬ, рядом со сведением строк, а не в
 * `cloud-filter`: там всё завязано на охват, а охват — это ровно то понятие,
 * которое в режиме снапшота выключено. Положить их туда значило бы поставить
 * рядом два «правила соца», отвечающих на один вопрос по-разному, — та самая
 * порода, из-за которой охват уже один раз разъехался с выпадашкой профилей. */

/** Профили для выбора в режиме снапшота — ПО ВСЕМ владельцам строк, без
 *  оглядки на `oauth` и `present`.
 *
 *  Это осознанное отличие от `cloud-filter.профилиСписок`, который требует
 *  живой токен (`правилоСоца`). Требование там верное для серверного режима и
 *  ровно бесполезное здесь: режим снапшота включают ИМЕННО ТОГДА, когда сервер
 *  не может подтвердить OAuth, и профиль, отфильтрованный по неподтверждённому
 *  токену, — это пустой список вместо парка.
 *
 *  Ничего не выдумывается: имя берётся то, что в снапшоте есть (`label`), а
 *  когда его нет — показывается id. */
export function snapshotProfileOptions(
  rows: UnifiedAccount[],
): Array<{ id: string; label: string }> {
  const seen = new Map<string, string>();
  for (const a of rows) {
    for (const o of a.owners) {
      if (!o.profile) continue;
      const label = o.label || o.profile;
      const было = seen.get(o.profile);
      /* Имя, которое есть, побеждает пустое: один и тот же профиль приезжает
         владельцем нескольких строк, и у части из них подписи может не быть. */
      if (было === undefined || (было === o.profile && label !== o.profile)) {
        seen.set(o.profile, label);
      }
    }
  }
  return [...seen].map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/* СВОЕГО «выбираемо ли» У РЕЖИМА СНАПШОТА ЗДЕСЬ НЕТ НАМЕРЕННО.
 *
 * Такой предикат тут стоял и был снят при приёмке: он повторял `можноЛить`
 * (см. выше) во всех четырёх случаях таблицы истинности, то есть не добавлял
 * поведения, а заводил ВТОРОЕ определение одного правила — ровно то, что #166
 * свело в одно место после того, как три копии дали два разных ответа.
 *
 * Режиму снапшота второй предикат не нужен по существу: `noUploadReason`
 * спрашивает `oauth` ТОЛЬКО когда соца у строки нет вовсе, а `изСнапшота`
 * ставит `profile` из главного соца, не заглядывая в `oauth`. То есть OAuth уже
 * обойдён устройством, а не исключением. */

/** Деньги снапшота приезжают строкой С ВАЛЮТОЙ («1.96 USD») или числом.
 *  `Number("1.96 USD")` даёт NaN, и колонка честно показывала прочерк на данных,
 *  которые есть у всех кабинетов до единого. Отрезаем всё, кроме числа, а код
 *  валюты забираем из той же строки — другого места у него нет. */
export function snapshotMoney(v: string | number | null | undefined): {
  value: number | null; currency: string | null;
} {
  if (v === null || v === undefined || v === "") return { value: null, currency: null };
  if (typeof v === "number") {
    return { value: Number.isFinite(v) ? v : null, currency: null };
  }
  const s = String(v);
  const m = s.replace(",", ".").match(/-?\d+(\.\d+)?/);
  const c = s.match(/[A-Za-z]{3}/);
  const n = m ? Number(m[0]) : NaN;
  return {
    value: Number.isFinite(n) ? n : null,
    currency: c ? c[0].toUpperCase() : null,
  };
}

/** Человеческая сумма → минорные единицы. Единственное место умножения на сто,
 *  зеркало `money()`. Округление обязательно: 1.96 * 100 в двоичной дроби даёт
 *  195.99999999999997, и без него у кабинета появлялась бы копейка из ниоткуда. */
function toMinor(value: number | null, currency: string | null): number | null {
  return value === null ? null : Math.round(value * minorFactor(currency));
}

/** Минорные единицы одной валюты → минорные единицы другой. Курса у нас нет и не
 *  будет, поэтому это НЕ конвертация денег, а только смена масштаба минорной
 *  единицы (100 центов против 1 донга). Разные валюты складывать по-прежнему
 *  нечем — этим занимается `dominantCurrency`. */
function пересчёт(units: number | null | undefined, из: string | null | undefined,
                  в: string | null | undefined): number | null {
  if (units === null || units === undefined) return null;
  const a = minorFactor(из);
  const b = minorFactor(в);
  return a === b ? units : Math.round((units / a) * b);
}

/** Строка снапшота → общая строка листа. */
function изСнапшота(row: AccountRow, личка: Record<string, number>): UnifiedAccount {
  const acc = row.acc;
  const spent = snapshotMoney(acc.spent);
  const cap = snapshotMoney(acc.limit);
  const balance = snapshotMoney(acc.balance);
  const currency = acc.currency || spent.currency || balance.currency || cap.currency || null;
  /* Отметка времени — САМАЯ СВЕЖАЯ из сборов соцев, которыми каб виден: строка и
     собрана из данных самого свежего владельца (`account-rows`). Взять метку
     главного соца значило бы подписать данные чужим временем. */
  const собрано = row.owners
    .map((o) => o.collectedAt || "")
    .filter(Boolean)
    .sort()
    .pop() || null;
  return {
    act_id: acc.id,
    name: acc.name || null,
    bm_id: null,
    /* В снапшоте у БМ одно поле: имя, а если его нет — id. Разделить их нечем, и
       выдумывать `bm_id` из него нельзя — по нему потом группируют. */
    bm_name: acc.business || null,
    currency,
    status: acc.status || null,
    status_code: null,
    disable_reason: acc.disable_reason || null,
    disable_reason_code: null,
    balance: toMinor(balance.value, currency),
    amount_spent: toMinor(spent.value, currency),
    spend_cap: null,
    daily_limit: toMinor(cap.value, currency),
    funding_type: null,
    funding_display_string: acc.funding || null,
    daily_limit_note: null,
    status_checked_at: собрано,
    owners: row.owners,
    profile: row.profile || null,
    profileLabel: row.profileLabel || row.profile || "",
    pixels: acc.pixels || [],
    personal: личка[acc.id] !== undefined,
    inSnapshot: true,
    inCloud: false,
    membership: {
      source: "snapshot",
      provider: row.provider,
      providerProfileId: row.providerProfileId || row.profile,
      snapshotRevision: row.snapshotRevision,
      observedAt: row.snapshotGeneratedAt || собрано,
    },
    fieldSources: Object.fromEntries(
      ["name", "status", "disable_reason", "balance", "amount_spent", "daily_limit",
       "funding_display_string", "owners", "pixels"].map((field) => [field, {
        source: "snapshot" as const,
        observedAt: row.snapshotGeneratedAt || собрано,
      }]),
    ),
  };
}

/** Строка базы → общая строка листа. Пикселей у неё нет, соцы есть с 15.08, и
 *  пустота в обоих случаях значит «мы не знаем», а не «их нет»: делать из неё
 *  утверждение нельзя. */
function изБазы(a: CloudAccountRow): UnifiedAccount {
  const owners = cloudOwners(a.owners);
  const главный = ктоЗальёт(owners);
  return {
    ...a,
    owners,
    profile: главный?.profile || null,
    profileLabel: главный ? главный.label || главный.profile : "",
    pixels: [],
    personal: false,
    daily_limit: null,
    inSnapshot: false,
    inCloud: true,
    membership: { source: "oauth", observedAt: a.status_checked_at },
    fieldSources: Object.fromEntries(
      ["name", "status", "disable_reason", "balance", "amount_spent", "spend_cap",
       "funding_type", "funding_display_string", "owners"].map((field) => [field, {
        source: "oauth" as const,
        observedAt: a.status_checked_at,
      }]),
    ),
  };
}

/** Значение базы поверх значения снапшота — по полю, а не по строке целиком. */
function свести(снап: UnifiedAccount, a: CloudAccountRow): UnifiedAccount {
  /* OAuth may enrich snapshot membership only when the stable parent identity
     agrees. Matching by act_id alone cross-wires the same account exposed by a
     different provider/profile and lets cloud-only ownership impersonate the
     selected snapshot graph. Missing provider is not proof. */
  const memberProvider = String(снап.membership?.provider || "").toLowerCase();
  const memberProfile = снап.membership?.providerProfileId || снап.profile || "";
  const sameParent = (a.owners || []).some((o) =>
    o?.profile_id === memberProfile
    && String(o.vendor || "").trim().toLowerCase() === memberProvider,
  );
  /* Old snapshots have no provider identity and retain their historical
     act-id merge semantics. A provider-bound snapshot never gets that escape
     hatch: once provenance exists, a missing/wrong cloud parent is not proof. */
  if (memberProvider && memberProfile && !sameParent) return снап;

  const есть = <T,>(v: T | null | undefined, было: T | null | undefined): T | null =>
    (v === null || v === undefined ? (было ?? null) : v);
  const currency = a.currency || снап.currency || null;
  /* Соцы — ОБЪЕДИНЕНИЕ, а не выбор источника, и это тот же приём и та же
     причина, что у `also_on` в `account-rows`: два реестра одних и тех же
     связей обязаны сходиться, но расхождение двух реестров — ровно та болезнь,
     которую мы лечим, поэтому верить одному нельзя. Соцы снапшота остаются
     первыми: про них известны все три признака, а про соца базы — один, и
     главный уже выбран годностью к заливу (`account-rows.вес`). */
  const owners = [...снап.owners];
  for (const o of cloudOwners(a.owners)) {
    if (!owners.some((x) => x.profile === o.profile)) owners.push(o);
  }
  /* Соца залива ищем в базе, только если снапшот его не дал. Если дал —
     перевыбирать нечего: на маке льют браузером через антидетект, и токен там
     не единственный ключ. */
  const главный = снап.profile ? null : ктоЗальёт(owners);
  const fieldSources = { ...снап.fieldSources };
  const mark = (field: string, value: unknown) => {
    if (value !== null && value !== undefined) {
      fieldSources[field] = { source: "oauth", observedAt: a.status_checked_at };
    }
  };
  for (const field of ["name", "bm_id", "bm_name", "currency", "status", "status_code",
    "disable_reason", "disable_reason_code", "balance", "amount_spent", "spend_cap",
    "funding_type", "funding_display_string", "daily_limit_note"] as const) {
    mark(field, a[field]);
  }
  if ((a.owners || []).length) mark("owners", a.owners);
  return {
    ...снап,
    owners,
    profile: снап.profile || главный?.profile || null,
    profileLabel: снап.profile
      ? снап.profileLabel
      : главный ? главный.label || главный.profile : "",
    /* Показываем id в том виде, в каком его пишет база: по нему копируют в
       `manage` и ищут в Ads Manager, и он же уедет в отчёты демона. */
    act_id: a.act_id || снап.act_id,
    name: есть(a.name, снап.name),
    bm_id: есть(a.bm_id, снап.bm_id),
    bm_name: есть(a.bm_name, снап.bm_name),
    currency,
    status: есть(a.status, снап.status),
    status_code: есть(a.status_code, снап.status_code),
    disable_reason: есть(a.disable_reason, снап.disable_reason),
    disable_reason_code: есть(a.disable_reason_code, снап.disable_reason_code),
    /* Деньги снапшота приводим к масштабу валюты базы, если он другой: иначе в
       одном столбце окажутся центы и целые единицы. */
    balance: есть(a.balance, пересчёт(снап.balance, снап.currency, currency)),
    amount_spent: есть(a.amount_spent, пересчёт(снап.amount_spent, снап.currency, currency)),
    spend_cap: есть(a.spend_cap, снап.spend_cap),
    daily_limit: пересчёт(снап.daily_limit, снап.currency, currency),
    funding_type: есть(a.funding_type, снап.funding_type),
    funding_display_string: есть(a.funding_display_string, снап.funding_display_string),
    daily_limit_note: есть(a.daily_limit_note, снап.daily_limit_note),
    /* Свежесть — по базе, когда она вообще снимала состояние: её отметка про то
       же самое и ставится тем же обходом, что и статус. */
    status_checked_at: a.status_checked_at || снап.status_checked_at || null,
    inCloud: true,
    fieldSources,
  };
}

export interface UnifyOpts {
  /** Личные кабинеты: ключ — id кабинета (`lib/lichka`). */
  personal?: Record<string, number>;
  /** Snapshot mode never widens membership with OAuth-only rows. */
  membership?: "all" | "snapshot";
}

/** Снапшот мака + строки базы → один список без дублей.
 *
 *  Порядок аргументов не случаен: снапшот раскладывается первым, потому что он
 *  несёт соцев, и именно к его строке приклеивается состояние из базы. Кабинет,
 *  который знает только база, встаёт отдельной строкой — прятать его нельзя,
 *  иначе облачная панель показывала бы пустоту при полной базе. */
export function unifiedAccounts(
  snapRows: AccountRow[] | null | undefined,
  cloud: CloudAccountRow[] | null | undefined,
  opts: UnifyOpts = {},
): UnifiedAccount[] {
  const личка = opts.personal || {};
  const out = new Map<string, UnifiedAccount>();
  for (const r of snapRows || []) {
    if (!r?.acc?.id) continue;             // без id строку не с чем отождествить
    out.set(accKey(r.acc.id), изСнапшота(r, личка));
  }
  for (const a of cloud || []) {
    if (!a?.act_id) continue;
    const k = accKey(a.act_id);
    const было = out.get(k);
    if (было) out.set(k, свести(было, a));
    else if (opts.membership !== "snapshot") out.set(k, изБазы(a));
  }
  return [...out.values()];
}

/** Compact field-level evidence for row tooltips and tests. */
export function fieldEvidence(a: UnifiedAccount, field: string): string {
  const e = a.fieldSources?.[field];
  if (!e) return "source unknown";
  return `${e.source}${e.observedAt ? ` · ${e.observedAt}` : ""}`;
}

/* ── группы по Business Manager ───────────────────────────────────────────── */

export interface BmGroup<T extends CloudAccount = CloudAccount> {
  /** Ключ для набора «раскрыто». Служебный префикс не столкнётся с настоящим id. */
  key: string;
  bmId: string | null;
  /** Что показывать в шапке: имя БМ, его id или подпись «БМ не приехал». */
  title: string;
  /** Имени нет, в заголовке стоит id — говорим об этом, а не выдаём id за имя. */
  isId: boolean;
  /** Кабинеты без БМ вовсе. Своя группа-хвост: прятать их нельзя, сливать с чужой
   *  тоже — «нет БМ» это факт о кабинете, а не отсутствие данных о группе. */
  noBm: boolean;
  accounts: T[];
  /** Потрачено, минорными единицами ОСНОВНОЙ валюты листа. Кабинеты в других валютах
   *  сюда не попадают: курса у нас нет, и сложить их значило бы выдумать число. */
  spent: number;
  /** Сколько кабинетов группы не в основной валюте. Обычно ноль. Не прячем: иначе
   *  сумма молча меньше, чем есть, и объяснить это будет нечем. */
  otherCurrency: number;
  counts: Record<StatusLabel, number>;
  /** Кабинеты без способа оплаты: залив с них не пойдёт, сколько бы ни было баланса.
   *  Считаются ТОЛЬКО те, у кого состояние вообще снимали. */
  noCard: number;
  /** Кабинеты, про оплату которых мы ничего не знаем. Отдельно от `noCard`, потому
   *  что «карты нет» и «не спрашивали» — разные утверждения, и второе не повод
   *  пугать владельца первым. */
  cardUnknown: number;
}

/** Валюта, в которой считается весь лист, — та, в которой БОЛЬШЕ ВСЕГО кабинетов.
 *
 *  Не «USD» константой, хотя на живом парке это он и есть. Владелец 14.08 сказал
 *  прямо, что валюты кроме доллара никому не нужны, и это правда про приоритет
 *  работы — но не повод показать сумму в донгах как доллары. Основную валюту
 *  выбираем счётом кабинетов и складываем только её; остальные считаем поштучно и
 *  говорим об этом одной строкой. Так и разгона на редкий случай нет, и вранья нет. */
export function dominantCurrency(rows: CloudAccount[] | null | undefined): string {
  const счёт = new Map<string, number>();
  for (const a of rows || []) {
    if (!a?.act_id) continue;
    const c = currencyOf(a);
    if (c === "?") continue;
    счёт.set(c, (счёт.get(c) || 0) + 1);
  }
  let лучшая = "USD";
  let сколько = 0;
  /* При равенстве побеждает код по алфавиту — чтобы порядок ключей объекта не решал,
     в какой валюте показан лист. */
  for (const [c, n] of [...счёт.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    if (n > сколько) {
      лучшая = c;
      сколько = n;
    }
  }
  return лучшая;
}

function emptyCounts(): Record<StatusLabel, number> {
  return { active: 0, disabled: 0, billing: 0, review: 0, unknown: 0 };
}

/** Кабинеты → группы по Business Manager, готовые к показу.
 *
 *  Группировка по `bm_id`, а не по имени: имена БМ повторяются (закупочные партии
 *  зовут одинаково), id — нет. Имя используется только как заголовок.
 *
 *  ПОРЯДОК ГРУПП — ПО ЧИСЛУ КАБИНЕТОВ, А НЕ ПО ДЕНЬГАМ, и это исправление, а не
 *  вкус. Сначала было по потраченному, и на живом наборе стало видно, во что это
 *  превращается: группа в донгах с 61 300 000 минорных единиц (около двух с
 *  половиной тысяч долларов) встала выше группы на 1227 долларов просто потому,
 *  что у донга минорных единиц больше. Складывать и сравнивать валюты нечем —
 *  курса у нас нет, — а порядок, который выглядит как «где больше денег» и им не
 *  является, врёт молча. Число кабинетов сравнимо всегда и ни на что не
 *  претендует; деньги видны в шапке каждой группы, глазу этого достаточно.
 *
 *  Кабинеты внутри группы — по потраченному: там валюта одна почти всегда, а если
 *  нет, порядок внутри десятка строк ничего не решает.
 *
 *  Группа-хвост «без БМ» всегда последняя, сколько бы в ней ни было: это не
 *  Business Manager, и стоять среди них ей не на каком основании. */
export function bmGroups<T extends CloudAccount>(
  rows: T[] | null | undefined,
  currency = dominantCurrency(rows),
): BmGroup<T>[] {
  const byKey = new Map<string, BmGroup<T>>();
  /* У снапшота БМ приезжает ОДНИМ полем — именем (`SnapshotAccount.business`), а у
     базы именем и id. Без этой карты один и тот же Business Manager давал бы две
     группы: одну по id (кабы, которые база уже сняла) и одну по имени (те, что
     видно только с мака). Имя, у которого где-то есть id, считаем тем же БМ. */
  const идПоИмени = new Map<string, string>();
  for (const a of rows || []) {
    if (a?.bm_id && a.bm_name && !идПоИмени.has(a.bm_name)) идПоИмени.set(a.bm_name, a.bm_id);
  }
  for (const a of rows || []) {
    if (!a || !a.act_id) continue;      // строка без тождества склеивать не с чем
    const id = a.bm_id || (a.bm_name ? идПоИмени.get(a.bm_name) : null) || null;
    const name = a.bm_name || null;
    const noBm = !id && !name;
    const key = noBm ? "__no_bm__" : `bm:${id || name}`;
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        bmId: id,
        title: name || id || "no business manager",
        /* Имя из одних цифр — это не имя, а тот же id, положенный Метой в поле
           имени. Помечаем и его, иначе заголовок «5510» читается как название
           компании. Тот же приём и та же причина, что на листе «Agencies». */
        isId: !!(id || name) && (!name || /^\d+$/.test(name)),
        noBm,
        accounts: [],
        cardUnknown: 0,
        spent: 0,
        otherCurrency: 0,
        counts: emptyCounts(),
        noCard: 0,
      };
      byKey.set(key, g);
    }
    g.accounts.push(a);
    g.counts[statusLabel(a.status || undefined)] += 1;
    /* Способ оплаты СЧИТАЕМ ТОЛЬКО ТАМ, ГДЕ СОСТОЯНИЕ ВООБЩЕ СНИМАЛИ. Пустое поле
       у кабинета, который ещё ни разу не опрашивали, значит «не знаем», а не «карты
       нет»; сложенное в счётчик, оно давало владельцу «нет карты на всём парке» при
       живых картах. Признак того, что снимали, — `status_checked_at`: демон ставит
       его ровно тогда, когда состояние приехало (`core/registry.record_accounts`). */
    if (a.status_checked_at) {
      if (!fundingText(a)) g.noCard += 1;
    } else {
      g.cardUnknown += 1;
    }
    if (currencyOf(a) === currency) {
      if (typeof a.amount_spent === "number" && Number.isFinite(a.amount_spent)) {
        g.spent += a.amount_spent;
      }
    } else {
      g.otherCurrency += 1;
    }
  }

  const groups = [...byKey.values()];
  /* ── ТЁЗКИ РАЗВОДЯТСЯ ID (#166) ─────────────────────────────────────────
     Группируем по id, а показываем имя — и на парке владельца это давало
     подряд четыре группы «BM NQ», четыре «2020» и три «BM TK VAN 1» с разным
     составом. Отличить их друг от друга было нечем: заголовок один и тот же,
     а кабинеты внутри разные.
     Замер по базе 15.08 (ВСЕ 268 кабинетов парка, поле `bm_name`): имя «2020»
     носят 31 РАЗНЫЙ Business Manager, «BM NQ» — 23, «BM TK VAN 1» — 10. То
     есть это не редкий случай, а обычай именования у поставщиков кабинетов.
     Дописываем id ТОЛЬКО тёзкам: у одиночной группы он был бы шумом. */
  const поИмени = new Map<string, number>();
  for (const g of groups) поИмени.set(g.title, (поИмени.get(g.title) || 0) + 1);
  for (const g of groups) {
    if (!g.noBm && (поИмени.get(g.title) || 0) > 1 && g.bmId) {
      /* Слово «id» в заголовке, а не просто второе число: имя «2020» само
         состоит из цифр, и «2020 · 400» читается как два имени подряд. С этим
         словом чип «id» рядом становится повтором — снимаем его, иначе на
         строке три указания на одно и то же. Увидено глазами на смотрелке. */
      g.title = `${g.title} · id ${g.bmId}`;
      g.isId = false;
    }
  }
  for (const g of groups) g.accounts.sort(bySpendIn(currency));
  groups.sort((x, y) => {
    if (x.noBm !== y.noBm) return x.noBm ? 1 : -1;
    if (x.spent !== y.spent) return y.spent - x.spent;
    return x.title.localeCompare(y.title);
  });
  return groups;
}

function currencyOf(a: CloudAccount): string {
  return (a.currency || "").toUpperCase() || "?";
}

/** Порядок кабинетов: где больше потрачено, то и выше.
 *
 *  Кабинет НЕ В ОСНОВНОЙ ВАЛЮТЕ уходит в конец, а не встаёт по своему числу. Это не
 *  пренебрежение, а единственный честный вариант: 61 300 000 донгов и 91 500 центов
 *  сравнивать нечем, курса у нас нет. Замер на смотрелке показал, во что обходится
 *  голое сравнение: вьетнамский кабинет на пару тысяч долларов встал первой строкой
 *  плоского списка, выше настоящего лидера, — и выглядело это как «вот где деньги».
 *  Ровно тот же промах, что был в порядке групп, просто вылез в другом месте.
 *
 *  Кабинет без спенда идёт ниже нулевого: ноль это факт («не тратил»), а пусто
 *  значит «не знаем». */
export function bySpendIn(currency: string) {
  const свой = (a: CloudAccount) => (currencyOf(a) === currency ? 0 : 1);
  return (a: CloudAccount, b: CloudAccount): number => {
    const sa = свой(a);
    const sb = свой(b);
    if (sa !== sb) return sa - sb;
    const x = typeof a.amount_spent === "number" ? a.amount_spent : -1;
    const y = typeof b.amount_spent === "number" ? b.amount_spent : -1;
    if (x !== y) return y - x;
    return a.act_id.localeCompare(b.act_id);
  };
}

/** Сводка показанного среза: сколько строк, сколько без карты, сколько денег.
 *
 *  ЗАЧЕМ ОТДЕЛЬНО ОТ `cloudTotals`. Тот считает итог, разложив список по
 *  Business Manager-ам, — а измерение БМ ушло с листа кабинетов целиком
 *  (решение владельца 17.08). Гонять строки через группировку, которую никто
 *  не показывает, ради двух чисел значит держать живым механизм без
 *  потребителя, и первый же рефакторинг снесёт его вместе с итогом.
 *
 *  ДВЕ ЗАЩИТЫ ЗДЕСЬ ОБЯЗАТЕЛЬНЫ, И ОБЕ УЖЕ ОПЛАЧЕНЫ:
 *
 *  1. `typeof === "number" && Number.isFinite` вместо `?? 0`. Кабинет, у
 *     которого спенда нет в данных, — это «не знаем», а не «не тратил».
 *     Сложенное нолём, незнание становится утверждением, и заметить это
 *     нельзя: итог выглядит настоящим. На эту форму в панели стоит сторож,
 *     обходящий ВЕСЬ `panel/` (`__tests__/totals-inherit-silence`): накопление,
 *     в котором отсутствие подменяется нулём прямо в сложении, он валит
 *     намеренно — и валит по ФОРМЕ СТРОКИ, поэтому её нельзя даже процитировать
 *     здесь в объяснение. Проверено: он поймал ровно эту цитату.
 *  2. `status_checked_at` делит «карты нет» и «не спрашивали». Без деления
 *     владелец получал «нет карты на всём парке» при живых картах.
 *
 *  Чужая валюта НЕ складывается и считается отдельно: курса у нас нет и мы его
 *  не выдумываем. Число таких кабинетов возвращается, чтобы сказать об этом
 *  вслух, — сумма, молча меньшая правды, необъяснима. */
export interface СводкаЛиста {
  accounts: number;
  noCard: number;
  cardUnknown: number;
  /** Потрачено в основной валюте, минорными единицами. */
  spent: number;
  otherCurrency: number;
}

export function сводкаЛиста(
  rows: CloudAccount[] | null | undefined,
  currency: string,
): СводкаЛиста {
  const out: СводкаЛиста = {
    accounts: 0, noCard: 0, cardUnknown: 0, spent: 0, otherCurrency: 0,
  };
  for (const a of rows || []) {
    if (!a || !a.act_id) continue;
    out.accounts += 1;
    if (a.status_checked_at) {
      if (!fundingText(a)) out.noCard += 1;
    } else {
      out.cardUnknown += 1;
    }
    if (currencyOf(a) === currency) {
      if (typeof a.amount_spent === "number" && Number.isFinite(a.amount_spent)) {
        out.spent += a.amount_spent;
      }
    } else {
      out.otherCurrency += 1;
    }
  }
  return out;
}

/** Итог по всему листу — те же счётчики, что у группы, без второй логики. */
export interface CloudTotals {
  accounts: number;
  businesses: number;
  counts: Record<StatusLabel, number>;
  noCard: number;
  cardUnknown: number;
  /** Потрачено в основной валюте листа, минорными единицами. */
  spent: number;
  /** Кабинетов не в основной валюте. Ноль в обычной жизни; больше нуля — повод
   *  сказать это вслух, потому что сумма выше их не включает. */
  otherCurrency: number;
}

export function cloudTotals(groups: BmGroup<CloudAccount>[]): CloudTotals {
  const totals: CloudTotals = {
    accounts: 0,
    /* Группа «без БМ» в счёт Business Manager-ов не идёт: это её отсутствие. */
    businesses: groups.filter((g) => !g.noBm).length,
    counts: emptyCounts(),
    noCard: 0,
    cardUnknown: 0,
    spent: 0,
    otherCurrency: 0,
  };
  for (const g of groups) {
    totals.accounts += g.accounts.length;
    totals.noCard += g.noCard;
    totals.cardUnknown += g.cardUnknown;
    totals.spent += g.spent;
    totals.otherCurrency += g.otherCurrency;
    for (const k of Object.keys(totals.counts) as StatusLabel[]) {
      totals.counts[k] += g.counts[k];
    }
  }
  return totals;
}

/* ── ПЛИТКИ СОСТОЯНИЙ: СУММА ЧАСТЕЙ ОБЯЗАНА СХОДИТЬСЯ (#166) ────────────────
 *
 * Владелец, глядя на свой экран входа: «145 ad accounts · 40 active · 99
 * disabled» — сорок плюс девяносто девять это 139, ШЕСТИ НЕТ, и узнать где
 * негде. Шесть нашлись в соседней плитке (billing), но вопрос он задал
 * правильный: набор плиток обязан ПОКРЫВАТЬ целое, иначе человек ищет
 * недостачу, которой нет, — или не находит ту, которая есть.
 *
 * Корзин пять (`account-status.StatusLabel`), а на экране их было четыре:
 * `review` не показывался НИГДЕ. Пока Мета никого не проверяет, сумма сходится
 * случайно; в день, когда первый кабинет уедет в PENDING_RISK_REVIEW, он
 * исчезнет с экрана молча — и это ровно та поломка, о которой спросил владелец,
 * только настоящая.
 *
 * Поэтому набор плиток теперь СЧИТАЕТСЯ, а не перечисляется руками, и сумма
 * проверяется тестом. Список, написанный руками, не знает про то, чего ещё нет.
 */

/** Одна плитка шапки: подпись, число, объяснение. */
export interface ПлиткаСостояния {
  key: string;
  value: number;
  hint: string;
}

/** Плитки состояний в порядке показа. Сумма их значений РАВНА числу кабинетов.
 *
 *  Нули у первых четырёх показываются намеренно: «not collected 0» означает
 *  «состояние снято у всех», и это ответ, а не пустое место. `review` — тот
 *  случай, когда нуля нет вовсе: корзина редкая, и плитка с нулём заняла бы
 *  строку ради «Мета сегодня никого не проверяет». Ноль в ней не теряет ничего:
 *  сумма остаётся равной целому. */
export function плиткиСостояний(counts: Record<StatusLabel, number>): ПлиткаСостояния[] {
  const плитки: ПлиткаСостояния[] = [
    /* «status ACTIVE», и НЕ «крутится»: Мета разрешает такому кабинету
       работать, но доставка — другой вопрос и другой экран. Подпись, обещающая
       больше статуса, врёт на каждом парке, где кампании стоят на паузе. */
    { key: "active", value: counts.active,
      hint: "status ACTIVE — Meta lets these run. It does not mean anything is "
            + "delivering right now: that is the campaigns list, not this count" },
    /* «banned», а не «disabled»: то же число в фильтрах уже называлось этим
       словом, и два слова на одно состояние заставляли искать между ними
       разницу. Слово выбрано владельцем — разбана у Меты не бывает. */
    { key: "banned", value: counts.disabled,
      hint: "DISABLED or PENDING_CLOSURE — Meta does not undo either" },
    { key: "billing", value: counts.billing,
      hint: "UNSETTLED or IN_GRACE_PERIOD — unpaid, not banned" },
    { key: "not collected", value: counts.unknown,
      hint: "status has never been collected for these — the counts above say "
            + "nothing about them" },
  ];
  if (counts.review) {
    плитки.splice(2, 0, {
      key: "under review", value: counts.review,
      hint: "PENDING_RISK_REVIEW, PENDING_APPEAL or TEMP_UNAVAILABLE — Meta is "
            + "looking at these: not banned, but nothing promised either",
    });
  }
  return плитки;
}

/** Плоский список — тот же набор строк без группировки, по потраченному.
 *
 *  Владелец 14.08: группировка по БМ должна быть переключателем, а не единственным
 *  видом. Это отдельная функция, а не «группы длиной один»: у плоского списка нет
 *  шапок, и рисовать их пустыми ради общего кода значило бы держать на экране ряд,
 *  который ничего не сообщает. */
export function flatAccounts<T extends CloudAccount>(
  rows: T[] | null | undefined,
  currency = dominantCurrency(rows),
): T[] {
  return (rows || []).filter((a) => a && a.act_id).slice().sort(bySpendIn(currency));
}

/* ── лимит трат и дневной лимит — РАЗНЫЕ ВЕЩИ ─────────────────────────────── */

/** Что показать в колонке лимита и что подписать под ней.
 *
 *  `spend_cap` — предел трат кабинета, который выставляют сами. Ноль у Меты значит
 *  «предел не задан», и это факт, а не молчание: отличать его от `null` обязательно.
 *
 *  `daily_limit_note` — про ДРУГОЕ: дневной лимит доверия (`adtrust_dsl`) токеном
 *  приложения не отдаётся вовсе, Мета этим полем роняет весь запрос целиком. Слить
 *  их в одну ячейку было бы ровно тем враньём, против которого заведён иссус #35:
 *  «предел не задан» и «дневной лимит этим путём не измеряется» — разные сообщения.
 *  Поэтому note живёт подписью-подсказкой, а не значением. */
export interface LimitCell {
  /** Готовая сумма, «not set» или прочерк. */
  text: string;
  /** Пояснение под курсор: почему пусто и чего здесь заведомо нет. */
  hint: string | null;
  /** Предел не задан — это состояние, а не пропуск: показать иначе, чем прочерк. */
  unset: boolean;
  /** Подпись рядом с суммой: чей это лимит. Пусто, когда показывать нечего.
   *
   *  Заведена вместе с общим листом (#121): в одной колонке встретились дневной
   *  лимит из снапшота и предел трат из базы, и без подписи «$250.00» читалось бы
   *  как дневной бюджет у кабинета, у которого это потолок за всё время. */
  suffix: "daily" | "lifetime" | null;
}

export function limitCell(a: CloudAccount & { daily_limit?: number | null }): LimitCell {
  const note = a.daily_limit_note || null;
  /* Дневной лимит показываем первым, когда он есть: колонка про день, и человек
     ищет глазами именно его. Есть он только у кабинетов, снятых с мака — токеном
     приложения `adtrust_dsl` не отдаётся вовсе и роняет весь запрос. */
  if (a.daily_limit !== null && a.daily_limit !== undefined) {
    return { text: money(a.daily_limit, a.currency), hint: note, unset: false, suffix: "daily" };
  }
  if (a.spend_cap === null || a.spend_cap === undefined) {
    return { text: DASH, hint: note, unset: false, suffix: null };
  }
  if (a.spend_cap === 0) {
    return { text: "not set", hint: note, unset: true, suffix: null };
  }
  return {
    text: money(a.spend_cap, a.currency),
    hint: note,
    unset: false,
    /* Предел трат — не дневной бюджет, и подписать его обязаны мы, а не
       догадливость читателя. */
    suffix: "lifetime",
  };
}

/* Слова о доставке: что Мета правда сказала про строку — человеческим языком.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ (#155). Владелец дословно: «Я не понимаю, что означает
 * derived, и я не понимаю, что для пользователя должно означать by parent».
 * В фильтре «not delivering» рядом со строкой светились два бейджа — `derived`
 * и `by parent`, — и оба являются НАШИМИ внутренними словами. Ни того, ни
 * другого нет ни в Ads Manager, ни в ответе Меты: `derived` — это имя нашего
 * поля `status_source`, а `by parent` — наш пересказ. Человек, который пришёл
 * из Ads Manager, узнать их не может в принципе, и бейдж, который он не узнаёт,
 * не отвечает ни на один его вопрос — он только сообщает, что тут что-то есть.
 *
 * ВОПРОСОВ У НЕГО РОВНО ЧЕТЫРЕ, и модуль отвечает на все четыре по отдельности:
 *
 *   1. идёт или не идёт            → `вердикт`
 *   2. почему не идёт              → `почему`, целой фразой
 *   3. как это называет Мета       → `код` и `кодСловами`, дословно
 *   4. дело в объекте или сверху   → `причина` + `гдеПричина`, словами
 *
 * ЧЕГО ЗДЕСЬ НЕ ДЕЛАЕТСЯ, И ЭТО ГЛАВНОЕ. Причина «выключен родитель» —
 * ЗАКОННАЯ, и убирать её нельзя. Проверено на живом проде 15.08 отдельно:
 * объявление, лежащее в выключенном адсете, ПОСЛЕ записи в Мету остаётся
 * `ADSET_PAUSED` — это факт от Меты, а не наша поломка и не наше намерение.
 * Мы показываем факт; переименовывается только слово, которым мы его зовём.
 *
 *
 * СЛОВАРЬ СОБРАН ПО ТОМУ, ЧТО ПРАВДА ПРИХОДИТ, А НЕ ИЗ ГОЛОВЫ
 *
 * Замер по живой базе владельца до правки (`ad`, 4048 строк, 15.08.2026):
 *
 *     status  | effective_status | штук
 *     (пусто) | (пусто)          | 2189   ← про доставку не знаем ничего
 *     ACTIVE  | DISAPPROVED      |  843
 *     ACTIVE  | ADSET_PAUSED     |  317
 *     ACTIVE  | ACTIVE           |  230
 *     PAUSED  | WITH_ISSUES      |  201   ← выключен И с проблемой, это ДВА факта
 *     ACTIVE  | CAMPAIGN_PAUSED  |  147
 *     PAUSED  | PAUSED           |   88
 *     PAUSED  | DISAPPROVED      |   25
 *     PAUSED  | PENDING_REVIEW   |    8
 *
 * У кампаний `status` пуст у всех 1050, у адсетов — у всех 3855, а
 * `effective_status` им сборщик не проставляет вовсе. То есть на двух уровнях
 * из трёх ЕДИНСТВЕННЫЙ факт о доставке — счёт доставляющихся объявлений под
 * строкой (`active_ads`), и словарь обязан уметь отвечать и без кода Меты.
 *
 * Сверх увиденного в словарь взяты остальные значения перечисления Меты
 * (`PENDING_BILLING_INFO`, `PREAPPROVED`, `IN_PROCESS`, `ARCHIVED`, `DELETED`)
 * — они документированы и приедут в первый же день, когда парк до них дойдёт.
 * Каждое помечено ниже: видели мы его своими глазами или пока только читали.
 *
 * И СЛОВАРЬ НЕ ЗАКРЫТЫЙ. Мета заводит новые значения молча, а список,
 * перечисленный руками, не знает про то, чего ещё нет. Незнакомый код НЕ
 * молчит и не выдаёт себя за понятый: он честно говорит «Мета называет это
 * так, объяснения у нас нет» и печатает само слово Меты — по нему человек
 * дойдёт до ответа сам. Тихо назвать незнакомое доставкой было бы худшим из
 * возможных исходов, потому что это единственный ответ, который человек не
 * пойдёт проверять.
 */
import type { CampaignRow, Level } from "./campaigns";

/** Идёт реклама или не идёт — то, за чем и открывают колонку Delivery.
 *
 *  Четыре ответа, а не два, и четвёртый обязателен: «выключено» и «включено,
 *  но не идёт» человек лечит по-разному, а «не знаем» нельзя сводить ни к
 *  тому, ни к другому — на двух уровнях из трёх это самое частое состояние. */
export type Вердикт = "delivering" | "off" | "not delivering" | "unknown";

/** Где сидит причина. Ровно тот вопрос, который стоял за `by parent`, только
 *  теперь у ответа есть все места, а не одно.
 *
 *  • `self`     — в самом объекте (его выключатель, его отклонение);
 *  • `adset`    — выключен адсет над ним;
 *  • `campaign` — выключена кампания над ним;
 *  • `below`    — сам объект включён, а не идёт то, что ПОД ним;
 *  • `unknown`  — причины не знаем. */
export type Причина = "self" | "adset" | "campaign" | "below" | "unknown";

/** Что мы знаем про одно значение `effective_status`. */
export interface ЗначениеМеты {
  /** Короткое человеческое имя состояния — то, чем это зовут в Ads Manager. */
  подпись: string;
  вердикт: Вердикт;
  /** Про какой УРОВЕНЬ говорит код. `self` уточняется под строку: у кампании
   *  `CAMPAIGN_PAUSED` — это про неё саму, а у объявления — про родителя. */
  причина: Причина;
  /** Что это значит и что с этим делать — фразой, без кода Меты внутри:
   *  код печатается рядом отдельно, и дублировать его в тексте незачем. */
  объяснение: string;
  /** Видели ли мы это значение в своей базе. `false` — знаем из описания Меты,
   *  но своими глазами не встречали. Поле не для экрана, а для того, чтобы
   *  следующий читатель не принял вычитанное за проверенное. */
  видели: boolean;
}

/** Значения `effective_status`, как их отдаёт Мета. Ключ — ровно её слово.
 *
 *  Порядок — по тому, сколько их в живой базе (счёт в шапке файла): сверху то,
 *  на что человек смотрит каждый день. */
export const СЛОВАРЬ_МЕТЫ: Record<string, ЗначениеМеты> = {
  ACTIVE: {
    подпись: "delivering",
    вердикт: "delivering",
    причина: "self",
    объяснение: "Meta is delivering this right now.",
    видели: true,
  },
  DISAPPROVED: {
    подпись: "rejected by Meta",
    вердикт: "not delivering",
    причина: "self",
    объяснение:
      "Meta reviewed this and turned it down, so it will not be shown to anyone. " +
      "Switching it on here changes nothing — the creative or the text has to be " +
      "changed, or the rejection appealed in Ads Manager.",
    видели: true,
  },
  ADSET_PAUSED: {
    подпись: "its ad set is off",
    вердикт: "not delivering",
    причина: "adset",
    объяснение:
      "This one is switched on, but the ad set above it is switched off, so Meta " +
      "delivers nothing. This is Meta’s own answer about it, not our guess, and it " +
      "stays that way after we write: switching this row on will be accepted and " +
      "still deliver nothing. Switch the ad set on instead.",
    видели: true,
  },
  WITH_ISSUES: {
    подпись: "has a problem",
    вердикт: "not delivering",
    причина: "self",
    объяснение:
      "Meta has flagged something about this object itself and is not delivering it. " +
      "Meta does not say what in this field — the ad account, the payment method or " +
      "the ad itself has to be opened in Ads Manager to see the issue.",
    видели: true,
  },
  CAMPAIGN_PAUSED: {
    подпись: "its campaign is off",
    вердикт: "not delivering",
    причина: "campaign",
    объяснение:
      "This one is switched on, but the campaign above it is switched off, so Meta " +
      "delivers nothing. This is Meta’s own answer about it, not our guess, and it " +
      "stays that way after we write: switching this row on will be accepted and " +
      "still deliver nothing. Switch the campaign on instead.",
    видели: true,
  },
  PAUSED: {
    подпись: "off",
    вердикт: "off",
    причина: "self",
    объяснение: "This one is switched off. Nothing above it is in the way.",
    видели: true,
  },
  PENDING_REVIEW: {
    подпись: "in review",
    вердикт: "not delivering",
    причина: "self",
    объяснение:
      "Meta is still reviewing this and has not started delivering it yet. Usually " +
      "a matter of hours; nothing has to be done, and switching it here will not " +
      "speed it up.",
    видели: true,
  },
  PENDING_BILLING_INFO: {
    подпись: "no payment method",
    вердикт: "not delivering",
    причина: "self",
    объяснение:
      "Meta has no working payment method for this ad account, so it will not spend " +
      "anything. Fixed in the ad account’s billing settings, not here.",
    видели: false,
  },
  PREAPPROVED: {
    подпись: "approved, not started",
    вердикт: "not delivering",
    причина: "self",
    объяснение:
      "Meta has approved this but has not started it: it is scheduled for later. " +
      "Nothing is wrong; delivery begins on its own at the start date.",
    видели: false,
  },
  IN_PROCESS: {
    подпись: "processing",
    вердикт: "not delivering",
    причина: "self",
    объяснение:
      "Meta is still processing the last change to this object. A temporary state — " +
      "it resolves by itself within minutes, and nothing has to be done.",
    видели: false,
  },
  ARCHIVED: {
    подпись: "archived",
    вердикт: "off",
    причина: "self",
    объяснение:
      "This one is archived. Meta does not deliver archived objects and does not " +
      "hand them back — it cannot be switched on from here.",
    видели: false,
  },
  DELETED: {
    подпись: "deleted",
    вердикт: "off",
    причина: "self",
    объяснение:
      "This one is deleted. Meta does not deliver deleted objects and does not hand " +
      "them back — it cannot be switched on from here.",
    видели: false,
  },
};

/** Код Меты словами: `ADSET_PAUSED` → `adset paused`.
 *
 *  Печатается РЯДОМ с человеческой подписью, а не вместо неё. Смысл — сверка:
 *  по этому слову человек находит ту же строку в Ads Manager и в поиске по
 *  ошибкам Меты, а по нашей подписи — не находит ничего. Именно этим наш
 *  собственный `derived` и был плох. */
export function кодСловами(код?: string | null): string {
  return (код || "").toLowerCase().replace(/_/g, " ");
}

/** Всё, что панель имеет право сказать о доставке одной строки. */
export interface СловаОДоставке {
  вердикт: Вердикт;
  причина: Причина;
  /** Короткая подпись бейджа. Никогда не пустая: пустой бейдж читается как
   *  «панель не работает», а «не знаем» — это тоже ответ, и он у нас есть. */
  подпись: string;
  /** Целая фраза под курсор: что происходит, почему и что с этим делать. */
  почему: string;
  /** Слово Меты как есть, `null` — она про эту строку ничего не говорила. */
  код: string | null;
  /** Оно же для чтения глазами. Пусто, когда кода нет. */
  словами: string;
  /** Знаем ли мы, что этот код значит. `false` — код от Меты новый, подпись
   *  собрана из него самого, а объяснения у нас нет. Врать про него мы не
   *  начинаем, но и молчать не имеем права. */
  известен: boolean;
}

/** Про какой уровень говорит код — С ОГЛЯДКОЙ НА УРОВЕНЬ САМОЙ СТРОКИ.
 *
 *  `CAMPAIGN_PAUSED` у объявления значит «родитель выключен», а у самой
 *  кампании — «выключена она сама». Один и тот же код, две разные новости и
 *  два разных действия. Без этой поправки строка кампании сообщала бы человеку
 *  «выключено что-то сверху», а сверху у кампании ничего нет. */
function уточнить(причина: Причина, уровень: Level): Причина {
  if (причина === "adset" && уровень === "adset") return "self";
  if (причина === "campaign" && уровень === "campaign") return "self";
  return причина;
}

/** Где сидит причина — словами, готовыми к вставке в предложение.
 *
 *  Отдельной функцией, потому что это ровно тот вопрос, ради которого писался
 *  иссус: «связано ли это с самим объектом или с родителем». Ответ обязан быть
 *  фразой, а не термином, и обязан существовать для каждого случая. */
export function гдеПричина(причина: Причина, уровень: Level): string {
  switch (причина) {
    case "self":
      return `in this ${СЛОВО_УРОВНЯ[уровень]} itself`;
    case "adset":
      return "in the ad set above it";
    case "campaign":
      return "in the campaign above it";
    case "below":
      return `in what sits under this ${СЛОВО_УРОВНЯ[уровень]}`;
    default:
      return "we do not know where";
  }
}

/** Уровень человеческим словом. `adset` в одно слово никто вслух не говорит. */
export const СЛОВО_УРОВНЯ: Record<Level, string> = {
  campaign: "campaign",
  adset: "ad set",
  ad: "ad",
};

/** Доставка одной строки — целиком, одним ответом.
 *
 *  Порядок разбора важен и идёт от самого твёрдого факта к самому слабому:
 *
 *   1. Мета сказала про доставку прямо (`effective_status`) — верим ей;
 *   2. не сказала, но объект выключен нами — это ответ, и он полный;
 *   3. не сказала, объект включён, а под ним НОЛЬ доставляющихся объявлений —
 *      «включено, а не идёт», и это счёт сборщика, а не догадка;
 *   4. ничего из перечисленного — честное «не знаем».
 *
 *  Шаг 3 существует потому, что на живом парке `effective_status` есть только
 *  у объявлений: у 1050 кампаний и 3855 адсетов его нет ни у одной строки. Без
 *  него лист отвечал бы на главный вопрос («включил, а не крутится») только на
 *  нижнем уровне — то есть не отвечал бы. */
export function доставка(r: CampaignRow): СловаОДоставке {
  const уровень = r.level;
  const переключатель = (r.status || "").toUpperCase();
  const код = (r.effective_status || "").toUpperCase() || null;

  if (код) {
    const знание = СЛОВАРЬ_МЕТЫ[код];
    const словами = кодСловами(код);

    if (!знание) {
      /* НОВОЕ СЛОВО МЕТЫ. Не доставка — потому что доставка у Меты называется
         ровно одним словом, `ACTIVE`, и всё остальное её отрицает. Но и
         объяснять то, чего мы не знаем, мы не будем: печатаем слово Меты и
         прямо говорим, что перевода у нас нет. Человек с этим словом дойдёт
         до ответа сам; с нашей выдумкой — не дошёл бы никуда. */
      return {
        вердикт: "not delivering",
        причина: "unknown",
        подпись: словами,
        почему:
          `Meta calls the delivery state of this ${СЛОВО_УРОВНЯ[уровень]} ` +
          `“${словами}”. That is Meta’s own word and it is new to us — we have no ` +
          `plain-language explanation for it yet. It is not “active”, so nothing is ` +
          `being delivered; look the word up in Ads Manager to see why.`,
        код,
        словами,
        известен: false,
      };
    }

    const причина = уточнить(знание.причина, уровень);
    /* ВЫКЛЮЧАТЕЛЬ ЧЕЛОВЕКА СТАРШЕ ЖАЛОБЫ МЕТЫ — но только в вердикте.
       На живой базе 234 строки, где `status = PAUSED`, а Мета рассказывает не
       про выключатель, а про отклонение или проблему (`WITH_ISSUES` 201,
       `DISAPPROVED` 25, `PENDING_REVIEW` 8). Назвать такую строку «включено, а
       не идёт» значит поспорить с тем самым списком, в котором она лежит:
       фильтр «не доставляется» считает по включённым, и эта строка стоит в
       «на паузе». Бейдж, спорящий с фильтром, читается как поломка панели.
       Жалоба Меты при этом НЕ теряется: она остаётся подписью, кодом и целой
       фразой — просто вердикт называет главное, а выключено оно нами.
       Исключение одно: Мета говорит, что доставка ИДЁТ. Тогда наш `status`
       протух, и верить надо ей — она смотрит на факт, а мы на свою запись. */
    const вердикт: Вердикт =
      переключатель === "PAUSED" && знание.вердикт !== "delivering"
        ? "off"
        : знание.вердикт;
    return {
      вердикт,
      причина,
      подпись: знание.подпись,
      почему: собратьФразу(r, знание),
      код,
      словами,
      известен: true,
    };
  }

  /* Кода нет. Дальше — только то, что знаем сами. */

  if (переключатель === "PAUSED") {
    return {
      вердикт: "off",
      причина: "self",
      подпись: "off",
      почему:
        `This ${СЛОВО_УРОВНЯ[уровень]} is switched off, so nothing under it is ` +
        `delivering. Meta has not been asked about its delivery separately — with ` +
        `the switch off there is nothing to ask about.`,
      код: null,
      словами: "",
      известен: true,
    };
  }

  if (переключатель === "ACTIVE" && r.active_ads === 0) {
    /* «Включено, а не идёт» БЕЗ слова Меты. Это не догадка: сборщик считает
       доставляющиеся объявления по их собственному `effective_status`, то есть
       ноль здесь — такой же ответ Меты, просто собранный уровнем ниже.
       Почему причины мы при этом не называем: она лежит в детях, у каждого
       своя, и одного ответа на всю строку не существует. Сказать «не идёт и
       смотри ниже» — правда; назвать причину — выдумка. */
    return {
      вердикт: "not delivering",
      причина: "below",
      подпись: "nothing running under it",
      почему:
        `This ${СЛОВО_УРОВНЯ[уровень]} is switched on, but not one ad under it is ` +
        `delivering right now. Meta does not report a delivery state for a ` +
        `${СЛОВО_УРОВНЯ[уровень]} itself, so the reason is one level down — open it ` +
        `and look at the ads: each carries its own answer from Meta.`,
      код: null,
      словами: "",
      известен: true,
    };
  }

  if (переключатель === "ACTIVE" && typeof r.active_ads === "number") {
    return {
      вердикт: "delivering",
      причина: "self",
      подпись: "delivering",
      почему:
        `This ${СЛОВО_УРОВНЯ[уровень]} is switched on and ${r.active_ads} ad(s) ` +
        `under it are delivering right now. Counted from what Meta says about those ` +
        `ads, not from the switches.`,
      код: null,
      словами: "",
      известен: true,
    };
  }

  /* Ни слова Меты, ни выключателя, ни счёта. Так выглядят 2189 объявлений
     живой базы, до которых сбор ещё не дошёл, — больше половины парка. «Не
     знаем» здесь и есть правильный ответ, и он обязан отличаться от «выключено»
     на экране: выключенное чинят выключателем, а несобранное — ожиданием. */
  return {
    вердикт: "unknown",
    причина: "unknown",
    подпись: "not collected yet",
    почему:
      `We do not know whether this ${СЛОВО_УРОВНЯ[уровень]} is delivering: the ` +
      `collector has not brought its state from Meta yet. This is not “off” and not ` +
      `“broken” — it fills in on the next round.`,
    код: null,
    словами: "",
    известен: true,
  };
}

/** Фраза под курсор для КОДА, который мы понимаем.
 *
 *  Собирается, а не лежит готовой, потому что к объяснению состояния почти
 *  всегда нужно добавить второй факт про ту же строку — и он не выводится из
 *  кода Меты. */
function собратьФразу(r: CampaignRow, знание: ЗначениеМеты): string {
  const уровень = СЛОВО_УРОВНЯ[r.level];
  const переключатель = (r.status || "").toUpperCase();
  const голова = `Meta’s delivery state for this ${уровень} is “${знание.подпись}”. `;

  /* ВЫКЛЮЧЕН И С ПРОБЛЕМОЙ — ЭТО ДВА РАЗНЫХ ФАКТА, и на живой базе это 201
     объявление плюс 25 отклонённых: `status = PAUSED`, а Мета при этом
     рассказывает не про выключатель, а про отклонение или проблему. Показать
     только «off» значило бы спрятать то, что вылезет в ту же секунду, когда
     человек нажмёт «включить», — и он решит, что сломалась панель. */
  if (переключатель === "PAUSED" && знание.вердикт !== "off") {
    return (
      голова +
      знание.объяснение +
      ` The switch here is off as well, so nothing is running either way — but ` +
      `Meta’s complaint does not go away with the switch: it will be waiting when ` +
      `this ${уровень} is switched back on.`
    );
  }

  /* Родителю отдельной ветки не нужно: действие «нажми вот там» уже стоит в
     самом объяснении кода, потому что оно разное у адсета и у кампании, а
     «нажми не здесь» без «нажми вот там» — половина ответа. */
  return голова + знание.объяснение;
}

/** Целая подсказка под курсор: объяснение ПЛЮС дословное слово Меты.
 *
 *  Отдельно от `почему`, потому что это два разных обязательства. `почему`
 *  отвечает человеку на его языке; слово Меты — единственный мостик к Ads
 *  Manager и к поиску по её ошибкам, и потерять его значит заменить один
 *  непонятный ярлык другим, только своим. Ровно этим и был плох `derived`.
 *
 *  Собирается ЗДЕСЬ, а не во вьюхе: склей вьюха эти две части сама — и у
 *  продукта появилось бы второе место, решающее, как назвать состояние. */
export function подсказка(д: СловаОДоставке): string {
  if (!д.словами) return д.почему;
  return `${д.почему} Meta’s own word for this state is “${д.словами}” — that is ` +
    `what you will see in Ads Manager.`;
}

/* ── откуда взято состояние ─────────────────────────────────────────────── */

/** То, что раньше звалось бейджем `derived`.
 *
 *  `status_source` — имя НАШЕГО поля, и человеку оно не говорит ничего. Факт же
 *  под ним настоящий и важный: у кампаний и адсетов в базе собственный `status`
 *  пуст (у всех 1050 и всех 3855), и состояние выведено из того, как
 *  доставляются их объявления. Мета говорит про родителя прямым текстом
 *  (`CAMPAIGN_PAUSED`, `ADSET_PAUSED`), так что это не эвристика — это её же
 *  ответ, собранный уровнем ниже. Но это и не то же самое, что спросить про сам
 *  объект, а по этой строке человек решает, что тушить.
 *
 *  `null` — говорить нечего: состояние снято у Меты напрямую. */
export function откудаСостояние(
  r: CampaignRow,
): { подпись: string; почему: string } | null {
  const уровень = СЛОВО_УРОВНЯ[r.level];

  if (r.status_source === "derived") {
    return {
      подпись: "read from its ads",
      почему:
        `Meta was not asked about this ${уровень} itself — the collector has not ` +
        `walked this level yet. Its state is read from its ads instead: Meta tags ` +
        `every ad with which level above it is switched off, so this is still Meta’s ` +
        `answer, just collected one level down. Switching still writes to Meta ` +
        `directly and works normally.`,
    };
  }

  if (r.status_source === "unknown" || (!r.status && !r.status_source)) {
    return {
      подпись: "state not collected",
      почему:
        `We do not know whether this ${уровень} is switched on: the collector has ` +
        `not brought its state, and its ads do not say either. Nothing is written ` +
        `over a state we have not read.`,
    };
  }

  return null;
}

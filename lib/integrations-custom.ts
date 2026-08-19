/**
 * Custom Integration — документация для самописного источника (иссус #126).
 *
 * ПОЧЕМУ ЭТО ОТДЕЛЬНЫЙ ТИП, А НЕ СЕДЬМОЙ `Vendor`. У вендора есть состояние
 * подключения, и оно обязано быть честным. У «своего трекера» состояния нет
 * и быть не может: подключать нечего, пока человек не написал модуль.
 * Впихнуть его в общий список значило бы либо нарисовать ему вечное «не
 * подключено» (неправда — это не поломка и не незавершённая настройка), либо
 * завести под него четвёртое состояние, которое ничего не описывает.
 *
 * ПОЧЕМУ ОНО ВООБЩЕ ВИДНО, ПОКА ПОДКЛЮЧАТЬ НЕЧЕГО. Прямое требование
 * владельца, высокий приоритет: место под самописный источник должно быть
 * ВИДНО. Список из шести чужих имён читается как «поддерживается только
 * это»; у байера трекер часто свой, и он должен с первого экрана понимать,
 * что дверь для него есть, а не писать в поддержку с вопросом.
 *
 * Всё, что ниже, списано с живого интерфейса движка (`core/sources/base.py`)
 * и с двух написанных по нему адаптеров — это не пожелания, а то, чему
 * модуль обязан соответствовать, чтобы его цифры легли в общую воронку.
 */

/** Шаг документации: что ответить и почему именно так. */
export interface DocStep {
  /** Имя метода/поля интерфейса — тем же словом, что в движке. */
  name: string;
  title: string;
  body: string;
}

export interface CustomIntegrationDoc {
  title: string;
  blurb: string;
  /** Куда кладётся модуль. Строка кода, а не проза: её копируют. */
  where: string;
  steps: readonly DocStep[];
  /** Правила, нарушение которых не ломает сборку, а тихо портит цифры. */
  rules: readonly string[];
  /** Чего не хватает СЕГОДНЯ, чтобы это было самообслуживанием. */
  missing: readonly string[];
}

export const CUSTOM_INTEGRATION: CustomIntegrationDoc = {
  title: "Custom integration",
  /* Одна строка, а не абзац (#157): наверху карточки нужна дверь, а не
     инструкция — инструкция лежит под раскрывашкой строкой ниже. */
  blurb:
    "Your tracker or CRM does not have to be on this list. A source is one module in the engine; collection, funnel and dashboard then work the same as for the built-in ones.",
  where: "core/sources/<your_source>.py",
  steps: [
    {
      name: "levels",
      title: "Which levels it reports",
      body:
        "Campaign, ad set, ad — or fewer, if your source only knows some of them. A level you do not report is simply absent; it is not reported as zero.",
    },
    {
      name: "url",
      title: "How to ask it for a report",
      body:
        "Build the address for one level and one date range. The module builds the request but never goes to the network itself — who fetches it is the caller's business, and that is what makes a module testable against a recorded sample instead of a live panel.",
    },
    {
      name: "parse",
      title: "How its answer becomes our rows",
      body:
        "Turn the payload into rows of scope_level, scope_name, sub, contact, checkout, ftd, rd, revenue. A step your source does not measure comes back empty — never zero.",
    },
    {
      name: "join_by",
      title: "What identifies the ad",
      body:
        "Either the ad name, or a sub id carried by the link's url_params. Sub id is the sturdier of the two: a tracker sees what the link brought it, not what Facebook called the ad.",
    },
  ],
  rules: [
    "A silent zero is worse than a missing value. If the source does not measure a funnel step, leave it empty — a zero reads as «nobody deposited today», and that is a different sentence.",
    "Addresses and keys are settings, never code. Every buyer has their own domain, their own key, and their own sub id layout; a value hardcoded in the module is a module that only works for one person.",
    "Fail loudly when the answer is not a report. An expired key, a redirect to a login page, or a truncated report must raise — an empty list means «no traffic that day», and the two must never be confused.",
    "Test against a recorded sample. Put a real response in tests/fixtures and assert the parsed rows; a module proven only against a live panel cannot be re-checked after it changes.",
  ],
  missing: [
    "There is no way to add a source from the panel. A custom integration today means a Python module in the engine and a deploy — the panel cannot load code you upload, and it should not pretend otherwise.",
    "There is no endpoint to store its settings, so a custom source keeps its address and key in the engine's own configuration for now.",
  ],
};

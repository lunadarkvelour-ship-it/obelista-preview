/**
 * Трекеры и CRM — по модулю на вендора (иссус #126, раздел первый).
 *
 * КАЖДЫЙ ВЕНДОР — ОДНА КОНСТАНТА И ОДНА СТРОКА В `TRACKERS`. Больше нигде в
 * панели его имени нет: ни в карточке, ни в листе, ни в стилях. Это и есть
 * обещание иссуса «добавление нового трекера = новый модуль» с фронтовой
 * стороны, и оно проверяется тестом, который ищет имена вендоров в исходнике
 * карточки (`lib/__tests__/integrations.test.ts`).
 *
 * ОТКУДА ВЗЯТЫ ПОЛЯ. Не из головы: у Keitaro и Binom адаптеры уже написаны
 * (иссус #24, ветки `issue-24-adapter-keitaro` и `issue-24-adapter-binom`),
 * и ключи настройки здесь — те самые, которые читает конструктор адаптера.
 * У остальных четырёх адаптера НЕТ, и списка полей здесь тоже нет: набор
 * настроек решает адаптер, а придуманный вперёд список — это форма, которая
 * просит не то, что понадобится. Пустой список полей с объяснением честнее
 * заполненного наугад.
 *
 * Своего трекера владельца среди этих шести нет намеренно (иссус #19): кит
 * едет чужому человеку одинаковым, и чьё-то личное подключение не может быть
 * записано в продукт строкой.
 */

import type { Vendor } from "@/lib/integrations";

/* --- Модуль: Binom -------------------------------------------------------- */

const BINOM: Vendor = {
  id: "binom",
  name: "Binom",
  mark: "Bn",
  section: "trackers",
  kindLabel: "Tracker",
  // Подпись — ОДНА строка (#157). Чем сшивается и что доезжает, стоит чипами
  // рядом: повторять это словами значит писать вдвое и разъезжаться вдвое.
  summary: "Reads a daily report per campaign, ad set and ad.",
  support: "written",
  supportNote:
    "Written for issue #24 on branch issue-24-adapter-binom, not merged. Its request was assembled from public documentation and the response shape is a guess — nobody here has ever had access to a live Binom panel, so the first real connection will almost certainly correct it.",
  joinBy: "subid",
  // Подписка считается без настройки, остальные шаги — только статусами
  // конверсий, которые заводит сам байер. Повторного депозита в отчёте Binom
  // нет вообще, поэтому его нет и здесь: нарисовать по нему ноль значило бы
  // показать честный ноль там, где данных попросту не собирают.
  gives: ["sub", "contact", "checkout", "ftd", "revenue"],
  fields: [
    { key: "url", label: "Tracker address", kind: "url", required: true, hint: "The domain your Binom panel lives on, e.g. https://track.example.com — everything goes through one arm.php entry point." },
    { key: "api_key", label: "API key", kind: "secret", required: true, hint: "From the Binom panel's own settings. Stored on the server, never in the browser." },
    { key: "subs", label: "Sub id slots", kind: "text", required: false, hint: "Which sub_id slot carries the campaign, the ad set, and the ad. Defaults to 1/2/3 — change it if your link is built differently." },
    { key: "fields", label: "Conversion status columns", kind: "text", required: false, hint: "Names of the conversion statuses that stand for contact, checkout, and first deposit. You named them when you set the statuses up; we cannot guess them." },
    { key: "timezone", label: "Report timezone", kind: "text", required: false, hint: "The timezone the tracker closes its day in. Defaults to UTC — a wrong one moves evening traffic into the previous day, silently." },
    { key: "date_preset", label: "Custom range code", kind: "text", required: false, hint: "The code Binom uses for «custom range». It differs between versions, so it is a setting, not a constant in our code." },
  ],
  fieldsNote:
    "Address and key are required; the rest have defaults that are safe to leave alone until numbers look wrong.",
};

/* --- Модуль: Keitaro ------------------------------------------------------ */

const KEITARO: Vendor = {
  id: "keitaro",
  name: "Keitaro",
  mark: "Kt",
  section: "trackers",
  kindLabel: "Tracker",
  summary: "Builds a daily report over the Admin API for each level.",
  support: "written",
  supportNote:
    "Written for issue #24 on branch issue-24-adapter-keitaro, not merged. Its request follows the documented Admin API; the sample response it was tested against is synthetic, because we have no live Keitaro panel.",
  joinBy: "subid",
  // Контакт и чекаут живут в CRM и до трекера не доезжают вовсе, а повторный
  // деп Keitaro не отличает от первого — он приходит тем же статусом sale.
  gives: ["sub", "ftd", "revenue"],
  fields: [
    { key: "url", label: "Tracker address", kind: "url", required: true, hint: "The domain your Keitaro panel lives on, e.g. https://track.example.org." },
    { key: "api_key", label: "API key", kind: "secret", required: true, hint: "From the Keitaro panel. It travels in a header, never in the address — addresses end up in logs and error texts." },
    { key: "subs", label: "Sub id slots", kind: "text", required: false, hint: "Which of sub_id_1..sub_id_30 carries the campaign, the ad set, and the ad. Defaults to 1/2/3." },
    { key: "timezone", label: "Report timezone", kind: "text", required: false, hint: "Keitaro closes its day in its own timezone. Ask for a different one and the daily numbers drift apart from ours, quietly." },
    { key: "filters", label: "Report filters", kind: "text", required: false, hint: "Optional narrowing of the report, in Keitaro's own filter format." },
    { key: "limit", label: "Row limit", kind: "text", required: false, hint: "Keitaro truncates a long report silently. We ask with an explicit limit and refuse to store a report that hits it." },
  ],
  fieldsNote:
    "Address and key are required; the rest have defaults that are safe to leave alone until numbers look wrong.",
};

/* --- Модуль: Voluum ------------------------------------------------------- */

const VOLUUM: Vendor = {
  id: "voluum",
  name: "Voluum",
  mark: "Vl",
  section: "trackers",
  kindLabel: "Tracker",
  summary: "Named in the spec as a default tracker.",
  support: "none",
  supportNote:
    "No adapter file exists. Issue #24 covers Keitaro and Binom only; Voluum was named in the spec but nobody has written the module that asks it for a report.",
  fields: [],
  fieldsNote:
    "What Voluum will ask for is decided by its adapter, and there is no adapter yet. Listing fields here would be a guess dressed as a form.",
};

/* --- Модуль: MVP Project -------------------------------------------------- */

const MVP_PROJECT: Vendor = {
  id: "mvp_project",
  name: "MVP Project",
  mark: "MV",
  section: "trackers",
  summary: "Requested by name as a funnel source.",
  support: "none",
  supportNote:
    "No adapter file exists, and nothing in the engine knows what this source is or what it returns. Classifying it here from its name alone would be a guess printed as a fact.",
  fields: [],
  fieldsNote:
    "Fields come from the adapter, and there is no adapter yet.",
};

/* --- Модуль: Kosher Track ------------------------------------------------- */

const KOSHER_TRACK: Vendor = {
  id: "kosher_track",
  name: "Kosher Track",
  mark: "Ko",
  section: "trackers",
  kindLabel: "Tracker",
  summary: "Requested by name as a funnel source.",
  support: "none",
  supportNote:
    "No adapter file exists. Nothing in the engine can ask it for a report yet.",
  fields: [],
  fieldsNote:
    "Fields come from the adapter, and there is no adapter yet.",
};

/* --- Модуль: Chatterfy ---------------------------------------------------- */

const CHATTERFY: Vendor = {
  id: "chatterfy",
  name: "Chatterfy",
  mark: "Ch",
  section: "trackers",
  summary: "Requested by name as a funnel source.",
  support: "none",
  supportNote:
    "No adapter file exists. Whether it carries dialogs, contacts, or payments is a question for its adapter, not for this card.",
  fields: [],
  fieldsNote:
    "Fields come from the adapter, and there is no adapter yet.",
};

/**
 * Реестр раздела. Порядок — по готовности, а не по алфавиту: то, что ближе
 * всего к работе, стоит выше, иначе человек читает шесть одинаковых карточек
 * и не видит, с какой из них вообще есть смысл начинать.
 */
export const TRACKERS: readonly Vendor[] = [
  KEITARO,
  BINOM,
  VOLUUM,
  MVP_PROJECT,
  KOSHER_TRACK,
  CHATTERFY,
];

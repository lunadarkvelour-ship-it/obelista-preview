/* Не проверка, а СМОТРЕЛКА: рисует лист кабинетов в статический HTML, чтобы на него
 * можно было посмотреть глазами.
 *
 * ЗАЧЕМ ЭТО ВООБЩЕ ЕСТЬ. 13.08 двенадцать листов уехали в PR, закрытые только
 * тестами и типами: ни один никто не видел, и это оказалось дороже любой правки в
 * них. Посмотреть на маке нечем — `npm run dev` и `next build` там запрещены, они
 * ломают общий `.next` живой панели под launchd и съедают память машины на 16 ГБ.
 * Облако за basic auth, и до деплоя листа там нет вовсе.
 *
 * Vitest — единственный настроенный в панели запускальщик TS/JSX, поэтому смотрелка
 * лежит рядом с тестами и по их правилам именования. Без `PREVIEW_OUT` она ничего
 * не рисует, но и не молчит: печатает, как её запустить.
 *
 * Как пользоваться:
 *
 *   PREVIEW_OUT=/tmp/cab.html npx vitest run lib/__tests__/preview-cloud-accounts.test.ts
 *
 * Стили страница берёт у ЖИВОЙ панели на 8790 — своей сборки у неё нет. Отсюда
 * ограничение, о котором надо помнить: Tailwind кладёт в собранный CSS только те
 * классы, которые видел в исходниках НА МОМЕНТ ТОЙ СБОРКИ. Новый класс, которого в
 * панели ещё нигде нет, здесь не покрасится — и это не баг вёрстки. Проверять на
 * смотрелке имеет смысл раскладку и то, как читается текст, а не единственный в
 * своём роде оттенок.
 */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  dominantCurrency, unifiedAccounts, сводкаЛиста,
  type CloudAccountRow,
} from "../cloud-accounts";
import { AccountsTable, SummaryLine } from "@/components/views/AccountsView";
import { РЯД, поРяду } from "@/lib/accounts-sort";

/* Набор нарочно недобрый: в нём есть всё, на чём лист обычно врёт. Ноль баланса
   против отсутствующего, предел «не задан» против неизвестного, каб без карты,
   каб без имени, каб без БМ, статус, которого нет в словаре, и вторая валюта. */
/* НАСТОЯЩАЯ строка бэкенда, дословно из `core/fbspend.DAILY_LIMIT_NOTE`, а не мой
   английский пересказ. Первая редакция подставляла сюда собственный перевод — и
   этим СКРЫЛА дефект, ради которого смотрелка и заведена: русский текст в
   английском интерфейсе. Инструмент проверки соврал в ту же сторону, что и тесты.

   Правило: смотрелка показывает то, что ПРИДЁТ с бэкенда, а не то, что хотелось бы
   там видеть. Мок, который «улучшает» данные, перестаёт быть глазами и становится
   зеркалом. */
const NOTE = "токен приложения не отдаёт дневной лимит (adtrust_dsl) — нужна сессия браузера Ads Manager";
const T = "2026-08-14T09:12:00+00:00";

/* Колонки смотрелка задаёт сама: в живом листе их ширины тянутся мышью и живут в
   сторе, а у статической страницы стора нет. Набор тот же, что в `AccountsView`. */
const COLS = [
  { id: "cab", title: "ad account", w: 340 },
  { id: "soc", title: "profile", w: 210 },
  { id: "spend", title: "spend", w: 120, right: true },
  { id: "pay", title: "billing", w: 150 },
  { id: "pixel", title: "pixel", w: 220 },
];

/* Соцы у части строк — это ОБЛАЧНЫЙ арендатор, каким его видит база. Четыре
   состояния строки должны быть видны на смотрелке рядом: отмечается / токен
   есть, а окна в антидетекте нет / соцы известны, но токена нет / соцев не
   знаем вовсе. Иначе разницу между «не знаем» и двумя разными «нечем лить»
   проверить нечем: на живом проде свежая учётка пуста по построению.

   Третья строка — не выдумка, а живой парк владельца после переезда с AdsPower
   на ShardX: токен остался под прежним ключом `k1*`, окно завелось новым UUID. */
const rows: CloudAccountRow[] = [
  { act_id: "act_1762249281465160", name: "MB3 · hiu · 04", bm_id: "1178", bm_name: "Zenith Media Group",
    currency: "USD", status: "ACTIVE", balance: 0, amount_spent: 184_23, spend_cap: 0,
    funding_display_string: "Visa · 4417", daily_limit_note: NOTE, status_checked_at: T },
  { act_id: "act_1574869187497859", name: "MB3 · hiu · 07", bm_id: "1178", bm_name: "Zenith Media Group",
    currency: "USD", status: "DISABLED", disable_reason: "политика рекламы", balance: 1240, amount_spent: 91_500,
    spend_cap: 250_000, funding_display_string: "Visa · 4417", daily_limit_note: NOTE, status_checked_at: T },
  { act_id: "act_1099238471002934", name: "MB3 · hiu · 11", bm_id: "1178", bm_name: "Zenith Media Group",
    currency: "USD", status: "UNSETTLED", balance: 0, amount_spent: 12_800, spend_cap: null,
    daily_limit_note: NOTE, status_checked_at: "2026-08-14T05:40:00+00:00" },
  /* Живое окно И токен: строка ОТМЕЧАЕТСЯ, рядом с id стоит щит. */
  { act_id: "act_8871220034556677", name: "SOC3 · spx · 02", bm_id: "9042", bm_name: "Larkspur Trading Ltd",
    currency: "USD", status: "ACTIVE", balance: 47_10, amount_spent: 33_940, spend_cap: 0,
    funding_display_string: "Mastercard · 8812", daily_limit_note: NOTE, status_checked_at: T,
    owners: [{ profile_id: "00076f0a-4c31-4a0e-9b21-71f0a0d8c211", name: "17/7 spx",
               oauth: true, in_antidetect: true }] },
  /* Соцы известны, токена нет ни у одного: чекбокс погашен, но соцы ВИДНЫ —
     именно по ним человек понимает, какой профиль идти подключать. */
  { act_id: "act_8871220034559911", name: "SOC3 · spx · 05", bm_id: "9042", bm_name: "Larkspur Trading Ltd",
    currency: "USD", status: "PENDING_CLOSURE", disable_reason: "не использовался", balance: 0,
    amount_spent: 0, spend_cap: null, daily_limit_note: NOTE, status_checked_at: T,
    owners: [{ profile_id: "a896ef95-9d10-4b8f-8a55-3c2f7d1e6b40", name: "10/8 hiu",
               oauth: false, in_antidetect: true },
             { profile_id: "b1204ce7-3f77-4a92-bb0c-5d9e2a4f8801", name: "",
               oauth: false, in_antidetect: true }] },
  /* ТОКЕН ЕСТЬ, ОКНА НЕТ — весь живой парк владельца выглядит именно так.
     Чекбокс погашен, щита нет, бейдж свой: чинится это в антидетекте. */
  { act_id: "act_1099238471002999", name: "MB3 · hiu · 12", bm_id: "1178", bm_name: "Zenith Media Group",
    currency: "USD", status: "ACTIVE", balance: 15_00, amount_spent: 7_420, spend_cap: null,
    funding_display_string: "Visa · 4417", daily_limit_note: NOTE, status_checked_at: T,
    owners: [{ profile_id: "k1fg9weq", name: "1/8 MediaBuyer3 hiu",
               oauth: true, in_antidetect: false }] },
  { act_id: "act_4410028876553311", name: "Nam Viet Digital", bm_id: "5510", bm_name: "5510",
    currency: "VND", status: "ACTIVE", balance: 4_820_000, amount_spent: 61_300_000, spend_cap: null,
    funding_display_string: "Visa · 0031", daily_limit_note: NOTE, status_checked_at: T },
  { act_id: "act_8871220034551234", name: "SOC3 · spx · 09 (EUR)", bm_id: "9042", bm_name: "Larkspur Trading Ltd",
    currency: "EUR", status: "ACTIVE", balance: 91_40, amount_spent: 402_10, spend_cap: null,
    funding_display_string: "Visa · 5590", daily_limit_note: NOTE, status_checked_at: T },
  { act_id: "act_7712009944110022", name: "Raaj Khan", currency: "USD", status: "ACTIVE",
    balance: null, amount_spent: 0, spend_cap: null, daily_limit_note: NOTE, status_checked_at: null },
  { act_id: "act_7712009944110099", name: null, currency: "USD", status_code: 42,
    balance: null, amount_spent: null, spend_cap: null, status_checked_at: "2026-08-11T22:05:00+00:00" },
  /* Кабинет, про который не знают НИЧЕГО. Так сегодня выглядит весь живой сервер:
     статуса нет ни у одного из 261. Набор без такой строки давал шапку «0 active ·
     0 disabled · 6 no card», и это читалось как утверждение о парке. */
  { act_id: "act_5540088123400111", name: "Не собран ни разу", bm_id: "1178",
    bm_name: "Zenith Media Group", currency: "USD" },
];

/** Хэши CSS живой панели меняются на каждой её сборке. Тянем их со страницы, а не
 *  держим списком: список протухнет молча и даст ненакрашенную страницу, которую
 *  легко принять за сломанную вёрстку. */
async function panelCss(base = "http://localhost:8790"): Promise<string> {
  const page = await fetch(base + "/accounts").then((r) => r.text());
  const hrefs = [...page.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
  /* Ответ НЕ 200 в стили не берём. Живая панель отдаёт 400 на часть своих же
     css-хэшей (сборка под launchd переехала, страница ссылается на старый файл),
     и текст страницы-ошибки, вклеенный в `<style>`, ломает разбор всего блока:
     страница выходила голой, и это выглядело как сломанная вёрстка листа. Молчать
     тоже нельзя — иначе смотрелка «работает», а красит наполовину. */
  const files: string[] = [];
  for (const h of [...new Set(hrefs)]) {
    const r = await fetch(base + h);
    if (r.ok) files.push(await r.text());
    else console.log(`смотрелка: ${h} отдал ${r.status} — этот файл стилей пропущен`);
  }
  return files.join("\n");
}

describe("смотрелка листа кабинетов", () => {
  /* НЕ `skipIf`. Пропуск виден в отчёте только именем файла — имени строки при
     обычном прогоне не печатают, и инструмент, о котором нельзя узнать, всё равно
     что отсутствует. Поэтому строка выполняется всегда и без `PREVIEW_OUT` просто
     говорит вслух, как ею пользоваться. Одна строка в выводе — честная цена за то,
     чтобы следующему не пришлось собирать смотрелку заново. */
  it("рисует лист в HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log(
        "смотрелка: PREVIEW_OUT не задан, ничего не нарисовано. Посмотреть лист глазами —\n" +
        "  PREVIEW_OUT=/tmp/cab.html npx vitest run lib/__tests__/preview-cloud-accounts.test.ts\n" +
        "  (рядом ляжет /tmp/cab-dark.html; стили берутся у живой панели на 8790)",
      );
      return;
    }
    /* Лист один, источников два — значит и смотреть надо на СВЕДЁННЫЕ строки.
       Пара кабинетов ниже приходит с мака: у них есть соцы, пиксели и общий каб,
       которого в базе нет вовсе, и ровно на них видно, что колонки не путаются. */
    const снапшот = [
      {
        acc: {
          id: "act_1762249281465160", name: "MB3 · hiu · 04", status: "ACTIVE",
          spent: "184.23 USD", limit: 81.66, funding: "Visa · 4417",
          pixels: [{ id: "1575609560601059", name: "hiu—Bangla-ogaff" },
                   { id: "1575609560601060", name: "hiu—Bangla-2" }],
        },
        profile: "k1fg9weq", profileLabel: "17/7 spx",
        owners: [
          { profile: "k1fg9weq", label: "17/7 spx", present: true, fresh: true, oauth: true,
            collectedAt: T },
          { profile: "k1f15y8n", label: "10/8 hiu", present: false, fresh: false, oauth: false,
            collectedAt: "2026-08-11T22:05:00+00:00" },
        ],
      },
      {
        acc: {
          id: "act_3390011225566778", name: "Raaj Khan", status: "ACTIVE",
          spent: "0 USD", pixels: [],
        },
        profile: "k1fn9qb1", profileLabel: "Raaj Khan",
        owners: [{ profile: "k1fn9qb1", label: "Raaj Khan", present: true, fresh: true,
                   oauth: false, collectedAt: T }],
      },
    ];
    const парк = unifiedAccounts(снапшот, rows, { personal: { act_3390011225566778: 1 } });
    const currency = dominantCurrency(парк);
    const общее = {
      selected: new Set(["1762249281465160"]),
      onSelect: () => {}, inGroup: new Map([["1762249281465160", ["EG"]]]),
      allSelected: false, onSelectAll: () => {}, colWidth: (c: { w: number }) => c.w,
      onРяд: () => {},
    };
    /* Вид ОДИН: разреза «by BM» больше нет, и рисовать «оба» стало нечего.
       Зато теперь смотреть надо на ПОРЯДОК — сортировка новая, и именно на ней
       ловятся смешанные валюты и «ноль против не знаем». Рисуем два порядка. */
    const body =
      renderToStaticMarkup(
        createElement(SummaryLine, {
          сводка: сводкаЛиста(парк, currency), currency,
          выбрано: false, onБезКарты: () => {},
        }),
      ) +
      renderToStaticMarkup(
        createElement(AccountsTable, {
          ...общее, flat: поРяду(парк, РЯД, currency), cols: COLS, ряд: РЯД,
        }),
      ) +
      `<p style="margin:28px 0 10px;font:600 13px system-ui">тот же лист по имени вверх — «не знаем» обязано остаться внизу</p>` +
      renderToStaticMarkup(
        createElement(AccountsTable, {
          ...общее,
          flat: поРяду(парк, { id: "cab", desc: false }, currency),
          cols: COLS,
          ряд: { id: "cab", desc: false },
        }),
      );
    const css = await panelCss();
    const page = (theme: string) =>
      `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
      `<title>cloud accounts · ${theme}</title><style>${css}</style>` +
      `<body class="bg-background text-foreground" style="padding:24px">` +
      `<div style="max-width:1400px;margin:0 auto">${body}</div></body></html>`;

    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, page("light"));
    /* Тёмная тема отдельным файлом: в панели она переключается атрибутом на `html`,
       и половина находок по контрасту случается именно в ней. */
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html", page("dark"));
  });
});

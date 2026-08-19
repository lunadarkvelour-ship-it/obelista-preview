/* Смотрелка листа кабинетов — сводная строка и сама таблица (#166, XR-35).
 *
 * ЗАЧЕМ. Всё, что чинит #166, — это ЧИСЛА И СЛОВА НА ЭКРАНЕ: сходится ли сумма
 * частей, одним ли словом названо состояние, различимы ли группы-тёзки. Тесты
 * рядом проверяют значения, но ни один из них не видит, влезло ли это в строку,
 * не наехало ли одно на другое и не обрезалось ли справа. Сегодня на этом уже
 * обожглись: 2500 зелёных тестов при колонке имени НУЛЕВОЙ ширины на проде.
 *
 *   PREVIEW_OUT=/tmp/acc.html npx vitest run lib/__tests__/preview-accounts.test.ts
 *
 * Рисуется СВОДНАЯ СТРОКА и ТАБЛИЦА, а не лист целиком: данные лист берёт
 * запросом, а `renderToStaticMarkup` эффектов не выполняет — на статике он
 * всегда пуст. Смотреть надо на то, что рисуется от голых пропсов.
 *
 * ЧТО ИЗМЕНИЛОСЬ 17.08. Плитки на семь чисел и заголовков групп по Business
 * Manager больше нет: измерение БМ ушло с листа целиком, а плитку заменила
 * строка. Смотреть теперь надо на то, что осталось, — иначе смотрелка
 * показывает экран, которого нет.
 *
 * ДАННЫЕ — С ЖИВОГО ПАРКА, а не удобные. Числа из базы владельца 15.08: 268
 * кабинетов, 98 забаненных, 34 живых, 6 неоплаченных, 130 без снятого статуса,
 * имена БМ-тёзок («2020» носят 31 разный Business Manager, «BM NQ» — 23).
 * Добавлен один кабинет под проверкой Меты: на парке их сегодня нет, но именно
 * эта корзина не показывалась НИГДЕ, и увидеть её надо до того, как она
 * появится у владельца.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountsTable, SummaryLine } from "@/components/views/AccountsView";
import { DataHealth } from "@/components/sections/DataHealth";
import { сводкаЛиста, type UnifiedAccount } from "@/lib/cloud-accounts";
import { СОСТОЯНИЯ_МЕНЮ, счётПоСостояниям } from "@/lib/cloud-filter";
import { РЯД, поРяду } from "@/lib/accounts-sort";
import { panelCss, previewPage } from "./preview-css";

const каб = (p: Partial<UnifiedAccount> & { act_id: string }): UnifiedAccount => ({
  name: null, bm_name: null, status: null, status_checked_at: "2026-08-15T09:00:00Z",
  funding_type: null, funding_display_string: null,
  owners: [], profile: null, profileLabel: "", pixels: [], personal: false,
  inSnapshot: false, inCloud: true, ...p,
});

/** Парк формой как у владельца, только короче: те же имена, те же корзины. */
const ПАРК: UnifiedAccount[] = [
  каб({ act_id: "act_1922802118675905", name: "Hiuhiu_MediaBuyer3_8.8_6",
        bm_id: "100", bm_name: "BM NQ", status: "ACTIVE", currency: "USD",
        amount_spent: 4469_00, funding_type: "CREDIT_CARD",
        profile: "2fcc2d23", profileLabel: "17/7 spx" }),
  каб({ act_id: "act_1854199119271472", name: "MeDuA6aeP 17/7-8",
        bm_id: "200", bm_name: "BM NQ", status: "DISABLED", currency: "USD",
        amount_spent: 8214_00 }),
  каб({ act_id: "act_1586797046292076", name: "Ko Swe 11/8",
        bm_id: "300", bm_name: "2020", status: "UNSETTLED", currency: "USD",
        amount_spent: 7181_00 }),
  каб({ act_id: "act_1793089088500549", name: "Hiuhiu_Mediabuyer3_11.8_8",
        bm_id: "400", bm_name: "2020", status: "PENDING_RISK_REVIEW",
        currency: "USD", amount_spent: 9613_00 }),
  каб({ act_id: "act_2270870780419667", name: "spx--DZ--1364793938527800",
        bm_id: "500", bm_name: "BM TK VAN 1", status: null,
        status_checked_at: null, currency: "USD" }),
  каб({ act_id: "act_4380787615497625", name: "hiu--7aug--BD--1593072965497261",
        status: "DISABLED", currency: "USD", amount_spent: 7246_00 }),
];

describe("смотрелка листа кабинетов", () => {
  it("сумма пунктов меню равна числу кабинетов — на этих же данных", () => {
    /* Смотрелка смотрелкой, а утверждение проверяется числом: картинку человек
       может и не открыть, а прогон краснеет всегда.
       Гарантия та же, что держала плитка (#166), просто переехала на меню. */
    const счёт = счётПоСостояниям(ПАРК);
    const сумма = СОСТОЯНИЯ_МЕНЮ.filter((с) => с !== "все")
      .reduce((a, с) => a + счёт[с], 0);
    expect(сумма).toBe(ПАРК.length);
    expect(сводкаЛиста(ПАРК, "USD").accounts).toBe(ПАРК.length);
  });

  it("рисует лист в HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log(
        "смотрелка: PREVIEW_OUT не задан, ничего не нарисовано. Посмотреть глазами —\n" +
        "  PREVIEW_OUT=/tmp/acc.html npx vitest run lib/__tests__/preview-accounts.test.ts",
      );
      return;
    }

    const cols = [
      { id: "cab", title: "ad account", w: 340 },
      { id: "soc", title: "profile", w: 210 },
      { id: "spend", title: "spend", w: 120, right: true },
      { id: "pay", title: "billing", w: 150 },
      { id: "pixel", title: "pixel", w: 220 },
    ];

    /* НАСТОЯЩИМИ компонентами листа, а не своей похожей разметкой: подобие
       показало бы мою вёрстку и промолчало бы о той, что поедет владельцу. */
    const здоровье = renderToStaticMarkup(createElement(DataHealth, {
      факты: [
        { id: "stale", тон: "внимание" as const,
          что: "MeDuA6aeP - 15/8 SOC3 — sync failed, showing older data",
          детали: "27 ad accounts from the last good sync. HTTP 500 from graph.facebook.com" },
        { id: "nothing", тон: "внимание" as const,
          что: "None of the profiles that see these accounts is connected",
          куда: { href: "/socials", текст: "Connect a profile" } },
      ],
      режим: "Snapshot",
    }));

    const сводка = renderToStaticMarkup(createElement(SummaryLine, {
      сводка: сводкаЛиста(ПАРК, "USD"), currency: "USD",
      выбрано: false, onБезКарты: () => {},
    }));

    const таблица = renderToStaticMarkup(createElement(AccountsTable, {
      flat: поРяду(ПАРК, РЯД, "USD"),
      selected: new Set(["act_1922802118675905"]),
      onSelect: () => {},
      inGroup: new Map([["act_1922802118675905", ["BD 17/8"]]]),
      allSelected: false,
      onSelectAll: () => {},
      cols,
      colWidth: (c: { w: number }) => c.w,
      ряд: РЯД,
      onРяд: () => {},
    }));

    const body =
      `<h2 class="mb-2 text-sm font-semibold">Состояние данных: два факта и метка режима</h2>` +
      здоровье +
      `<h2 class="mb-2 mt-6 text-sm font-semibold">Сводная строка</h2>` +
      сводка +
      `<h2 class="mb-2 mt-6 text-sm font-semibold">Таблица: пять колонок, сортировка по спенду</h2>` +
      таблица;

    const css = await panelCss("/accounts");
    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, previewPage("accounts", "light", css, body));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html",
                     previewPage("accounts", "dark", css, body));
  });
});

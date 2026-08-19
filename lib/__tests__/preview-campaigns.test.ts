/* Не проверка, а СМОТРЕЛКА: рисует строки листа «Кампании» в статический HTML.
 *
 * Лист управляет чужой рекламой кнопкой, и посмотреть на него до выката нечем:
 * `npm run dev` и `next build` на маке запрещены, облако за логином, ручек
 * демона под лист ещё нет вовсе — на живом сервере он покажет плашку, а не
 * дерево. Смотрелка — единственный способ увидеть строку глазами до того, как
 * её увидит владелец.
 *
 *   PREVIEW_OUT=/tmp/camp.html npx vitest run lib/__tests__/preview-campaigns.test.ts
 *
 * Рисуются СТРОКИ, а не лист целиком: данные лист берёт запросом, а
 * `renderToStaticMarkup` эффектов не выполняет — на статике он всегда пуст.
 * Строка же рисуется от голых пропсов, и смотреть надо именно на неё.
 *
 * Данные ЗАГЛУШЕЧНЫЕ и нарочно недобрые: в них есть всё, на чём такой лист
 * врёт — объявление, выключенное сверху; строка без штампа свежести; остывшая
 * строка трёхдневной давности; кабинет, до которого не дотянуться ни одним
 * соцем; архив, который назад не переключается; бюджет, которого нет в схеме;
 * строка в процессе отправки и строка с отказом Меты. Заглушка, которая
 * «улучшает» данные, перестаёт быть глазами и становится зеркалом.
 */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { panelCss, previewPage } from "./preview-css";
import { accountFacts } from "@/lib/analytics-accounts";
import {
  counts, картаБюджетов, плоскийЛист, поКабинетам, срезДерева, строкиФутера,
  type PendingMap,
} from "@/lib/campaigns-tree";
import { CAMP_DEFAULT_VISIBLE, итоги, колонки } from "@/lib/campaigns-columns";
import { колонкиВоронки, подготовить } from "@/lib/campaigns-funnel";
import { кабинетыСоца, соцыДляЛиста } from "@/lib/campaigns-nav";
import { campaignsSurfaceWhy, type CampaignRow, type ЭкранКампаний } from "@/lib/campaigns";
import type { UnifiedAccount } from "@/lib/cloud-accounts";
import type { AccountOwner } from "@/lib/account-rows";
import {
  AccountFloor, AccountLevel, CampRow, SocialLevel, TreeFilters, БезРодителяРяд,
  ФутерТотал, ШапкаКолонок,
} from "@/components/views/CampaignsView";
import { PeriodPicker } from "@/components/views/PeriodPicker";

const NOW = Date.parse("2026-08-15T12:00:00Z");
const назад = (s: number) => new Date(NOW - s * 1000).toISOString();

const ROWS: CampaignRow[] = [
  { fb_id: "c1", level: "campaign", parent_id: null, act_id: "act_1398031898947759",
    name: "hiu--7aug--BD--1398031898947759--l7uacelsb4--bangla18-24",
    status: "ACTIVE", effective_status: "ACTIVE", daily_budget: 7000, currency: "USD",
    spend: 187_312, impressions: 412_004, clicks: 3128,
    checked_at: назад(240), owner: "k1f9qbcs" },
  { fb_id: "s1", level: "adset", parent_id: "c1", act_id: "act_1398031898947759",
    name: "hiu--7aug-ads--7759--qa93p--bangla24",
    status: "ACTIVE", effective_status: "ACTIVE", daily_budget: null, currency: "USD",
    spend: 187_312, impressions: 412_004, clicks: 3128,
    checked_at: назад(240), owner: "k1f9qbcs" },
  { fb_id: "a1", level: "ad", parent_id: "s1", act_id: "act_1398031898947759",
    name: "hiu--7aug-ad--7759--y3tmf--bangla24",
    status: "ACTIVE", effective_status: "ACTIVE", currency: "USD",
    spend: 170_100, impressions: 398_220, clicks: 3001,
    checked_at: назад(240), owner: "k1f9qbcs" },
  { fb_id: "a2", level: "ad", parent_id: "s1", act_id: "act_1398031898947759",
    name: "hiu--7aug-ad--7759--k2p1s--bangla24 (выключен сверху)",
    status: "ACTIVE", effective_status: "CAMPAIGN_PAUSED", currency: "USD",
    /* Крутилось и не потратило: ноль — это факт, а не пустота. */
    spend: 0, impressions: 13_784, clicks: 127,
    checked_at: назад(240), owner: "k1f9qbcs" },
  /* ВЫКЛЮЧЕН АДСЕТ — САМЫЙ ЧАСТЫЙ СЛУЧАЙ НА ЖИВОМ ПАРКЕ, и до #155 его в
     смотрелке не было вовсе. В базе владельца таких 317 строк против 147 с
     выключенной кампанией, то есть глазами проверялся более редкий из двух, а
     чаще всего встречающийся бейдж никто ни разу не видел.
     Он же самый длинный из обычных («its ad set is off» рядом с подписью
     статуса и возрастом), поэтому на нём и видно, лезет ли колонка. */
  { fb_id: "a4", level: "ad", parent_id: "s1", act_id: "act_1398031898947759",
    name: "hiu--7aug-ad--7759--w9kdb--bangla24 (выключен адсет)",
    status: "ACTIVE", effective_status: "ADSET_PAUSED", currency: "USD",
    spend: 0, impressions: 4102, clicks: 31,
    checked_at: назад(240), owner: "k1f9qbcs" },
  { fb_id: "c2", level: "campaign", parent_id: null, act_id: "act_1317372127138026",
    name: "hiu--11aug--BD--архивная",
    status: "ARCHIVED", effective_status: "ARCHIVED", checked_at: назад(3 * 24 * 3600),
    owner: "k1f9qbcs" },
  { fb_id: "c3", level: "campaign", parent_id: null, act_id: "act_4380787615497625",
    name: "spx--12aug--DZ--каб без соца",
    status: "PAUSED", effective_status: "PAUSED", lifetime_budget: 250_000, currency: "USD",
    checked_at: null, owner: null },
  { fb_id: "c4", level: "campaign", parent_id: null, act_id: "act_4380787615497625",
    name: "spx--12aug--DZ--отправляется прямо сейчас",
    status: "ACTIVE", effective_status: "ACTIVE", checked_at: назад(30), owner: "k1f9qbcs" },
  { fb_id: "c5", level: "campaign", parent_id: null, act_id: "act_4380787615497625",
    name: "spx--12aug--DZ--Мета отказала",
    status: "ACTIVE", effective_status: "ACTIVE", checked_at: назад(30), owner: "k1f9qbcs" },
  /* СТРОКИ С ЖИВОГО ПРОДА (образец сборщика 15.08): у кампании статус ВЫВЕДЕН
     из детей, доставки нет ни у одного объявления; у объявления Мета говорит
     DISAPPROVED при включённом статусе. Оба случая — то, ради чего лист и
     открывают, и оба обязаны читаться с первого взгляда. */
  { fb_id: "c9", level: "campaign", parent_id: null, act_id: "act_993922386804430",
    name: "EG--993922386804430--4izdq4obvt",
    status: "ACTIVE", effective_status: null, status_source: "derived",
    active_ads: 0, spend: null, currency: "USD",
    checked_at: назад(14 * 3600), owner: "00076f0a" },
  { fb_id: "a8", level: "ad", parent_id: "c9", act_id: "act_993922386804430",
    name: "videoM17CLst-es",
    status: "ACTIVE", effective_status: "DISAPPROVED", status_source: "live",
    active_ads: 0, spend: null, currency: "USD",
    checked_at: назад(14 * 3600), owner: "00076f0a" },
  /* Сирота: родитель в ответе не пришёл. По ней идут деньги, и прятать её
     нельзя — она обязана лежать своим уровнем на верхнем этаже. */
  { fb_id: "a9", level: "ad", parent_id: "нет-такого", act_id: "act_1398031898947759",
    name: "залито не нами — адсета у нас нет",
    status: "PAUSED", effective_status: "PAUSED", checked_at: назад(26 * 3600),
    owner: "k1f9qbcs" },
];

/* Верхние два уровня — наши, их в Ads Manager нет, и посмотреть на них глазами
   тем более негде. Заглушка той же формы, что живой парк владельца: три
   подключённых соца, у одного токен без живого окна антидетекта (после переезда
   между вендорами таких у него 22 кабинета), общий каб виден с двух соцев,
   у части кабинетов состояние не снимали ни разу. */
const соц = (p: Partial<AccountOwner> & { profile: string }): AccountOwner => ({
  label: "", present: true, fresh: true, oauth: false, ...p,
});
const каб = (p: Partial<UnifiedAccount> & { act_id: string }): UnifiedAccount => ({
  name: null, bm_name: null, status: null, status_checked_at: null,
  funding_type: null, funding_display_string: null,
  owners: [], profile: null, profileLabel: "", pixels: [], personal: false,
  inSnapshot: false, inCloud: true, ...p,
});
const МОНИК = соц({ profile: "00076f0a", label: "Monique Mujinga", oauth: true });
const ДАЗТ = соц({ profile: "2fcc2d23", label: "Dahzztt Febrianti", oauth: true, present: false });
const ЭНДАХ = соц({ profile: "a896ef95", label: "Endah Sukamto", oauth: true });

const ПАРК: UnifiedAccount[] = [
  каб({ act_id: "act_1398031898947759", name: "Hiuhiu_MediaBuyer_3.8_2", status: "ACTIVE",
        profile: "00076f0a", owners: [МОНИК] }),
  каб({ act_id: "act_1317372127138026", name: "Hiuhiu_Mediabuyer3_11.8_8", status: "DISABLED",
        profile: "00076f0a", owners: [МОНИК, ДАЗТ] }),
  каб({ act_id: "act_4380787615497625", name: "MeDuA6aeP 17/7-8", status: "UNSETTLED",
        owners: [ДАЗТ] }),
  каб({ act_id: "act_1574869187497859", name: "Ko Swe", owners: [ЭНДАХ], profile: "a896ef95" }),
];

/** Совпадают ли сутки кабинета с нашими (`period.same_day_boundary`). */
const ГРАНИЦЫ: Record<string, boolean | null | undefined> = {
  act_1398031898947759: true,
  act_1317372127138026: false,
  act_4380787615497625: null,
};

const PENDING: PendingMap = {
  c4: { want: "PAUSED", state: "sending" },
  c5: { want: "PAUSED", state: "failed",
        error: "(#100) Invalid parameter: cannot update status of a deleted object" },
};

describe("смотрелка листа кампаний", () => {
  it("рисует строки в HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log(
        "смотрелка: PREVIEW_OUT не задан, ничего не нарисовано. Посмотреть строки глазами —\n" +
        "  PREVIEW_OUT=/tmp/camp.html npx vitest run lib/__tests__/preview-campaigns.test.ts\n" +
        "  (рядом ляжет /tmp/camp-dark.html; стили берутся у панели, при беде — у прода)",
      );
      return;
    }

    const facts = accountFacts({
      base: [
        { act_id: "act_1398031898947759", name: "Hiuhiu_MediaBuyer_3.8_2", status: "ACTIVE" },
        { act_id: "act_1317372127138026", name: "Hiuhiu_Mediabuyer3_11.8_8", status: "DISABLED" },
      ],
    });
    /* Дерево целиком, от кабинета вниз, и раскрытое: смотреть надо на строки, а
       не на шевроны. `подФильтром: true` — это и есть «раскрыто всё» по
       умолчанию (`Раскрытие` в `campaigns-tree`). */
    const этажи = поКабинетам(ROWS);
    const строки = плоскийЛист(этажи, {
      иначе: new Set<string>(), подФильтром: true, одинКабинет: false,
    });
    const бюджеты = картаБюджетов(ROWS);
    /* Колонки — те же три контракта, что на живом листе: рамка листа, каталог
       метрик (#159) и ступени воронки ИЗ ОТВЕТА. Воронка здесь без данных
       намеренно: сегодня в облаке нет ни одной её строки, и смотреть надо
       ровно на то, как выглядит пустота, которая не притворяется нулём. */
    const КОЛОНКИ = {
      метрики: колонки(CAMP_DEFAULT_VISIBLE),
      /* Связки нет намеренно: сегодня в облаке нет ни одной строки воронки, и
         смотреть надо ровно на то, как выглядит пустота, которая не
         притворяется нулём. */
      ctx: подготовить(null),
    };

    const body =
      `<p style="margin:0 0 10px;font:600 13px system-ui">level 1 — profiles</p>` +
      renderToStaticMarkup(
        createElement(SocialLevel, {
          соцы: соцыДляЛиста(ПАРК), всего: ПАРК.length,
          вне: { токенБезОкна: 1, неизвестные: 2, отключённые: 130 }, активных: 1, onОткрытьАктивные: () => {}, onВыбрать: () => {},
        }),
      ) +
      `<p style="margin:18px 0 10px;font:600 13px system-ui">level 2 — ad accounts of one profile</p>` +
      renderToStaticMarkup(
        createElement(AccountLevel, {
          кабинеты: кабинетыСоца(ПАРК, "00076f0a"),
          всего: кабинетыСоца(ПАРК, "00076f0a").length,
          отмечено: ["act_1398031898947759"],
          поиск: "", onПоиск: () => {}, onОтметить: () => {}, onОтметитьМного: () => {},
        onОткрыть: () => {},
        }),
      ) +
      `<p style="margin:18px 0 10px;font:600 13px system-ui">period picker — it rules every number below</p>` +
      renderToStaticMarkup(
        createElement(PeriodPicker, {
          value: { preset: "last_7d" },
          resolved: {
            preset: "last_7d", since: "2026-08-09", until: "2026-08-15", tz: "UTC+3",
            days: 7, today: "2026-08-15", days_with_data: 5,
          },
          onChange: () => {},
        }),
      ) +
      `<p style="margin:18px 0 10px;font:600 13px system-ui">filters — search, states, the eye and the metric picker</p>` +
      renderToStaticMarkup(
        createElement(TreeFilters, {
          срез: { запрос: "", состояние: "все", безСпендаСкрыт: false },
          onСрез: () => {}, onРаскрыть: () => {}, onСвернуть: () => {},
          счёт: { "все": 12, "крутится": 4, "на паузе": 6, "не доставляется": 2 },
          /* Число у глаза не выдумано: столько строк в этой же заглушке без
             найденного спенда. Оно и есть главное в кнопке. */
          скрытоБезСпенда: срезДерева(ROWS, {
            запрос: "", состояние: "все", безСпендаСкрыт: false,
          }).скрытоБезСпенда,
          метрики: CAMP_DEFAULT_VISIBLE, onМетрики: () => {},
        }),
      ) +
      `<p style="margin:18px 0 10px;font:600 13px system-ui">levels 2-5 — ad account → campaign → ad set → ad</p>` +
      `<div class="overflow-hidden rounded-xl border border-border">` +
      renderToStaticMarkup(createElement(ШапкаКолонок, { колонки: КОЛОНКИ })) +
      строки
        .map((с) =>
          renderToStaticMarkup(
            с.вид === "кабинет"
              ? createElement(AccountFloor, {
                  группа: с.группа, имя: facts.get(с.группа.act_id)?.name ?? null,
                  now: NOW, open: с.open, hasKids: с.hasKids, onToggle: () => {},
                  /* Границы суток нарочно разные: у одного кабинета свои сутки
                     (Лос-Анджелес на живом парке), у другого пояс неизвестен —
                     обе метки надо увидеть глазами, они про доверие к цифре. */
                  граница: ГРАНИЦЫ[с.группа.act_id], колонки: КОЛОНКИ,
                })
              : с.вид === "без родителя"
                ? createElement(БезРодителяРяд, {
                    сколько: с.сколько, depth: с.depth, open: с.open, onToggle: () => {},
                    колонки: КОЛОНКИ,
                  })
                : createElement(CampRow, {
                    item: с.item, now: NOW, pending: PENDING,
                    бюджет: бюджеты.get(с.item.node.row.fb_id),
                    колонки: КОЛОНКИ,
                    onToggle: () => {}, onSwitch: () => {},
                  }),
          ),
        )
        .join("") +
      renderToStaticMarkup(
        createElement(ФутерТотал, {
          итог: итоги(строкиФутера(этажи)), счёт: counts(ROWS),
          кабинетов: этажи.length, колонки: КОЛОНКИ,
        }),
      ) +
      `</div>` +
      /* ЧЕТЫРЕ РАЗНЫЕ ПУСТОТЫ И ВЫКЛЮЧЕННОЕ ДЕЙСТВИЕ — ГЛАЗАМИ.
         Их не видно на дереве выше: там ручка есть, строки приехали и они
         свежие. А человек встретит именно эти три экрана в первый день, и
         единственная проверка того, что они читаются как разные новости, —
         посмотреть на них рядом. */
      `<p style="margin:18px 0 10px;font:600 13px system-ui">four different kinds of empty — they must not read the same</p>` +
      (["no-backend", "empty", "stale", "ok"] as ЭкранКампаний[])
        .map((с) => `<p style="margin:0 0 6px;font:12px system-ui">`
          + `<b>${с}</b> — ${campaignsSurfaceWhy(с, назад(5 * 3600), NOW) || "(no message: the screen stays quiet)"}</p>`)
        .join("") +
      `<p style="margin:18px 0 10px;font:600 13px system-ui">action blocked — the reason must stand next to the dimmed button</p>` +
      `<div class="overflow-hidden rounded-xl border border-border">` +
      renderToStaticMarkup(createElement(ШапкаКолонок, { колонки: КОЛОНКИ })) +
      [
        /* Строка ради контекста: под фильтр не подошла, вытащил её совпавший
           потомок. Действие на ней человек не выбирал. */
        { r: ROWS[0], контекст: true, экран: "ok" as ЭкранКампаний },
        /* Ручки нет на деплое: гаснет даже строка с владельцем. */
        { r: ROWS[0], контекст: false, экран: "no-backend" as ЭкранКампаний },
        /* Сбор не доходил больше суток — состояние строки догадка. */
        { r: ROWS[ROWS.length - 1], контекст: false, экран: "ok" as ЭкранКампаний },
      ]
        .map(({ r, контекст, экран }) => renderToStaticMarkup(createElement(CampRow, {
          item: { node: { row: r, children: [] }, depth: 1, hasKids: false, open: false },
          now: NOW, pending: {}, колонки: КОЛОНКИ, контекст, экран,
          onToggle: () => {}, onSwitch: () => {},
        })))
        .join("") +
      `</div>`;

    const css = await panelCss("/analytics");
    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, previewPage("campaigns", "light", css, body));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html",
                     previewPage("campaigns", "dark", css, body));
  });
});

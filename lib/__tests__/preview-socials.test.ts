/* Не проверка, а СМОТРЕЛКА: рисует лист «Профили» в статический HTML, чтобы на
 * него можно было посмотреть глазами.
 *
 * ЗАЧЕМ ИМЕННО ЗДЕСЬ. #163 переложил лист на два списка: рабочий и «не
 * открываются». Тесты видят, что узел есть и текст в нём верный, — и не видят
 * НИЧЕГО из того, чем такой экран ломается на самом деле: колонки нулевой
 * ширины, обрезанные справа кнопки, текст поверх текста, длинное объяснение,
 * выдавившее действие за край. 15.08 на проде так съело колонку имени в листе
 * кампаний при 2500 зелёных тестах.
 *
 * ДАННЫЕ ЗДЕСЬ — С ЖИВОЙ БАЗЫ ВЛАДЕЛЬЦА, а не придуманные: те же имена, те же
 * идентификаторы, тот же дословный текст ошибки Меты и та же пропорция строк
 * (два подключённых соца, два свободных профиля, девятнадцать «не
 * открываются»). Смотрелка, которая «улучшает» данные, перестаёт быть глазами.
 *
 *   PREVIEW_OUT=/tmp/soc.html npx vitest run lib/__tests__/preview-socials.test.ts
 *
 * Рядом ляжет `/tmp/soc-dark.html`. Стили берутся у живой панели на 8790.
 */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { panelCss, previewPage } from "./preview-css";
import { ScanProfiles } from "@/components/sections/profiles/ScanProfiles";
import {
  Group, OrphanRow, Row, ИсточникМолчит,
} from "@/components/views/SocialsView";
import { ВЕНДОР_НЕТ, ВЕНДОР_НЕ_ПОДТВЕРЖДЁН, type Social } from "@/lib/analytics";

const SCOPES = "ads_mcp_management,pages_show_list,ads_management,ads_read,"
  + "business_management,instagram_basic,pages_read_engagement,public_profile";

/* Дословно от Меты, с живой базы: панель показывает его в подсказке, и длина у
   него настоящая. Свой короткий пересказ спрятал бы, как строка ведёт себя с
   таким текстом. */
const ОШИБКА_МЕТЫ = "Мета: Error validating access token: The session has been "
  + "invalidated because the user changed their password or Facebook has changed "
  + "the session for security reasons. (code 190, subcode 460)";

const соц = (s: Partial<Social> & { profile_id: string }): Social => ({
  profile_name: "", name: null, agency: null, fb_user_id: null, status: null,
  scopes: null, expires_at: null, last_ok_at: null, last_error: null,
  in_antik: false, connected: false, auth_url: null, profiles: [], ...s,
});

describe("смотрелка листа «Профили»", () => {
  it("рисует лист в HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log(
        "смотрелка: PREVIEW_OUT не задан, ничего не нарисовано. Посмотреть лист глазами —\n" +
        "  PREVIEW_OUT=/tmp/soc.html npx vitest run lib/__tests__/preview-socials.test.ts",
      );
      return;
    }

    /* Два подключённых соца владельца. У первого токен отвалился (смена пароля),
       и это «переподключи» — кнопка на месте; второй отвечает. */
    const рабочие: Social[] = [
      соц({
        profile_id: "k1f9qbcs", name: "Monique Mujinga", fb_user_id: "1063213549624026",
        status: "connected", connected: true, scopes: SCOPES,
        expires_at: "2026-10-12T14:45:14+00:00", last_ok_at: "2026-08-14T16:09:21+00:00",
        last_error: ОШИБКА_МЕТЫ, profile_name: "1/8 MediaBuyer3 hiu",
        auth_url: "https://www.facebook.com/v21.0/dialog/oauth?client_id=…",
        profiles: [
          { profile_id: "k1f9qbcs", antidetect: "adspower", in_antik: false,
            name: "1/8 MediaBuyer3 hiu", vendor: "adspower", vendor_state: ВЕНДОР_НЕТ },
          { profile_id: "00076f0a-c36a-4209-a770-9374e2362a21", antidetect: "shardx",
            in_antik: true, name: "1/8 MediaBuyer3 hiu", vendor: "shardx" },
        ],
      }),
      соц({
        profile_id: "k1ffja5h", name: "Endah Sukamto", fb_user_id: "2915363628807534",
        status: "connected", connected: true, scopes: SCOPES,
        expires_at: "2026-10-12T14:42:06+00:00", last_ok_at: "2026-08-15T13:37:07+00:00",
        profile_name: "MeDuA6aeP 6/8 spx",
        auth_url: "https://www.facebook.com/v21.0/dialog/oauth?client_id=…",
        profiles: [
          { profile_id: "a896ef95-b639-4b01-9f36-f3a4ccc32805", antidetect: "shardx",
            in_antik: true, name: "MeDuA6aeP 6/8 spx", vendor: "shardx" },
        ],
      }),
    ];

    /* Свободные профили живого вендора — их и надо подключать. */
    const свободные: Social[] = [
      соц({ profile_id: "2fcc2d23-ecd8-4122-ac84-a72dfc77d002",
            profile_name: "MeDuA6aeP - 15/8 SOC3", in_antik: true,
            auth_url: "https://www.facebook.com/v21.0/dialog/oauth?client_id=…" }),
      соц({ profile_id: "e6b0bc29-100c-40ce-acb3-0011973a0353",
            profile_name: "11/8 MediaBuyer3 (Backup) hiu", in_antik: true,
            auth_url: "https://www.facebook.com/v21.0/dialog/oauth?client_id=…" }),
    ];

    /* Не открываются. Первый — подключённый соц, чей вендор снесён: строка
       длинная и с аккаунтом Меты. Второй — голый профиль без соца. Третий —
       «не подтверждён», у него ссылка ОСТАЁТСЯ, и на экране это должно быть
       видно как разница, а не как одинаковый серый. */
    const сироты: Social[] = [
      соц({
        profile_id: "k1fotx3n", name: "Raaj Khan", fb_user_id: "996677716716481",
        status: "connected", connected: true, profile_name: "MeDuA6aeP - 13/8 SOC3",
        vendor_state: ВЕНДОР_НЕТ, vendor_gone: true,
        profiles: [{ profile_id: "k1fotx3n", antidetect: "adspower", in_antik: false,
                     name: "MeDuA6aeP - 13/8 SOC3", vendor: "adspower",
                     vendor_state: ВЕНДОР_НЕТ }],
      }),
      соц({
        profile_id: "k1fn9qb1", name: "Nehomar David Blanco Arteaga",
        fb_user_id: "27702992479380871", status: "disconnected",
        profile_name: "11/8 MediaBuyer3 (Backup) hiu",
        vendor_state: ВЕНДОР_НЕТ, vendor_gone: true,
        profiles: [{ profile_id: "k1fn9qb1", antidetect: "adspower", in_antik: false,
                     name: "11/8 MediaBuyer3 (Backup) hiu", vendor: "adspower",
                     vendor_state: ВЕНДОР_НЕТ }],
      }),
      соц({
        profile_id: "k1epd0wv", profile_name: "17/7 spx",
        vendor_state: ВЕНДОР_НЕ_ПОДТВЕРЖДЁН, vendor_gone: true,
        auth_url: "https://www.facebook.com/v21.0/dialog/oauth?client_id=…",
        profiles: [{ profile_id: "k1epd0wv", antidetect: null, in_antik: false,
                     name: "17/7 spx", vendor: "",
                     vendor_state: ВЕНДОР_НЕ_ПОДТВЕРЖДЁН }],
      }),
      соц({
        profile_id: "k1ecjt33", profile_name: "6/7 hiu DEAD FOR FP",
        vendor_state: ВЕНДОР_НЕ_ПОДТВЕРЖДЁН, vendor_gone: true,
        auth_url: "https://www.facebook.com/v21.0/dialog/oauth?client_id=…",
        profiles: [{ profile_id: "k1ecjt33", antidetect: null, in_antik: false,
                     name: "6/7 hiu DEAD FOR FP", vendor: "",
                     vendor_state: ВЕНДОР_НЕ_ПОДТВЕРЖДЁН }],
      }),
    ];

    const пусто = () => {};
    const пустаяЗадача = async () => {};
    const строка = (s: Social) => createElement(Row, {
      key: s.profile_id, s, copied: false, onCopy: пусто, onForget: пусто,
      onArchive: пустаяЗадача, onDelete: пустаяЗадача,
    });
    const сирота = (s: Social) => createElement(OrphanRow, {
      key: s.profile_id, s, copied: false, onCopy: пусто,
      onArchive: пустаяЗадача, onDelete: пустаяЗадача,
    });

    const шапка =
      `<header style="display:flex;align-items:center;gap:12px;margin-bottom:12px">` +
      `<h1 class="font-heading text-lg font-semibold">Profiles</h1>` +
      `<span class="font-mono text-xs text-muted-foreground">2 of 4 connected</span>` +
      `</header>`;
    const фейсбук =
      `<section class="flex flex-none flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">` +
      `<div class="min-w-0 flex-1">` +
      `<h2 class="text-xs font-semibold text-foreground">Connect Facebook accounts</h2>` +
      `<p class="mt-0.5 max-w-[72ch] text-2xs leading-relaxed text-muted-foreground">` +
      `Separate Meta permission flow for ad accounts, pages, billing, and status. Use it after profiles are imported, or when an existing Facebook account needs OAuth again.` +
      `</p></div>` +
      `<button class="focus-ring flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs outline-none transition-colors duration-150 hover:border-border-strong">Add account</button>` +
      `</section>`;

    const body = шапка
      + renderToStaticMarkup(createElement(ScanProfiles))
      + `<div style="height:12px"></div>`
      + фейсбук
      + `<div style="height:12px"></div>`
      + renderToStaticMarkup(createElement(ИсточникМолчит))
      + `<div style="height:12px"></div>`
      + renderToStaticMarkup(createElement(Group, {
          title: "connected", count: рабочие.length,
          children: рабочие.map(строка),
        }))
      + `<div style="height:12px"></div>`
      + renderToStaticMarkup(createElement(Group, {
          title: "not connected", count: свободные.length,
          children: свободные.map(строка),
        }))
      + `<div style="height:12px"></div>`
      + renderToStaticMarkup(createElement(Group, {
          title: "cannot be opened", count: сироты.length,
          children: сироты.map(сирота),
        }));

    const css = await panelCss();
    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, previewPage("profiles · light", "light", css, body));
    /* Тёмная тема отдельным файлом: половина находок по контрасту — в ней. */
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html",
                     previewPage("profiles · dark", "dark", css, body));
    void Fragment;
  });
});

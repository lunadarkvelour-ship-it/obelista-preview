/* Не проверка, а СМОТРЕЛКА: рисует лист автоправил в статический HTML, чтобы на
 * него можно было посмотреть глазами.
 *
 * Зачем она есть — см. шапку `preview-cloud-accounts.test.ts`: `npm run dev` и
 * `next build` на маке запрещены (ломают общий `.next` живой панели под launchd),
 * облако за basic auth, а лист, который никто не видел, закрыт только типами.
 *
 * Как пользоваться:
 *
 *   PREVIEW_OUT=/tmp/rules.html npx vitest run lib/__tests__/preview-rules.test.ts
 *
 * Ограничение то же: Tailwind кладёт в собранный CSS только классы, которые видел
 * НА МОМЕНТ СБОРКИ живой панели. Новый класс здесь не покрасится — смотреть надо
 * на раскладку и на то, как читается фраза, а не на единственный в своём роде
 * оттенок.
 *
 * ВАЖНО про данные ниже: это ПРИМЕРЫ ДЛЯ СМОТРЕЛКИ, а не фикстуры продукта. В
 * самом листе выдуманных правил нет ни одного — он показывает только то, что
 * человек завёл сам. Здесь же нужны все восемь состояний разом, включая те,
 * которых сегодня не бывает (движка нет), — иначе на них невозможно посмотреть
 * до появления сервера.
 */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyRules, RuleCard, RuleComposer, RulesView, StateGlossary } from "@/components/views/RulesView";
import { blankDraft, draftFromRule, type RuleDraft } from "@/lib/rules-draft";
import type { Rule, RuleRunContext, RuleStateKind } from "@/lib/rules";

const ЦЕЛЬ = "120210000000000000";

function правило(over: Partial<Rule> = {}): Rule {
  return {
    id: "r1",
    name: "ночной сторож",
    scope: "adset",
    targetId: ЦЕЛЬ,
    targetName: "Rome_CPL",
    condition: { metric: "cpl", comparator: "gte", value: 12, windowHours: 24 },
    action: "pause",
    checkIntervalMin: 30,
    enabled: true,
    ...over,
  };
}

/** По одному контексту на каждое из восьми состояний — ровно так, как их
 *  различает `ruleState`. */
const СОСТОЯНИЯ: { state: RuleStateKind; rule: Rule; ctx: RuleRunContext }[] = [
  { state: "off", rule: правило({ enabled: false }), ctx: { engineRunning: true, runnable: true } },
  { state: "no_engine", rule: правило(), ctx: { engineRunning: false, runnable: true } },
  { state: "waiting", rule: правило(), ctx: { engineRunning: true, runnable: true } },
  {
    state: "ok",
    rule: правило(),
    ctx: { engineRunning: true, runnable: true, lastCheckedAt: "2026-08-15T09:00:00Z", lastValue: 7 },
  },
  {
    state: "confirming",
    rule: правило(),
    ctx: { engineRunning: true, runnable: true, pausePending: true },
  },
  {
    state: "fired",
    rule: правило(),
    ctx: {
      engineRunning: true,
      runnable: true,
      lastCheckedAt: "2026-08-15T09:00:00Z",
      lastFired: { at: "2026-08-15T09:00:00Z", metric: "cpl", value: 41 },
    },
  },
  {
    state: "failed",
    rule: правило({ action: "resume", scope: "campaign", targetName: "Rome_scale" }),
    ctx: { engineRunning: true, runnable: true, failureReason: "Meta: (#100) permission error" },
  },
  {
    state: "unrunnable",
    rule: правило({ scope: "ad", targetName: "creo_dz5_9x16" }),
    ctx: {
      engineRunning: true,
      runnable: false,
      unrunnableReason: "act_2060387021243613 is not visible from any connected profile",
    },
  },
];

const ЗАПОЛНЕННЫЙ: RuleDraft = draftFromRule(правило());

/* Стили берём с ДИСКА собранной панели, а не по HTTP с 8790, и это не
   упрощение, а лечение.

   Соседняя смотрелка тянет CSS по ссылкам со страницы. На 15.08 это дало
   ненакрашенный лист: живой сервер под launchd отдаёт HTML прошлой сборки и
   ссылается на чанк, которого на диске уже нет, — главный файл Tailwind на
   119 КБ приезжал ответом 400. Хуже того, ответ-ошибка — это HTML, и первый
   же `</style>` внутри него закрывает наш блок стилей: страница показывала
   «400 Bad Request» вместо листа. Диск такого рассинхрона не знает.

   `PANEL_BUILD` можно задать снаружи: у воркtree своей сборки нет и быть не
   должно (`next build` на маке запрещён), поэтому по умолчанию смотрим в
   общее дерево, где панель и собрана. */
async function panelCss(): Promise<string> {
  const dir = `${process.env.PANEL_BUILD || "/Users/mac/obelista_mcp/panel"}/.next/static/css`;
  if (!fs.existsSync(dir)) {
    console.log(`смотрелка: сборки панели нет в ${dir} — страница будет без стилей`);
    return "";
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .map((f) => fs.readFileSync(`${dir}/${f}`, "utf8"))
    .join("\n");
}

describe("смотрелка листа автоправил", () => {
  it("рисует лист в HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log(
        "смотрелка: PREVIEW_OUT не задан, ничего не нарисовано. Посмотреть лист глазами —\n" +
          "  PREVIEW_OUT=/tmp/rules.html npx vitest run lib/__tests__/preview-rules.test.ts\n" +
          "  (рядом ляжет /tmp/rules-dark.html; стили берутся из сборки панели в общем дереве)"
      );
      return;
    }

    const заголовок = (t: string) =>
      `<p style="margin:28px 0 10px;font:600 13px system-ui;opacity:.6">${t}</p>`;

    const body =
      /* Лист целиком — тот самый первый кадр, который отдаёт сервер: правила
         приезжают из localStorage эффектом, а на сервере его нет. Смотреть
         тут надо на шапку, баннер и фильтр корзин. */
      заголовок("лист целиком — первый кадр, правил ещё нет") +
      renderToStaticMarkup(createElement(RulesView)) +
      заголовок("пустое состояние — приглашение написать первое правило") +
      renderToStaticMarkup(createElement(EmptyRules, { onNew: () => {} })) +
      заголовок("конструктор — пустой черновик: незаполненное видно пунктиром") +
      renderToStaticMarkup(
        createElement(RuleComposer, {
          draft: blankDraft(),
          onChange: () => {},
          onSave: () => {},
          onCancel: () => {},
        })
      ) +
      заголовок("конструктор — заполненная фраза и «что произойдёт»") +
      renderToStaticMarkup(
        createElement(RuleComposer, {
          draft: ЗАПОЛНЕННЫЙ,
          onChange: () => {},
          onSave: () => {},
          onCancel: () => {},
        })
      ) +
      заголовок("конструктор — правило, которое сработает на первой же проверке") +
      renderToStaticMarkup(
        createElement(RuleComposer, {
          draft: { ...ЗАПОЛНЕННЫЙ, metric: "spend", value: 0, windowHours: 1, checkIntervalMin: 1440 },
          onChange: () => {},
          onSave: () => {},
          onCancel: () => {},
        })
      ) +
      заголовок("карточки — все восемь состояний подряд") +
      renderToStaticMarkup(
        createElement(
          Fragment,
          null,
          СОСТОЯНИЯ.map((s) =>
            createElement(
              "div",
              { key: s.state, style: { marginBottom: "10px" } },
              createElement(RuleCard, { rule: s.rule, ctx: s.ctx, onEdit: () => {}, onToggle: () => {} })
            )
          )
        )
      ) +
      заголовок("глоссарий состояний") +
      renderToStaticMarkup(createElement(StateGlossary, { defaultOpen: true }));

    const css = await panelCss();
    const page = (theme: string) =>
      `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
      `<title>rules · ${theme}</title><style>${css}</style>` +
      `<body class="bg-background text-foreground" style="padding:24px">` +
      `<div style="max-width:900px;margin:0 auto">${body}</div></body></html>`;

    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, page("light"));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html", page("dark"));
  });
});

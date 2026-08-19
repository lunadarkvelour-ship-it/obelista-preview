/* ВЁРСТКА пустых состояний листа аналитики, а не решение о ней.
 *
 * Заведён по возврату приёмки 14.08. Решение (`emptyKind`) было закрыто
 * тестами, а вёрстка, которая его читает, — ничем: `vitest.config.ts` собирает
 * только `lib/**`, тестов в `components/` нет ни одного. Приёмщик вырезал
 * пустое состояние из листа целиком и отдельно подменил его заголовок ровно на
 * признак поломки — «No snapshot yet — check that the daemon is running» — и
 * оба раза получил 502 зелёных теста из 502.
 *
 * То есть между честным текстом на первом экране нового человека и признаком
 * аварии не стояло ничего, кроме глаз читающего дифф.
 *
 * ПОЧЕМУ ТЕСТ РЕНДЕРИТ КОМПОНЕНТ, А НЕ ЛИСТ ЦЕЛИКОМ. Данные листа приезжают
 * эффектом, а `renderToStaticMarkup` эффектов не выполняет — до состояния
 * «ответ пришёл, строк ноль» так не добраться в принципе. Поэтому вёрстка
 * пустых состояний вынесена в свой компонент, который принимает готовый `kind`.
 * Отдельным случаем ниже проверено, что лист этот компонент действительно
 * зовёт: без этого можно было бы выбросить его из листа и остаться зелёным.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalyticsEmpty } from "@/components/analytics/AnalyticsEmpty";
import { AnalyticsView } from "@/components/views/AnalyticsView";
import type { EmptyKind } from "@/lib/analytics-empty";

const рисуй = (kind: EmptyKind, detail: string | null = null) =>
  renderToStaticMarkup(createElement(AnalyticsEmpty, { kind, detail, onRetry: () => {} }));

/* Слова, которые на продуктовом экране означают, что мы соврали.
 *
 * «snapshot» и «daemon» человек не знает — это наши внутренние слова; в облаке
 * снапшота не будет никогда (решение 26 плана), и совет «проверь, запущен ли
 * демон» предлагает чинить то, чего у него нет. `venv/bin/python …` — прямая
 * инструкция разработчика. AdsPower из продукта убран целиком. */
const ЗАПРЕЩЕНО = ["snapshot", "daemon", "venv/bin", "AdsPower", "127.0.0.1", "No data"];

describe("пустой срез объясняется и даёт выход", () => {
  it("говорит, что здесь пусто", () => {
    expect(рисуй("empty-range")).toContain("Nothing in this range yet");
  });

  it("называет механизм: цифры приходят от Меты по подключённым аккаунтам", () => {
    // Диагноз намеренно не ставится: различить «не с чего собирать» и «нечего
    // показать за этот диапазон» отсюда нечем — список профилей антидетекта в
    // облаке пуст всегда. Поэтому названы механизм и оба выхода.
    const html = рисуй("empty-range");
    expect(html).toContain("come from Meta");
    expect(html).toContain("date range");
  });

  it("даёт кнопку туда, где работа продолжается", () => {
    // Без неё пустой экран — тупик: человек прочитал, что делать, и не нашёл чем.
    const html = рисуй("empty-range");
    expect(html).toContain('href="/socials"');
    expect(html).toContain("Go to profiles");
  });
});

describe("обрыв связи объясняется так же честно", () => {
  // Обе ветки пустоты честны намеренно: на нулевой базе в облаке заранее
  // неизвестно, что придёт — пустой ответ или упавший запрос. Пока честной
  // была одна, отличить успех от аварии можно было только угадав, какая
  // появится.
  it("говорит, что цифры не загрузились", () => {
    expect(рисуй("error")).toContain("Could not load the numbers");
  });

  it("успокаивает по существу: данные не потеряны", () => {
    expect(рисуй("error")).toContain("Nothing is lost");
  });

  it("даёт повторить, а не оставляет тупик", () => {
    expect(рисуй("error")).toContain("Try again");
  });

  it("показывает, что именно ответила сеть, если это известно", () => {
    expect(рисуй("error", "No answer from the collector.")).toContain("No answer from the collector.");
  });
});

describe("остальные состояния названы по-разному, а не «No data»", () => {
  it("колонки выключены — данные на месте, показать нечем", () => {
    expect(рисуй("all-columns-off")).toContain("Every column is turned off");
  });

  it("срез ещё не запрашивали", () => {
    expect(рисуй("not-requested")).toContain("not been requested");
  });

  it("запрос в пути", () => {
    expect(рисуй("loading")).toContain("Loading");
  });

  it("для таблицы пустого состояния нет вовсе", () => {
    expect(рисуй("table")).toBe("");
  });
});

describe("на экране не остаётся ни одного нашего внутреннего слова", () => {
  for (const kind of ["empty-range", "error", "loading", "all-columns-off", "not-requested"] as const) {
    it(`«${kind}» чист`, () => {
      const html = рисуй(kind, "No answer from the collector.");
      for (const слово of ЗАПРЕЩЕНО) expect(html).not.toContain(слово);
    });
  }
});

describe("лист действительно зовёт этот компонент", () => {
  /* Без этого случая пустое состояние можно выбросить из листа целиком и
     остаться зелёным — ровно то, что приёмка и проделала. Эффекты в
     `renderToStaticMarkup` не выполняются, поэтому лист на первом проходе
     стоит в состоянии «запрос в пути»; его текст и ищем. */
  const html = renderToStaticMarkup(createElement(AnalyticsView));

  it("рисует пустое состояние, а не пустоту", () => {
    expect(html).toContain("Loading");
  });

  it("инструкции разработчика на листе нет", () => {
    expect(html).not.toContain("venv/bin");
    expect(html).not.toContain("analytics_daemon.py");
  });
});

describe("инструкции разработчика нет и в ИСХОДНИКЕ листа", () => {
  /* Проверка по исходнику, а не по рендеру, и это не лень.
     Строка ошибки задаётся в `catch` запроса, то есть в состоянии, до которого
     `renderToStaticMarkup` не доходит: эффектов он не выполняет, запрос не
     уходит, `catch` не срабатывает. Проверено опытом — вернув
     «Run: venv/bin/python scripts/analytics_daemon.py» в `AnalyticsView`, я
     получила 18 зелёных из 18. То есть по рендеру этот дефект неотличим от его
     отсутствия, и единственное честное место проверки — текст файла.

     Ищем в тех файлах, которые составляют лист аналитики. Шире не берём
     намеренно: чужой файл, покрасневший в моём PR, — это чужая работа,
     остановленная моим тестом. */
  const файлы = [
    "components/views/AnalyticsView.tsx",
    "components/analytics/AnalyticsEmpty.tsx",
  ];

  for (const файл of файлы) {
    it(`${файл} не предлагает человеку запускать команды`, () => {
      const текст = readFileSync(файл, "utf-8");
      /* Только строковые литералы: в комментариях команда встречается как
         рассказ о том, ЧТО убрали, и запрещать это значило бы запретить
         объяснять причину. */
      const литералы = текст.match(/"[^"\n]*"|'[^'\n]*'/g) ?? [];
      const виновные = литералы.filter(
        (s) => s.includes("venv/bin") || s.includes("analytics_daemon.py"),
      );
      expect(виновные).toEqual([]);
    });
  }
});

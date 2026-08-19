/* Вердикт о сборе доехал до ЭКРАНА, а не только до модели (#140).
 *
 * Модель проверена рядом (`collector-health.test.ts`), но она ничего не
 * красит. Ошибка, ради которой написан этот файл, живёт именно в стыке: взять
 * цвет из имени состояния, а не из поля «тревога», можно ровно один раз — в
 * компоненте, — и ни один тест модели этого не заметит.
 *
 * Мест два, и они делят работу:
 *   — `DataState` (индикатор в полосе итогов): диагноз одной строкой и цвет;
 *     подробности у него в поповере, то есть за нажатием, и в разметке до
 *     нажатия их нет — это нормально и проверяется здесь как факт;
 *   — `CollectorVerdict` (плашка над цифрами, одна на все листы): несёт ЧИСЛА
 *     без единого нажатия и красит по «тревога». Спокойный тон он показывает
 *     или гасит по `showNotice` — гасят там, где про то же есть своя плашка.
 *
 * Рисуем серверным рендером: эффекты не выполняются, сеть не нужна, разметка
 * настоящая. Проверяем смысл — слово и класс тревоги, — а не вёрстку.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectorVerdict } from "@/components/sections/CollectorVerdict";
import { DataState } from "@/components/analytics/DataState";
import type { CollectorState } from "@/lib/analytics";

/** Живое состояние сбора без вердикта — из него тесты добавляют «здоровье». */
const СБОР: CollectorState = {
  ok: true,
  running: true,
  blocked: false,
  blocked_msg: "",
  blocked_since_s: null,
  spend_data_at: new Date().toISOString(),
  funnel_data_at: new Date().toISOString(),
  profile_errors: {},
  sweep_total: 0,
  detail_total: 0,
  sweep_ago_s: null,
  hot: 3,
  cycle_accounts: 10,
  app_usage_pct: 12,
  success_rate: 1,
  hold_s: 0,
  last_error: "",
};

const ЗАПЕРТ = {
  состояние: "заперт",
  почему: "Мета не пускает: OAuthException code 200",
  тревога: false,
  подъёмов: 1,
  уронов: 0,
  окно_с: 1800,
  последняя_запись_с: 300,
};

const МИГАЕТ = {
  состояние: "мигает",
  почему: "демон поднимался 47 раз за 30 мин — это цикл перезапусков",
  тревога: true,
  подъёмов: 47,
  уронов: 47,
  окно_с: 1800,
  последняя_запись_с: null,
};

const ОСТЫЛ = {
  состояние: "остыл",
  почему: "Мета показывает деньги за сегодня, а последняя запись — 41 мин назад",
  тревога: true,
  подъёмов: 1,
  уронов: 0,
  окно_с: 1800,
  последняя_запись_с: 2460,
};

function индикатор(здоровье: unknown): string {
  return renderToStaticMarkup(
    createElement(DataState, {
      st: { ...СБОР, здоровье },
      byMoney: null,
      ads: null,
      branches: {},
    }),
  );
}

/** Плашка, как её показывает лист аналитики: спокойный тон там гасят, потому
 *  что про блокировку строкой выше стоит своя, более подробная. */
function плашка(здоровье: unknown): string {
  return renderToStaticMarkup(
    createElement(CollectorVerdict, { st: { ...СБОР, здоровье }, showNotice: false }),
  );
}

/** Она же на листе, где своей плашки про блокировку нет, — например на листе
 *  кабинетов. Там молчать о «заперт» нельзя: цифры не обновляются и там тоже. */
function плашкаСоСпокойным(здоровье: unknown): string {
  return renderToStaticMarkup(
    createElement(CollectorVerdict, { st: { ...СБОР, здоровье } }),
  );
}

describe("индикатор: заперт виден, но не красный", () => {
  const html = индикатор(ЗАПЕРТ);

  it("сказано словами, что именно со сбором", () => {
    expect(html).toContain("Meta is not letting us in");
  });

  it("НЕ красный: цвет тревоги на нём не появляется", () => {
    /* Ровно та ошибка, ради которой в контракте отдельное поле «тревога»:
       покрасив «заперт» вместе с «остыл», панель посылает владельца чинить
       то, что чинится в дашборде Меты, а не у нас. */
    expect(html).not.toContain("text-destructive");
    expect(html).not.toContain("bg-dot-dead");
  });

  it("и плашки тревоги не поднимает — чинить нечего", () => {
    expect(плашка(ЗАПЕРТ)).toBe("");
  });

  it("а там, где своей плашки про блокировку нет, — говорит спокойным тоном", () => {
    /* Промолчать о «заперт» на листе, где на цифры смотрят, значит сделать ровно
       то, против чего иссус: цифры не обновляются, и человек об этом не знает.
       Но и красным его красить нельзя — чинится он не у нас. */
    const html = плашкаСоСпокойным(ЗАПЕРТ);
    expect(html).toContain('data-tone="notice"');
    expect(html).toContain("Meta is not letting us in");
    expect(html).not.toContain("text-destructive");
  });
});

describe("индикатор: авария красная и названа своим именем", () => {
  it("мигает — красный, с заголовком про цикл перезапусков", () => {
    const html = индикатор(МИГАЕТ);
    expect(html).toContain("Collector is restarting in a loop");
    expect(html).toContain("text-destructive");
    expect(html).toContain("bg-dot-dead");
  });

  it("остыл — тоже красный, потому что демон поднял тревогу", () => {
    const html = индикатор(ОСТЫЛ);
    expect(html).toContain("Collection has gone cold");
    expect(html).toContain("text-destructive");
  });
});

describe("плашка листа: числа видны без единого нажатия", () => {
  const html = плашка(МИГАЕТ);

  it("тон объявлен атрибутом, а не только цветом", () => {
    /* «Покрасили по имени состояния» иначе ловится только глазами и только в
       момент аварии. Атрибут виден и тесту, и человеку в инспекторе. */
    expect(html).toContain('data-tone="alarm"');
    expect(плашкаСоСпокойным(ОСТЫЛ)).toContain('data-tone="alarm"');
  });

  it("кто крутит цикл — видно без единого нажатия", () => {
    /* Разница «подъёмов» и «уронов» отвечает на главный вопрос аварии, и
       отвечать она обязана на самом экране, а не в поповере. */
    expect(html).toContain("47 of them killed by the watchdog");
  });

  it("сорок семь подъёмов — числом, иначе «мигает» звучит как мелочь", () => {
    expect(html).toContain("restarted 47 times in 30 min");
  });

  it("сказано, что записи не было ни разу за подъём", () => {
    expect(html).toContain("no successful write since the last start");
  });

  it("причина показана словами демона — только он знает конкретику", () => {
    expect(html).toContain("демон поднимался 47 раз");
  });

  it("сказано, чем это грозит цифрам и автоправилам", () => {
    expect(html).toMatch(/automation rules/i);
  });

  it("на «остыл» показывает возраст последней записи", () => {
    expect(плашка(ОСТЫЛ)).toContain("last successful write 41 min ago");
  });
});

describe("тишина там, где сказать нечего", () => {
  it("сбор идёт — ни плашки, ни слова про сбор в индикаторе", () => {
    const идёт = {
      состояние: "идёт", почему: "", тревога: false,
      подъёмов: 1, уронов: 0, окно_с: 1800, последняя_запись_с: 40,
    };
    expect(плашка(идёт)).toBe("");
    expect(индикатор(идёт)).not.toContain("Collection is running");
    expect(индикатор(идёт)).not.toContain("text-destructive");
  });

  it("демон старше контракта — лист жив и работает по-старому", () => {
    /* Поля «здоровье» нет вовсе: на маке демон обновляется рестартом Claude
       Desktop, и какое-то время его не будет. Молча позеленеть здесь нельзя,
       но и упасть тоже. */
    expect(плашка(undefined)).toBe("");
    const html = индикатор(undefined);
    expect(html.length).toBeGreaterThan(100);
    expect(html).not.toContain("Collection has gone cold");
  });

  it("половинчатый вердикт не поднимает тревогу на пустом месте", () => {
    expect(плашка({ состояние: "мигает" })).toBe("");
  });
});

/* Итоговая строка таблицы аналитики.
 *
 * Складывать можно не всё. Спенд, депозиты и подписки — суммируются; а цена
 * депа и конверсия — НЕТ: среднее от средних врёт тем сильнее, чем неравномернее
 * строки. Крео с одним депом за $290 и крео с десятью по $58 дают «среднюю
 * цену» $174, хотя на деле потрачено $1535 на 11 депов, то есть $139. Разница
 * в полтора раза — на такой цифре закрывают связки.
 *
 * Поэтому производные считаются ЗАНОВО из просуммированных составляющих:
 * итоговый CPFTD = сумма спенда / сумма FTD. Это тот же способ, которым их
 * считает движок для одной строки (`core/leaderboard.py`), просто на всём
 * наборе.
 */
import type { ColKey } from "./analytics-columns";
import {
  FUNNEL_DERIVED, LEADERBOARD_FUNNEL_IDS, divideFunnel, sumFunnel,
  type FunnelCostId, type FunnelOperandId, type FunnelRatioId,
  type LeaderboardFunnelId,
} from "./funnel-metrics";

type Maybe = number | null | undefined;

/** Всё, из чего считается любая колонка. Итог берётся по ПОКАЗАННЫМ строкам:
 *  включил фильтр по гео — итог про это гео, иначе он спорил бы с таблицей.
 *
 *  Ступени перечислены НЕ РУКАМИ: их имена приходят из общего каталога
 *  воронки, и заведённая там ступень попадает сюда сама — вместе с проверкой
 *  типов у всех, кто такую строку собирает. */
export type Summable = {
  spend: Maybe;
  clicks: Maybe;
  ads: Maybe;
  ads_with_ftd: Maybe;
  geos?: string[];
} & { [K in LeaderboardFunnelId]: Maybe };

export type Totals = БазовыйИтог
  & { [K in LeaderboardFunnelId | FunnelCostId | FunnelRatioId]: number | null };

interface БазовыйИтог {
  /* СУММА, КОТОРОЙ НЕ ИЗ ЧЕГО СЛОЖИТЬСЯ, — НЕ НОЛЬ (#122).
   *
   *  Владелец нашёл это на живом листе: восемь строк показывали «не собрано», а
   *  строка Total под ними — «0» и прочерк. Человек смотрит вниз, читает «0
   *  подписок» и решает, что подписок нет. Их не ноль — их НЕ ЗНАЕМ.
   *
   *  Итог собирается ИЗ СТРОК, значит наследует и их незнание. Раньше `n(v)`
   *  превращал каждое «не знаем» в ноль ещё до сложения, и различие пропадало
   *  безвозвратно — сумма выглядела посчитанной. Теперь `null` доживает до
   *  экрана: ни одна строка не дала числа — итога нет. */
  spend: number | null;
  clicks: number | null;
  ads: number | null;
  ads_with_ftd: number | null;
  geos: string[];
  /** Сколько строк сложено — чтобы подпись не врала при включённом фильтре. */
  rows: number;
}

/** Сумма, которая отличает «нигде не было числа» от нуля. Ровно то же правило,
 *  что у `add` в `analytics-tree`: хоть один вклад — число, ни одного — `null`.
 *  Два разных ответа на «сколько», и складывать их в один нельзя. Функция одна
 *  на всю панель (`sumFunnel`) — двух реализаций одного правила не бывает. */
function сумма(rows: Summable[], key: string): number | null {
  return sumFunnel(rows.map((r) => (r as unknown as Record<string, unknown>)[key]));
}

export function totalsOf(rows: Summable[]): Totals {
  /* Ступени складываются по КАТАЛОГУ, а не по списку, переписанному сюда: до
     этого имена ступеней стояли в четырёх файлах разом, и «одинаковые метрики
     на двух листах» держались на том, что никто не опечатался. */
  const s: Record<string, number | null> = {
    spend: сумма(rows, "spend"),
    clicks: сумма(rows, "clicks"),
    ads: сумма(rows, "ads"),
    ads_with_ftd: сумма(rows, "ads_with_ftd"),
  };
  for (const id of LEADERBOARD_FUNNEL_IDS) s[id] = сумма(rows, id);

  /* Производные — из СУММ, а не усреднением производных (см. шапку файла), и
     теми же парами «что на что», какими их считает строка дерева. Конверсии
     остаются ДОЛЕЙ (0.39): на сто умножает форматтер `pct`. */
  const d: Record<string, number | null> = {};
  for (const def of FUNNEL_DERIVED) {
    d[def.id] = divideFunnel(
      s[def.numerator as FunnelOperandId],
      s[def.denominator as FunnelOperandId],
    );
  }

  const geos = new Set<string>();
  for (const r of rows) for (const g of r.geos || []) geos.add(g);
  return {
    ...s,
    ...d,
    geos: [...geos].sort(),
    rows: rows.length,
  } as unknown as Totals;
}

/** Значение итоговой строки для колонки. `undefined` — в этой колонке итога
 *  не бывает (гео — это перечисление, а не число, складывать его нечего). */
export function totalCell(t: Totals, key: ColKey): number | null | undefined {
  switch (key) {
    case "geos":
      return undefined;
    default:
      return (t as unknown as Record<string, number | null>)[key];
  }
}

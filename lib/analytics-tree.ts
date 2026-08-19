/**
 * Плоский список объявлений → дерево «крео → каб → кампания → объявление».
 *
 * Почему каб первым уровнем, а не кампания. Байер думает кабинетами: кабинет
 * это деньги, биллинг и бан. «Крео льётся на семи кабах, на трёх забанено» —
 * первый вопрос; «в какой кампании» — второй.
 *
 * Суммы на промежуточных узлах считаются снизу вверх, а не берутся из
 * лидерборда: иначе при срезе по гео итог каба не сойдётся с суммой его
 * кампаний, и таблице перестанут верить.
 */
import { hasMismatch } from "./analytics";
import type { AccountCheck, AdRow, Maybe } from "./analytics";
import {
  FUNNEL_DERIVED_BY_ID, LEADERBOARD_FUNNEL_IDS, divideFunnel, sumFunnel,
  type FunnelCostId, type FunnelRatioId,
} from "./funnel-metrics";
import type { Spark } from "./spark";

export type NodeKind = "creative" | "account" | "campaign" | "adset" | "ad";

export interface Node {
  id: string;
  kind: NodeKind;
  label: string;
  /** Общая часть нейминга у соседей — рисуется приглушённо. */
  prefix?: string;
  children?: Node[];

  spend: Maybe;
  clicks: Maybe;
  sub: Maybe;
  contact: Maybe;
  checkout: Maybe;
  ftd: Maybe;
  rd: Maybe;
  ads: Maybe;
  ads_with_ftd: Maybe;
  geos: string[];

  /** id объекта в Мете — на campaign, adset и ad. Это то, что уезжает в
   *  `manage`: тул принимает голые id и сам понимает уровень по ним. */
  fb_id?: string;
  /** Соц, которым ветку можно тушить. Приходит с кабинета и наследуется вниз:
   *  на строке объявления он нужен ровно так же, как на кабе, потому что
   *  экспорт группирует вызовы по соцам, а `manage` берёт один соц на вызов. */
  owner?: string | null;

  /** Узел сам совпал с поисковым запросом (не «внутри него нашлось»). Ставит
   *  фильтр, читает раскрытие: дорогу до находки надо раскрыть, а саму находку
   *  — нет, иначе поиск по общему куску нейминга вываливает весь лес. */
  hit?: boolean;

  /** Готовая геометрия спарклайна спенда. Только на крео: ниже её взять
   *  неоткуда — демон отдаёт подневный ряд в строке лидерборда, а лес
   *  объявлений приходит суммами за окно, без разбивки по дням. Считается один
   *  раз при сборке узла, а не в отрисовке: строк под сотню, и пересчитывать
   *  ряд на каждый ховер незачем. */
  spark?: Spark | null;

  /* ── возраст спенда ──────────────────────────────────────────────────────
     Едет с самой нижней строки наверх, потому что вопрос «можно ли верить этой
     цифре» задают к ЛЮБОЙ строке, а не только к объявлению. Свёрнутое крео,
     собранное из девяти застывших кабов, обязано выглядеть подозрительным до
     разворота — иначе повторяется #20: сумма выглядит свежей правдой. */

  /** Когда спенд строки снимали последний раз. У группы — САМЫЙ СТАРЫЙ замер
   *  среди детей: он и есть возраст суммы, слабое звено тянет всю. */
  spend_at?: string | null;
  /** Худший недобор суток среди детей, в секундах (см. `staleLevel`). */
  stale_gap_s?: Maybe;
  /** Сколько денег в этой сумме снято задолго до конца суток. */
  stale_spend?: Maybe;
  /** Что сторож нашёл по этому кабинету. Только на узле каба и только если
   *  сторож вообще доехал: нет записи — нет метки. */
  check?: AccountCheck;
  /** Расхождение есть здесь или ниже. На кабе — про сам каб, на крео — «среди
   *  его кабов есть несошедшийся». Отдельно от `check`, потому что подробности
   *  сверки живут на кабинете, а предупреждать надо и свёрнутую строку. */
  mismatch?: boolean;

  /** Когда цифры ВОРОНКИ этой строки приезжали в последний раз (#122).
   *
   *  У группы — САМАЯ СВЕЖАЯ отметка среди детей, а не самая старая, и это
   *  противоположно `spend_at` намеренно. Там вопрос «насколько стара эта
   *  сумма», и его решает слабое звено. Здесь вопрос другой: «есть ли в этой
   *  сумме хоть что-то собранное». Приехало хоть у одного ребёнка — сумма
   *  частично настоящая, и объявить её несобранной значит поставить метку на
   *  собранном, а такая метка дороже пропуска: она отменяет доверие ко всем
   *  остальным меткам сразу.
   *
   *  `null` только когда НИ У КОГО не приезжало; `undefined` — когда демон про
   *  это не сказал вовсе. */
  funnel_at?: string | null;

  /** Только у объявлений. */
  method?: string | null;
  status?: string | null;
  act_id?: string;
  /** Имя кабинета в Мете — только на узле каба. Приезжает в КАЖДОЙ строке леса
   *  (`acc.name AS act_name`, `scripts/analytics_daemon.py:893`) и до 15.08
   *  выбрасывалось при сборке дерева: строка каба подписывалась голым act_id, а
   *  имя разметка искала в снапшоте мака, которого в облаке нет вовсе. Отсюда
   *  «шляпа вместо данных о кабинете» (#132) — не порча данных, а потеря их по
   *  дороге. Держим на узле, потому что имя нужно и разметке, и выгрузке в CSV,
   *  и payload'у `manage`: три места, и все три не должны ходить в снапшот. */
  act_name?: string | null;
  /** Агентство кабинета. Оттуда же и затем же. */
  agency?: string | null;
  /** Соцы, которыми виден этот кабинет. Демон отдаёт их по каждому объявлению
   *  (`account_owner`), но на строке объявления они бессмысленны — кабинет у
   *  всех объявлений один. Собираем на уровне каба: «на каком соце этот каб»
   *  это первое, что спрашивают, увидев расход в незнакомом кабинете. */
  socials?: string[];
}

/* Ступени воронки берутся ИЗ КАТАЛОГА (`lib/funnel-metrics`), а не выписаны
   сюда руками: список, переписанный в третье место, разъезжается с каноном
   молча — ступень появится в схеме, движок начнёт её писать, а свёртка дерева
   продолжит складывать пять полей из шести и ни слова об этом не скажет.
   `spend` и `clicks` — величины Меты, к канону воронки они не относятся. */
const NUM: Array<keyof Node> = [
  "spend", "clicks", ...LEADERBOARD_FUNNEL_IDS,
] as Array<keyof Node>;

/** Сумма, которая умеет отличать «нигде не было данных» от нуля.
 *  Если ни у одного ребёнка значения нет — у родителя тоже нет, а не 0. */
function add(nodes: Node[], key: keyof Node): Maybe {
  return sumFunnel(nodes.map((n) => n[key]));
}

function roll(node: Node): Node {
  const kids = node.children || [];
  if (!kids.length) return node;
  for (const k of NUM) (node as unknown as Record<string, Maybe>)[k] = add(kids, k);
  node.ads = kids.reduce((s, k) => s + (k.ads ?? 0), 0);
  /* Через `add`, а не через `?? 0`: у ребёнка, чья воронка не приезжала, это
     поле пустое, и считать его нулём значит утверждать «депов не принесло» про
     то, чего мы не спрашивали (#122). Пусто у ВСЕХ — пусто и у группы; знает
     хоть один — сумма частично настоящая, и это уже число. */
  node.ads_with_ftd = add(kids, "ads_with_ftd");
  node.geos = [...new Set(kids.flatMap((k) => k.geos))].sort();
  /* Возраст суммы — по САМОМУ СТАРОМУ замеру среди детей, а недобор — по
     ХУДШЕМУ. Иначе один свежий каб в развороте делал бы всю строку свежей:
     сумма честна ровно настолько, насколько честно её слабое звено. */
  rollStale(node);
  return node;
}

/** Досыпать узлу возраст спенда из детей, НЕ трогая его суммы.
 *
 *  Отдельно от `roll` ради строки крео: её цифры приходят готовыми из
 *  лидерборда, а не считаются снизу вверх, и потому она единственная ничего не
 *  знает о возрасте собственных денег. Именно она и вводила в заблуждение
 *  (#20): свёрнутая строка выглядела свежей правдой, а под ней лежали девять
 *  застывших кабов. */
export function rollStale(node: Node): Node {
  const kids = node.children || [];
  if (!kids.length) return node;
  node.spend_at = oldest(kids);
  node.stale_gap_s = worst(kids);
  node.stale_spend = add(kids, "stale_spend");
  node.funnel_at = приезжалаЛиВоронка(kids);
  // «Здесь ИЛИ ниже», а не «только ниже»: у кабинета метка своя (её кладёт
  // `buildTree` из ответа сторожа), и затирать её сводкой по детям нельзя —
  // расхождение живёт на уровне каба, а его кампании о нём не знают.
  node.mismatch = node.mismatch || kids.some((k) => k.mismatch);
  return node;
}

/** Самый старый непустой замер среди детей. */
function oldest(kids: Node[]): string | null {
  let out: string | null = null;
  for (const k of kids) {
    const v = k.spend_at;
    if (!v) continue;
    if (out === null || v < out) out = v;
  }
  return out;
}

/** Приезжала ли воронка хоть к кому-то из детей (#122).
 *
 *  Три ответа, и все три нужны:
 *    • строка — САМАЯ СВЕЖАЯ отметка: в сумме есть собранное;
 *    • `null` — ни у кого не приезжало, и нули в этой строке значат «не знаем»;
 *    • `undefined` — ни один ребёнок про это не сказал, то есть демон старше
 *      контракта. Тогда молчим: пометить весь лист «не собрано» на старом
 *      демоне значит отменить доверие ко всем меткам разом.
 *
 *  Ребёнок без поля не делает `null` всей группой и наоборот: `undefined`
 *  отдаётся только когда так ответили ВСЕ. */
function приезжалаЛиВоронка(kids: Node[]): string | null | undefined {
  let свежая: string | null = null;
  let сказалХотьКто = false;
  for (const k of kids) {
    if (!("funnel_at" in k) || k.funnel_at === undefined) continue;
    сказалХотьКто = true;
    const v = k.funnel_at;
    if (v && (свежая === null || v > свежая)) свежая = v;
  }
  if (!сказалХотьКто) return undefined;
  return свежая;
}

/** Худший недобор суток среди детей. */
function worst(kids: Node[]): Maybe {
  let out: Maybe = null;
  for (const k of kids) {
    const v = k.stale_gap_s;
    if (v == null) continue;
    if (out === null || v > out) out = v;
  }
  return out;
}

/** Общий префикс группы имён по разделителю `--`.
 *  Нейминги проекта построены из токенов через `--`, и резать по символам
 *  значит обрывать слова на середине — читать такое хуже, чем не приглушать. */
export function commonPrefix(names: string[]): string {
  if (names.length < 2) return "";
  const parts = names.map((n) => n.split("--"));
  const first = parts[0];
  let i = 0;
  while (i < first.length && parts.every((p) => p[i] === first[i])) i++;
  if (i === 0) return "";
  const pre = first.slice(0, i).join("--");
  // Целиком совпавшее имя приглушать нельзя — строка станет пустой.
  return names.every((n) => n === pre) ? "" : pre + "--";
}

function withPrefix(nodes: Node[]): Node[] {
  const pre = commonPrefix(nodes.map((n) => n.label));
  if (pre) for (const n of nodes) n.prefix = pre;
  return nodes;
}

function group<T>(items: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

function adNode(r: AdRow): Node {
  return {
    id: "ad:" + r.fb_id,
    kind: "ad",
    label: r.ad_name,
    fb_id: r.fb_id,
    owner: r.owner_profile,
    spend: r.spend,
    clicks: r.clicks,
    sub: r.sub,
    contact: r.contact,
    checkout: r.checkout,
    ftd: r.ftd,
    rd: r.rd,
    ads: 1,
    /* «Принесло ли это объявление хоть один деп» — вопрос К ВОРОНКЕ, и когда
       она не приезжала ни разу, ответа нет: ноль здесь означал бы «не принесло»
       (#122). Проба колонок этого случая не видит и видеть не может — поле
       считается ЗДЕСЬ, а не в `derive`, — поэтому честность у него своя. */
    ads_with_ftd: r.funnel_at === null ? null : (r.ftd ?? 0) > 0 ? 1 : 0,
    geos: r.geo ? [r.geo] : [],
    method: r.attrib_method,
    status: r.effective_status,
    act_id: r.act_id,
    /* Демон постарше этих полей не отдаёт вовсе — тогда `undefined`, и лист
       просто молчит о возрасте. Ноль тут был бы враньём в другую сторону. */
    spend_at: r.spend_at ?? null,
    stale_gap_s: r.stale_gap_s ?? null,
    stale_spend: r.stale_spend ?? null,
    /* А ВОТ ЗДЕСЬ `?? null` БЫЛО БЫ ОШИБКОЙ, и ровно той, против которой #122.
       У соседей выше `null` значит «демон не сказал» и лист молчит; у воронки
       `null` — это его СЛОВА: «не приезжало ни разу», и по ним лист печатает
       вместо нулей «не собрано». Схлопнув сюда отсутствие поля, мы объявили бы
       несобранной всю воронку на любом демоне постарше — то есть отменили бы
       доверие ко всем меткам разом первым же обновлением. */
    funnel_at: "funnel_at" in r ? r.funnel_at ?? null : undefined,
  };
}

/** Производные метрики считаются из базовых на лету, а не берутся готовыми из
 *  лидерборда: тогда они одинаково работают и на строке крео, и на кабе, и на
 *  кампании, и на объявлении. Иначе при развороте вся колонка цен — прочерки.
 *
 *  ЧТО НА ЧТО ДЕЛИТСЯ — не здешнее знание. Пары живут в общем каталоге
 *  (`FUNNEL_DERIVED`), потому что тот же вопрос задают итог таблицы и лист
 *  «Кампании»: три `switch` с тремя своими порядками разъехались бы молча, и
 *  цена ступени перестала бы совпадать сама с собой на соседнем листе.
 *
 *  Деление отказывается врать: знаменатель `<= 0` даёт прочерк, а не число
 *  (`divideFunnel`). Ноль тут бывает двух сортов — «связка не показывалась» и
 *  «рост съеден пересчётом трекера вниз», — и в обоих цена не определена. */
export function derive(n: Node, key: string): Maybe {
  const d = FUNNEL_DERIVED_BY_ID[key as FunnelCostId | FunnelRatioId];
  if (d) {
    const поле = (k: string) => (n as unknown as Record<string, Maybe>)[k];
    return divideFunnel(поле(d.numerator), поле(d.denominator));
  }
  return (n as unknown as Record<string, Maybe>)[key] ?? null;
}

/** По убыванию депов, затем по расходу: сверху то, что заработало, под ним
 *  то, что съело деньги молча. */
function byResult(a: Node, b: Node): number {
  return (b.ftd ?? 0) - (a.ftd ?? 0) || (b.spend ?? 0) - (a.spend ?? 0);
}

/** Все ветки среза разом: имя крео → его кабы.
 *
 *  Заменила загрузку ветки по клику. Ленивость казалась экономией, а обходилась
 *  тем, что половина листа работала вслепую: фильтр по соцу не находил, что
 *  резать, статусы собирались из пустого набора, сохранённый разворот
 *  открывался пустым, а подсвеченная строка не попадала в счётчик выделенного,
 *  потому что узла под ней не существовало. Цена полного леса замерена на живой
 *  базе: 1189 объявлений, 707 КБ, 40 мс на весь диапазон — дешевле, чем один
 *  сетевой поход на каждый разворот.
 *
 *  Группировку и суммы делает тот же `buildTree`: два разных сборщика означали
 *  бы, что ветка и дерево умеют разойтись в цифрах.
 *
 *  @param checks что сторож нашёл по кабинетам. Необязателен: движковая
 *  половина #20 доезжает своим ходом, и до неё лист обязан работать как
 *  работал — без меток, а не с пустыми. */
export function buildForest(
  ads: AdRow[],
  checks?: Record<string, AccountCheck>,
): Record<string, Node[]> {
  const out: Record<string, Node[]> = {};
  for (const [name, rows] of group(ads, (r) => r.creative)) {
    out[name] = buildTree(rows, checks);
  }
  return out;
}

export function buildTree(
  ads: AdRow[],
  checks?: Record<string, AccountCheck>,
): Node[] {
  const byAcct = group(ads, (r) => r.act_id);
  const accounts: Node[] = [];

  for (const [act, rowsOfAcct] of byAcct) {
    /* Исполнитель у всех объявлений каба один — он свойство КАБИНЕТА, а не
       объявления. Берём первый непустой: демон отдаёт его в каждой строке
       одинаковым, но строка без него встречается, когда каб виден только с
       соца без токена. */
    const owner = rowsOfAcct.find((r) => r.owner_profile)?.owner_profile ?? null;

    /* Группируем по ID, а не по имени. Имена в Мете не уникальны: два залива
       одним шаблоном дают две кампании с одинаковой строкой, и группировка по
       имени сливала их в один узел — разворот показывал чужие объявления, а
       потушить узел было нечем, потому что `manage` принимает только id.
       Пустой id (объявление залито не нами, кампании у нас нет) даёт свой
       собственный узел-сироту, а не смешивается с чужими. */
    const byCamp = group(rowsOfAcct, (r) => r.campaign_id || "");
    const campaigns: Node[] = [];

    for (const [campId, rowsOfCamp] of byCamp) {
      const byAdset = group(rowsOfCamp, (r) => r.adset_id || "");
      const adsets: Node[] = [];

      for (const [adsetId, rowsOfAdset] of byAdset) {
        const kids = withPrefix(rowsOfAdset.map(adNode)).sort(byResult);
        adsets.push(roll({
          id: adsetId ? `adset:${act}:${adsetId}` : `adset:${act}:${campId}:нет`,
          kind: "adset",
          label: rowsOfAdset[0].adset || "без адсета",
          fb_id: adsetId || undefined,
          owner,
          act_id: act,
          children: kids,
          spend: null, clicks: null, sub: null, contact: null,
          checkout: null, ftd: null, rd: null, ads: null,
          ads_with_ftd: null, geos: [],
        }));
      }

      campaigns.push(roll({
        id: campId ? `camp:${act}:${campId}` : `camp:${act}:нет`,
        kind: "campaign",
        label: rowsOfCamp[0].campaign || "без кампании",
        fb_id: campId || undefined,
        owner,
        act_id: act,
        children: withPrefix(adsets).sort(byResult),
        spend: null, clicks: null, sub: null, contact: null,
        checkout: null, ftd: null, rd: null, ads: null,
        ads_with_ftd: null, geos: [],
      }));
    }

    /* На строке каба стоит его ID, а не имя. Имя каба живёт в кабинете Меты и
       меняется, дублируется у разных агентств и ничего не говорит о том, куда
       смотреть дальше; ID — то, чем каб опознаётся в `manage`, в логах джоб и
       в самой Мете, и его можно скопировать отсюда и вставить туда. */
    accounts.push(roll({
      id: "acct:" + act,
      kind: "account",
      label: act,
      act_id: act,
      /* Имя и агентство берём из первой строки, где они непусты: демон отдаёт
         их одинаковыми во всех строках каба (это JOIN с одной строкой
         `account`), но у каба, которого в реестре ещё нет, колонка пустая. */
      act_name: rowsOfAcct.find((r) => r.act_name)?.act_name ?? null,
      agency: rowsOfAcct.find((r) => r.agency)?.agency ?? null,
      owner,
      // Расхождение — свойство КАБИНЕТА: сторож сверяет сумму по объявлениям с
      // тем, что Мета говорит по кабу целиком, и ниже эта метка бессмысленна.
      check: checks?.[act],
      mismatch: hasMismatch(checks?.[act]),
      // Объединение по всем объявлениям каба: один кабинет бывает виден с
      // нескольких соцев, и показать надо все, а не первый попавшийся.
      socials: [...new Set(rowsOfAcct.flatMap((r) => r.socials || []))].sort(),
      children: withPrefix(campaigns).sort(byResult),
      spend: null, clicks: null, sub: null, contact: null,
      checkout: null, ftd: null, rd: null, ads: null,
      ads_with_ftd: null, geos: [],
    }));
  }

  return accounts.sort(byResult);
}

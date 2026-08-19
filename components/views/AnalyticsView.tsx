"use client";

/* Лист «Аналитика» — лидерборд по ИСХОДНЫМ неймингам крео.
 *
 * Одно крео живёт объявлениями в разных кабах, под разными именами и с разной
 * уникализацией. Сводит их не имя, а цепочка идентификаторов из логов заливки,
 * поэтому строка тут — это крео, а не кампания и не объявление.
 *
 * Данные берём у демона на 127.0.0.1:8791. С чужой машины лист покажет ошибку связи,
 * и это правильно: база локальная, в облако она не едет.
 */

import * as React from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/coss";
import { EyeOff, RefreshCw, ChevronsDownUp, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CTRL, CTRL_IDLE, CTRL_MUTED, CTRL_ON,
} from "@/components/analytics/controls";
import {
  api, money, num, staleLevel, DASH, NOT_A_CREATIVE,
  type Board, type CollectorState, type CreativeRow,
} from "@/lib/analytics";
import {
  accountFacts, profileDisplay, profileLabels, type AccountFact,
} from "@/lib/analytics-accounts";
import type { CloudAccountRow } from "@/lib/cloud-accounts";
import { loadVisible, saveVisible, type ColKey } from "@/lib/analytics-columns";
import { emptyKind } from "@/lib/analytics-empty";
import { buildForest, derive, rollStale, type Node } from "@/lib/analytics-tree";
import { makeSpark, sparkCeiling } from "@/lib/spark";
import { readCached } from "@/lib/snapshot";
import { useStore } from "@/lib/store";
import { cascadeSelect } from "@/lib/selection";
import { collectSelected } from "@/lib/analytics-export";
import { BOM, csvFilename, toCsv } from "@/lib/analytics-csv";
import { filterTree, pathsToHits } from "@/lib/analytics-filter";
import { FilterBar, type Filters } from "@/components/analytics/FilterBar";
import { CreativeTable, type Flat } from "@/components/analytics/CreativeTable";
import { PeriodPicker } from "@/components/views/PeriodPicker";
import {
  НАЧАЛЬНЫЙ, вURL, изURL, нуженЗапрос, оСуткахПарка, type PeriodQuery,
  type Запрошено,
} from "@/lib/period";
import { ColumnPicker } from "@/components/analytics/ColumnPicker";
import { SelectionBar } from "@/components/analytics/SelectionBar";
import { BranchSort, STATUS_KEY } from "@/components/analytics/BranchSort";
import { CollectorVerdict } from "@/components/sections/CollectorVerdict";
import { readOpenDays, неИтог, нижняяГраница } from "@/lib/analytics-final";
import { geoTabs } from "@/lib/analytics-geo";
import { DataState } from "@/components/analytics/DataState";
import { AnalyticsEmpty } from "@/components/analytics/AnalyticsEmpty";

/* Список гео больше не зашит: он собирается из самих данных (см. `geos` ниже).
   Захардкоженные четыре страны означали, что новое гео на листе не появится
   никогда — а гео у нас заводятся чаще, чем правится код. */

/* АРИФМЕТИКИ ДАТ ЗДЕСЬ БОЛЬШЕ НЕТ, И ЭТО ГЛАВНАЯ ПРАВКА ЛИСТА (#161).
 *
 * Стояло: `ymd(new Date())` и пресеты, считавшие «сегодня» и «минус семь дней»
 * ПРЯМО ЗДЕСЬ, в браузере. Значит у продукта было два ответа на вопрос «какое
 * сегодня число» — этот и `core/period.py` (UTC+3), — и совпадали они ровно
 * потому, что смотрел на них человек в том же поясе. Байер из Тбилиси получил
 * бы неделю, сдвинутую на день, без единой ошибки на экране; после полуночи по
 * своим часам он видел бы «сегодня», которого у продукта ещё нет.
 *
 * Теперь панель посылает ИМЯ пресета, а даты получает ОТВЕТОМ и ими же
 * подписывает экран (`lib/period.ts`, `PeriodPicker`). Единственная дата,
 * которую лист сравнивает, — `period.today` из того же ответа.
 */

/** Отдать текст файлом. Через Blob и objectURL, а не `data:` — срез на сотню
 *  строк упирается в лимит длины URL, и выгрузка молча обрывалась бы на
 *  середине. URL освобождаем сразу: держать его до перезагрузки страницы
 *  значит держать в памяти весь файл. */
function saveText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** @param until последний день среза — из ответа демона: по нему считается
 *  длина хвостовой корзины ряда (см. `lib/spark.ts`).
 *  @param ceiling общий потолок шкалы спарклайнов на весь срез. */
function creativeToNode(r: CreativeRow, until: string, ceiling: number | null): Node {
  return {
    id: "cr:" + r.creative,
    kind: "creative",
    label: r.creative,
    spend: r.spend, clicks: r.clicks, sub: r.sub, contact: r.contact,
    checkout: r.checkout, ftd: r.ftd, rd: r.rd,
    ads: r.ads, ads_with_ftd: r.ads_with_ftd, geos: r.geos || [],
    spark: makeSpark(r.days, r.days_bucket_days, until, ceiling),
  };
}


/** Состояние конвейера сбора, опрашиваемое отдельно от среза.
 *
 *  Отдельно потому, что срез — это ответ базы, и он приходит успешным даже
 *  тогда, когда в базу час никто ничего не клал. Свежесть цифр и успешность
 *  запроса — разные вещи, и путать их означает ровно тот случай, ради которого
 *  всё это написано: экран зелёный, спенд стоит с обеда.
 *
 *  Запрос уехал в TanStack Query: `refetchInterval` заменил setInterval, ручной
 *  `probe` стал invalidate+refetch, ошибка приводит к `st === null` через
 *  `enabled:false` с подменой на catch-обёртке — старое поведение «тихо занулить
 *  состояние на сбое» сохранено, чтобы экран не висел на прошлой блокировке. */
function useCollector(pollMs = 30_000) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["analytics", "collector"] as const,
    queryFn: () => api.collector(),
    refetchInterval: pollMs,
    /* Фокус здесь не нужен: пользователь листа аналитики не уходит со страницы
       надолго, а коллектор живёт своим расписанием. */
    retry: false,
  });
  /* `probe` — то, чего ждёт человек, нажимая «обновить»: не «перечитай базу», а
     «сходи и проверь». Сбор живёт своим расписанием и о снятой блокировке узнаёт
     сам не сразу; кнопка обязана уметь его пнуть. После probe инвалидируем
     кэш — следующий цикл refetch прочитает уже свежее состояние. */
  const pull = React.useCallback(
    async (probe = false) => {
      if (probe) {
        try {
          await api.collectorRefresh();
        } catch {
          /* Намеренно глотаем: probe — это «пнуть демона», и если он не
             ответил, следующий refetch сам покажет null. Сейчас упасть тут
             значило бы зависнуть на экране старой блокировки. */
        }
        await qc.invalidateQueries({ queryKey: ["analytics", "collector"] });
        return;
      }
      await query.refetch();
    },
    [qc, query],
  );
  /* Старая семантика: ошибка = null. useQuery хранит ошибку, но потребители
     листа спрашивают «есть ли состояние», а не «есть ли исключение». */
  const st: CollectorState | null = query.error ? null : query.data ?? null;
  return { st, pull };
}

/** Плашка блокировки. Не «что-то пошло не так», а что именно и что делать.
 *
 *  Молчать здесь нельзя: пока Мета держит приложение выключенным, спенд не
 *  придёт ни через кнопку «обновить», ни через час ожидания, и человек будет
 *  жать её по кругу — так и было. */
function BlockedBanner({ st }: { st: CollectorState }) {
  const h = st.blocked_since_s ? Math.floor(st.blocked_since_s / 3600) : 0;
  const m = st.blocked_since_s ? Math.floor((st.blocked_since_s % 3600) / 60) : 0;
  return (
    <div className="flex-none rounded-xl border border-destructive/40 bg-destructive-soft px-3 py-2">
      <p className="text-[12.5px] font-medium text-destructive">
        Meta has disabled API access for the app
        {st.blocked_since_s != null ? ` — ${h ? `${h}h ` : ""}${m}m ago` : ""}
      </p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-destructive/85">
        {st.blocked_msg || "OAuthException code 200"}. Every request returns this, with any
        token, including the profile check — so no new spend will arrive until the
        restriction is lifted in the developer dashboard (developers.facebook.com → app →
        Alerts / Required actions). Refresh does not fix it: the numbers below are the last
        collected. Collection stays quiet and rechecks access once every half hour with a
        single request.
      </p>
    </div>
  );
}


export function AnalyticsView() {
  const [board, setBoard] = React.useState<Board | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(true);
  const { st: collector, pull: pullCollector } = useCollector();

  /* ПЕРИОД — ОДНО ЗНАЧЕНИЕ, И ОНО ЖЕ ЖИВЁТ В АДРЕСЕ СТРАНИЦЫ.
   *
   *  Не пара строк `since`/`until`: пара — это два состояния, между которыми
   *  бывает промежуточное («начало уже новое, конец ещё старый»), и по нему
   *  уходил запрос. И не локальный `useState` без адреса: период — контекст
   *  раздела, он обязан пережить переход на другой лист и пересылку ссылки
   *  коллеге (`lib/period.ts`). Начальное значение читается из адреса, а не
   *  назначается: открытая по ссылке страница обязана показать то же окно.
   *
   *  «Сегодня» в `НАЧАЛЬНЫЙ` — это ИМЯ пресета, а не дата: считает её движок. */
  const [period, setPeriod] = React.useState<PeriodQuery>(НАЧАЛЬНЫЙ);
  const [geo, setGeo] = React.useState<string | null>(null);
  /* Крео без подключённого спенда прячем по умолчанию. Прочерк в деньгах —
     это не ноль, а «соц не подключён через приложение», и такие строки мешают
     ровно там, где ищешь дорогое и дешёвое. Скрытое пересчитываем и показываем
     числом: молча терять строки нельзя — это тот же принцип, что и покрытие. */
  const [hideNoSpend, setHideNoSpend] = React.useState(true);

  const [visible, setVisible] = React.useState<ColKey[]>([]);
  const [sortKey, setSortKey] = React.useState<ColKey>("ftd");
  const [sortDesc, setSortDesc] = React.useState(true);

  /* Ветки всех крео сразу, а не по клику.
   *
   *  Ленивая загрузка выглядела экономией, а была корнем половины поломок
   *  листа: фильтру по соцу нечего было резать (детей в памяти нет), список
   *  статусов собирался из пустоты, сохранённый разворот открывался пустым,
   *  подсвеченная строка не попадала в счётчик выделенного. Замерено на живой
   *  базе: весь диапазон — 1189 объявлений, 707 КБ, 40 мс. Один поход на срез
   *  вместо похода на каждый разворот. */
  const [branches, setBranches] = React.useState<Record<string, Node[]>>({});

  /* Строки `account` из базы — состояние кабинета и время его снятия.
   *
   *  Отдельным запросом и НЕОБЯЗАТЕЛЬНЫМ: демон постарше про `/accounts` не
   *  знает вовсе и отвечает «нет такого пути» (проверено на живом демоне на
   *  8791), а лист аналитики из-за этого падать не должен — имя кабинета всё
   *  равно приезжает вместе с лесом. Не ответил — значит просто нет состояния,
   *  и разворот честно скажет «unknown», а не нарисует живой кабинет. */
  /* Тип строки — `CloudAccountRow`, а не `CloudAccount`: демон кладёт в ответ
     ещё и `owners[]`, и это единственный источник имён соцев, который есть в
     облаке. Узким был ровно тип, данные приезжали всегда. */
  const [cloudAccounts, setCloudAccounts] = React.useState<CloudAccountRow[] | null>(null);

  /* Развороты и отметки живут в persist-сторе, а не в компоненте.
   *
   *  Раньше это были обычные useState, и `load()` обнулял их безусловно — а его
   *  зовёт авто-рефреш раз в минуту и каждый возврат во вкладку. Выходило, что
   *  отметил десять строк, ушёл в другое окно, вернулся — пусто. Именно из-за
   *  этого выделение нельзя было ни докопить, ни передать наружу: оно жило
   *  меньше, чем занимает выбор. */
  const snapshot = useStore((s) => s.snapshot);
  const analytics = useStore((s) => s.analytics);
  const setAnalytics = useStore((s) => s.setAnalytics);
  const open = React.useMemo(() => new Set(analytics.open), [analytics.open]);
  const selected = React.useMemo(() => new Set(analytics.selected), [analytics.selected]);
  const setOpen = React.useCallback(
    (next: Set<string>) => setAnalytics({ open: [...next] }),
    [setAnalytics],
  );
  const setSelected = React.useCallback(
    (next: Set<string>) => setAnalytics({ selected: [...next] }),
    [setAnalytics],
  );
  /* Сортировка внутри ветки живёт в persist-сторе, а не в компоненте: это
     настройка рабочего места, как и колонки, и набирать её заново каждый заход
     — та же потеря работы, от которой лечили выделение и развороты. */
  const branchKey = (analytics.branchKey ?? "spend") as ColKey;
  const branchDesc = analytics.branchDesc ?? true;

  // Настройка колонок читается только в браузере: на сервере localStorage нет.
  React.useEffect(() => setVisible(loadVisible()), []);

  /* Номер последнего отправленного запроса. Ответы, которые обогнал более
     свежий запрос, выбрасываем: иначе медленный ответ по старому диапазону
     приходит последним и перетирает цифры уже выбранного среза. */
  const seq = React.useRef(0);

  /* За какую просьбу уже ушёл запрос. РЕФ, а не состояние: он не должен
     вызывать перерисовку, он только отвечает эффекту «это ты уже спрашивал».
     Сравнивать надо именно с просьбой — почему, написано у `нуженЗапрос`. */
  const запрошено = React.useRef<Запрошено | null>(null);

  const load = React.useCallback(
    async (п: PeriodQuery, g?: string | null) => {
      const mine = ++seq.current;
      запрошено.current = { период: п, geo: g ?? null };
      setPending(true);
      setError(null);
      try {
        /* Лидерборд и лес — одним заходом. Ветки обязаны прийти ВМЕСТЕ с
           цифрами, а не позже: пока их нет, фильтры режут вслепую, а
           сохранённые развороты открываются пустыми. */
        const [got, forest] = await Promise.all([
          api.board(п, g ?? null),
          api.ads(п, g ?? null),
        ]);
        if (mine !== seq.current) return;
        setBoard(got);
        /* Расхождения приезжают вместе с лесом и могут не приехать вовсе:
           сторож — движковая половина #20, она доедет своим ходом. Пока её
           нет, `checks` просто отсутствует, и лист работает как работал. */
        setBranches(buildForest(forest.ads, forest.checks));
        /* Выбор человека обратно НЕ переписывается ответом. Раньше сюда
           заезжали `setSince`/`setUntil` с датами из ответа, и это была не
           забота, а порча: авто-перезагрузка раз в минуту меняла поля прямо
           под пальцами. Теперь просьба (`period`) и ответ (`board.period`) —
           два разных значения, и подпись на экране читает ВТОРОЕ: выбор это
           намерение, а посчитано то, что вернулось. */
        /* Здесь НЕТ сброса разворотов и отметок — и это главная правка листа.
           Раньше три строки обнуляли ветки/развороты/отметки на КАЖДОМ ответе,
           а этот же load зовётся по таймеру раз в минуту: выделение жило меньше
           минуты. Ветки теперь просто перезаписываются свежими — сбрасывать их
           отдельным эффектом больше не нужно и нельзя: пустой промежуток между
           «почистили» и «пришло» это ровно тот кадр, в котором раскрытая ветка
           выглядит пустой. */
      } catch (e) {
        if (mine !== seq.current) return;
        /* Инструкции разработчика здесь нет намеренно. Раньше стояло
           «Run: venv/bin/python scripts/analytics_daemon.py» — команда, которой
           у человека в облаке нет и быть не может, на продуктовом экране. После
           зачистки прода шанс её увидеть только выше. Что делать дальше,
           говорит само пустое состояние. */
        setError(
          e instanceof Error && e.message.includes("fetch")
            ? "No answer from the collector."
            : String(e instanceof Error ? e.message : e),
        );
      } finally {
        if (mine === seq.current) setPending(false);
      }
    },
    [],
  );

  /* Состав кабинетов читается ОТДЕЛЬНО от среза и НЕ вместе с ним.
   *
   *  Не вместе — потому что живут разное: срез перечитывается раз в минуту, пока
   *  он про сегодня, а имя и состояние кабинета так часто не меняются. Складывать
   *  их в один `Promise.all` значило бы ронять цифры из-за ручки, которой на
   *  старом демоне может не быть. Ошибку глотаем молча и оставляем `null`: это
   *  «не знаем», и разворот скажет об этом словом. */
  const pullAccounts = React.useCallback(async () => {
    try {
      const r = await api.accounts();
      setCloudAccounts(r.accounts ?? []);
    } catch {
      setCloudAccounts(null);
    }
  }, []);

  React.useEffect(() => {
    /* Адрес читается ОДИН раз, на первом заходе, и сразу же становится тем
       периодом, за который уходит запрос. Читать его на каждом рендере
       нельзя: мы же сами его и переписываем ниже, и вышел бы круг. */
    const изАдреса = typeof window === "undefined"
      ? НАЧАЛЬНЫЙ : изURL(window.location.search);
    setPeriod(изАдреса);
    void load(изАдреса);
    void pullAccounts();
  }, [load, pullAccounts]);

  /* Смена даты сама перезагружает срез. Раньше запрос уходил только по кнопке
     «обновить»: даты в полях менялись, цифры оставались от прошлого среза, и
     выбор диапазона выглядел сломанным.

     Пауза нужна и с виджетом: год в сегменте набирается по цифре, и по дороге
     к 2026-му значение успевает побыть 2-м, 20-м и 202-м годом. Каждое из них
     формально дата, и без паузы туда ушёл бы запрос. Перевёрнутый диапазон
     пропускаем молча — это промежуточное состояние правки, а не ошибка. */
  React.useEffect(() => {
    /* Уже спрашивали ровно это — второй раз не спрашиваем. Сравнение идёт с
       ПРОШЛОЙ ПРОСЬБОЙ, а не с ответом, и это не стилистика: сравнение с
       ответом не сходилось никогда (панель не называет пояс, движок его
       разрешает и называет), поэтому лист просил снова на каждый ответ — 99
       запросов в минуту с одной вкладки, #167. Заодно из зависимостей ушёл
       `board`: пока он там, любой ответ будит этот эффект, а эффект способен
       вызвать новый ответ — замкнуть такое кольцо может уже одна опечатка. */
    if (!нуженЗапрос(запрошено.current, period, geo)) return;
    /* Пауза нужна ручному вводу: год в сегменте набирается по цифре, и по
       дороге к 2026-му значение успевает побыть 2-м, 20-м и 202-м годом.
       Каждое формально дата, и без паузы туда ушёл бы запрос. Пресет ждать
       нечего — он приходит готовым одним нажатием. */
    if (period.preset) {
      void load(period, geo);
      return;
    }
    if (!period.since || !period.until || period.since > period.until) return;
    const t = setTimeout(() => void load(period, geo), 400);
    return () => clearTimeout(t);
  }, [period, geo, load]);

  /* Период уезжает В АДРЕС, а не только в состояние. Ссылка, скопированная из
     адресной строки, обязана открыть тот же экран, а не «похожий», и переход
     на другой раздел не должен начинать период заново. `replaceState`, а не
     `push`: выбор периода — не переход по истории, и кнопка «назад» после
     пяти нажатий пресетов не должна отматывать их по одному. */
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    for (const имя of ["period", "since", "until", "tz"]) p.delete(имя);
    for (const [k, v] of Object.entries(вURL(period))) p.set(k, v);
    const хвост = p.toString();
    window.history.replaceState(null, "",
      window.location.pathname + (хвост ? "?" + хвост : ""));
  }, [period]);

  /* Срез сам перечитывается, пока он про сегодня.
   *
   *  База живёт своим тактом — спенд из Меты раз в пять минут, воронка чаще, —
   *  а таблица грузилась только при открытии листа и смене дат. Выходило, что
   *  строка сверху пишет «спенд: 1 мин назад», а числа под ней с момента, когда
   *  вкладку открыли. Это ровно тот разрыв, из-за которого приходилось жать
   *  «обновить» и не верить экрану.
   *
   *  Только для диапазонов, включающих сегодня: прошлые дни не меняются, и
   *  дёргать по ним базу незачем. Запрос локальный, к Мете не ходит. Раскрытые
   *  ветки и отметки переживают перезагрузку — они держатся на id узлов. */
  React.useEffect(() => {
    /* «Про сегодня» решается по ОТВЕТУ движка: и конец окна, и сегодняшнее
       число приезжают оттуда, из одного пояса. Сравнивать конец окна с часами
       браузера значило бы вернуть сюда второе «сегодня» — то самое, из-за
       которого лист и переписан. Ответа ещё нет — сравнивать нечего. */
    const п = board?.period;
    if (!п?.today || п.until < п.today) return;
    const fresh = () => void load(period, geo);
    const id = setInterval(() => {
      // В скрытой вкладке не дёргаем: смотреть некому, а база не бесплатная.
      if (document.visibilityState === "visible") fresh();
    }, 60_000);
    // ...но вернувшись во вкладку, человек обязан увидеть свежее сразу, а не
    // досиживать минуту до следующего тика. Именно так «панель не обновляется»
    // и выглядит: переключился, посмотрел, цифры старые.
    const onShow = () => {
      if (document.visibilityState === "visible") fresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [board?.period, period, geo, load]);

  /** Раскрыть или свернуть крео.
   *
   *  Гармошки больше нет. Она закрывала соседнее крео молча, и это читалось не
   *  как правило, а как сбой: раскрыл второе — первое исчезло. Сравнивать два
   *  крео рядом — обычное дело, ради этого лист и открывают. Против каши
   *  работает не запрет, а «свернуть всё» одной кнопкой. */
  const toggle = React.useCallback(
    (n: Node) => {
      const c = new Set(open);
      if (c.has(n.id)) c.delete(n.id);
      else c.add(n.id);
      setOpen(c);
    },
    [open, setOpen],
  );

  /* Строки среза после фильтра «только с деньгами». Отдельной памяткой, потому
     что на них считаются и таблица, и итоги: иначе шапка показывала бы сумму по
     скрытому, и цифры на экране не сходились бы с цифрами в списке. */
  const shown = React.useMemo(
    () => (board ? board.rows.filter((r) => !hideNoSpend || r.spend != null) : []),
    [board, hideNoSpend],
  );
  /* Фильтры листа. `geo` уходит запросом на демон и режет весь срез; `q`, соц и
     статус режут уже полученное дерево на экране. Живут в persist-сторе: срез
     набирается десятки раз в день, и набирать его заново каждый заход — ровно
     та неприятность, ради которой лист и переделывался. */
  const filters = React.useMemo<Filters>(
    () => ({ q: analytics.q ?? "", socs: analytics.socs, statuses: analytics.statuses, geo }),
    [analytics.q, analytics.socs, analytics.statuses, geo],
  );

  const setFilters = React.useCallback(
    (next: Filters) => {
      setAnalytics({ q: next.q, socs: next.socs, statuses: next.statuses });
      if (next.geo !== geo) {
        setGeo(next.geo);
        void load(period, next.geo);
      }
    },
    [geo, period, load, setAnalytics],
  );

  /* Варианты фильтров собираются из ЛЕСА, а не из отдельной разбивки демона.
     Соцы раньше брались из `board.by_social` — десять пунктов, из которых
     совпасть могли три: разбивка перечисляет всех, кто вообще подключён, а в
     срезе кабы видны не со всех. Семь пунктов молча не находили ничего.
     Собранный из тех же кабов, что и дерево, список врать не умеет. */
  /* Соцы в фильтре — ТОЛЬКО живые, те же, что на листе «Соцы».
   *
   *  Раньше список собирался из поля `socials` кабинетов, а оно помнит всех,
   *  кто когда-либо каб видел: в выпадашке стояли k1epd0wv, k1f8exx4,
   *  k1fakkde — профили, которых нет в антике по полгода. Выбрать такой соц
   *  можно, толку ноль, и человек каждый раз заново вспоминает, кто из
   *  десятка ещё жив. Правда о том, кто жив, ровно одна — снапшот антика, он
   *  же кормит лист «Соцы».
   *
   *  Соц, который сейчас в антике, но кабинетов в срезе не дал, в списке
   *  остаётся: он живой, просто ничего не тратил, и его отсутствие читалось бы
   *  как «пропал». */
  /* Человеческие имена соцев — ТОЛЬКО ДЛЯ ПОКАЗА.
     Фильтр, выгрузка и `manage` продолжают ходить по id: имена не уникальны
     (два окна с подписью «17/7 spx» — обычное дело), а id уникален, и
     подменить им значение фильтра значит отобрать не тот срез. Поэтому карта
     уходит вниз ОТДЕЛЬНЫМ пропом, а не подмешивается в `socOptions`: так
     разделение видно в коде, а не держится на памяти читающего. */
  const profLabels = React.useMemo(
    () => profileLabels({ base: cloudAccounts, snapshot: snapshot ?? readCached() }),
    [cloudAccounts, snapshot],
  );
  const socOptions = React.useMemo(() => {
    const живые = new Set(Object.keys((snapshot ?? readCached())?.profiles || {}));
    const seen = new Set<string>();
    for (const tree of Object.values(branches))
      for (const acct of tree) for (const s of acct.socials ?? []) if (живые.has(s)) seen.add(s);
    for (const p of живые) seen.add(p);
    /* Значения остаются id, а ПОРЯДОК — по тому, что человек читает: список,
       отсортированный по id, при показе именами выглядит перемешанным. Id
       остаётся вторым ключом, чтобы тёзки стояли устойчиво, а не так, как их
       сложило множество. */
    return [...seen].sort(
      (a, b) =>
        profileDisplay(a, profLabels).localeCompare(profileDisplay(b, profLabels)) ||
        a.localeCompare(b),
    );
  }, [branches, snapshot, profLabels]);
  /* Что мы знаем о каждом кабинете: имя, агентство, состояние — и КТО это
     сказал. Сведение трёх источников живёт в `lib/analytics-accounts`, потому
     что его спрашивают трое: сортировка ветки по состоянию (ниже), разметка
     строки каба (`CreativeTable`) и выгрузка в CSV. Раньше каждый ходил в
     снапшот сам, а в облаке снапшота нет — отсюда и «шляпа» вместо кабинета
     (#132). */
  const accFacts = React.useMemo(
    () =>
      accountFacts({
        ads: Object.values(branches)
          .flat()
          .map((n) => ({ act_id: n.act_id ?? "", act_name: n.act_name, agency: n.agency })),
        base: cloudAccounts,
        snapshot: snapshot ?? readCached(),
      }),
    [branches, cloudAccounts, snapshot],
  );

  /* Гео копим, а не пересчитываем из текущего среза.
     Считать из board.rows нельзя: выбрал BD — в ответе остаются только строки
     BD, список схлопывается до одного значения, и переключиться на другое гео
     уже нечем, только сбросом. Один раз увиденное гео из списка не исчезает. */
  const geoSeen = React.useRef<Set<string>>(new Set());
  const geoOptions = React.useMemo(() => {
    for (const r of board?.rows ?? []) for (const g of r.geos ?? []) if (g) geoSeen.current.add(g);
    if (geo) geoSeen.current.add(geo);
    /* Порядок задаёт `geoTabs`: страны по алфавиту, корзина «данных о кампании
       нет» последней. Простая сортировка ставила бы её между `DZ` и `EG`, и
       читалась бы она как ещё одна страна (#150). */
    return geoTabs(geoSeen.current);
  }, [board, geo]);
  /* Статусы — из всего леса. Пока лес грузился по клику, этот список собирался
     из ещё не раскрытых веток, то есть из пустоты: в выпадашке стояло
     «нечего выбирать», и фильтр по статусу нельзя было включить в принципе. */
  const statusOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const walk = (ns: Node[]) => {
      for (const n of ns) {
        if (n.kind === "ad" && n.status) seen.add(n.status);
        if (n.children) walk(n.children);
      }
    };
    for (const t of Object.values(branches)) walk(t);
    return [...seen].sort();
  }, [branches]);

  const hiddenNoSpend = React.useMemo(
    () => (board ? board.rows.length - board.rows.filter((r) => r.spend != null).length : 0),
    [board],
  );

  /* Что показать вместо таблицы. Решение вынесено в чистую функцию, потому что
     проверить его иначе нечем: пустые состояния — это ровно то, что человек
     видит первым на чистой панели, и до 14.08 их не покрывал ни один тест. */
  const kind = emptyKind({
    board: Boolean(board),
    rows: board?.rows.length ?? 0,
    pending,
    error: Boolean(error),
    columns: visible.length,
  });

  /* Плоский список видимых строк. Считается здесь, а не в таблице: таблица
     должна рисовать, а не решать, что показано. */
  const { flat, roots } = React.useMemo<{ flat: Flat[]; roots: Node[] }>(() => {
    if (!board) return { flat: [], roots: [] };
    const special = new Set([board.unlinked_label, ...NOT_A_CREATIVE]);
    /* Потолок шкалы спарклайнов — один на весь срез и считается по ПОКАЗАННЫМ
       строкам. По показанным, а не по всем: скрытое фильтром крео не должно
       приплюснуть горки тех, что на экране, — иначе включение фильтра меняет
       картинку у строк, к которым фильтр не относился. */
    const ceiling = sparkCeiling(shown, board.until);
    const raw = shown.map((r) => creativeToNode(r, board.until, ceiling));
    /* Ветка вешается прямо на узел крео. Так дерево становится настоящим
       деревом — и каскад отметок, и фильтр, и экспорт ходят по нему сверху
       донизу одним способом, не зная, откуда взялся каждый уровень. */
    for (const t of raw) {
      t.children = branches[t.label];
      /* Возраст денег — единственное, что строке крео приходится досыпать из
         детей: сами цифры она получает готовыми из лидерборда и потому ничего
         не знает о том, когда их снимали. Свёрнутая строка обязана знать: с
         ней и разговаривают, пока не раскрыли (#20). Суммы при этом не
         трогаются — их считает движок, и пересчитывать их здесь значило бы
         завести второй источник правды. */
      rollStale(t);
    }

    /* Фильтр применяется к дереву ДО раскладки в плоский список — и то же
       отфильтрованное дерево уходит в отметки. Выделяешь ровно то, что видишь:
       иначе «отметить крео» под активным фильтром утащило бы в manage и то,
       что фильтр только что убрал с глаз. */
    const tops = filterTree(raw, {
      q: filters.q,
      socs: filters.socs,
      statuses: filters.statuses,
      methods: [],
      /* Тот же переключатель действует и ВНУТРИ ветки. Раньше здесь стояло
         жёсткое `false` с доводом «иначе спрячем строки, из которых сложены
         показанные суммы». Довод не работает: суммы на родителях фильтр не
         пересчитывает вовсе (`analytics-filter.ts:10-13`), а строка без
         расхода прибавляет к деньгам ноль — спрятав её, мы не теряем ни
         цента.

         Зато без этого разворот показывал ВСЮ историю крео: хватало одного
         контакта, долетевшего из CRM, чтобы под сегодняшним срезом всплыл
         кабинет мёртвого соца, который последний раз крутил месяцы назад.
         Байер раскрывает крео, чтобы увидеть, что работает сейчас, — и видел
         десяток строк с прочерками. Выключил «без спенда» — история вернулась
         целиком, как и была. */
      hideNoSpend,
    });

    const key = sortKey;
    const val = (n: Node) => derive(n, key);
    tops.sort((a, b) => {
      // «Связка не найдена» всегда последняя: это не крео, а недостача, и
      // первое место по цене депа у неё читалось бы как «лучший крео — тот,
      // который мы не опознали».
      if (special.has(a.label)) return 1;
      if (special.has(b.label)) return -1;
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return sortDesc ? y - x : x - y;
    });

    const out: Flat[] = [];

    /* Поиск сам раскрывает крео, внутри которых нашлось.
       Без этого он выглядел сломанным: набираешь имя объявления, дерево честно
       оставляет одну ветку — и на экране одна свёрнутая строка крео, под
       которой пусто. */
    const eff = filters.q.trim() ? new Set([...open, ...pathsToHits(tops)]) : open;

    /* Дерево на экране — ДВА уровня: крео и его кабинеты. Глубже не рисуем.
     *
     *  Кампании, адсеты и объявления в памяти остаются — по ним работают фильтр
     *  по статусу, поиск и экспорт в manage, тушить-то надо именно их. Но в
     *  таблице они оказались вредны: нейминг кампании это полсотни символов,
     *  из которых сорок повторяют имя каба, и под каждым кабом лежит одна
     *  кампания, под ней один адсет, под ним одно объявление — четыре строки
     *  об одном и том же. Разворот превращался в простыню, в которой нечего
     *  сравнивать.
     *
     *  Вопрос этого листа — «какое крео и на каких кабах». Ответ помещается в
     *  два уровня; всё, что ниже, отвечает на другой вопрос и живёт в manage.
     *
     *  Приглушения соседей тут тоже нет: раскрытую ветку видно по отступу и
     *  подложке, а гасить цифры, по которым сравнивают крео, — ровно наоборот
     *  тому, зачем на них смотрят. */
    /* Кабинеты внутри крео сортируются СВОЕЙ метрикой.
       Наверху вопрос «какой крео лучше» и отвечают на него депы; внутри
       вопрос «на каком кабе он идёт» и отвечает расход — ищут тот, который
       жрёт и не отдаёт. Одна общая сортировка заставляла выбирать между
       этими вопросами, и разворот приходилось читать глазами сверху вниз. */
    const bval = (n: Node) => derive(n, branchKey);
    /* Состояние кабинета — из сведённого индекса, того же, что рисует таблица.
       Двух ответов на «жив ли каб» на одном экране быть не может: до 15.08
       сортировка спрашивала снапшот, а в облаке его нет — и «по состоянию»
       раскладывала весь разворот в одну корзину «неизвестно». */
    const accStatus = (id?: string) => (id ? accFacts.get(id)?.status ?? undefined : undefined);

    /* Сортировка ветки по СОСТОЯНИЮ кабинета — отдельная ветка кода, потому
       что это не число и сравнивать его вычитанием нельзя.

       Порядок задан рангом: живой — 0, жёлтый (биллинг, ревью) — 1, бан — 2,
       неизвестный — 3. Направление переворачивает только КРАЯ: жёлтые остаются
       в середине при любом. Это не симметрия ради красоты — кабинет на
       биллинге не «средне хороший», он чинится, и в обоих порядках его место
       между тем, что работает, и тем, что уже не оживёт.

       Неизвестные всегда последними: про них мы не спрашивали, и ставить их
       рядом с живыми значит выдать незнание за факт. */
    const ранг = (n: Node): number => {
      if (n.kind !== "account") return 0;
      const st = accStatus(n.act_id);
      if (st === "ACTIVE") return 0;
      if (st === "DISABLED" || st === "PENDING_CLOSURE") return 2;
      if (!st) return 3;
      return 1;
    };
    const byBranch = (a: Node, b: Node) => {
      if (branchKey === STATUS_KEY) {
        const ra = ранг(a), rb = ранг(b);
        if (ra !== rb) {
          if (ra === 3 || rb === 3) return ra === 3 ? 1 : -1;   // неизвестные вниз всегда
          if (ra === 1 || rb === 1) return ra === 1 ? (rb === 3 ? -1 : 1) : (ra === 3 ? 1 : -1);
          return branchDesc ? ra - rb : rb - ra;                // живые ↔ баны местами
        }
        // Внутри одного состояния — по расходу: он и есть вопрос «что тушить».
        const x = derive(a, "spend"), y = derive(b, "spend");
        return (y ?? -1) - (x ?? -1);
      }
      const x = bval(a), y = bval(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return branchDesc ? y - x : x - y;
    };

    /* `root` — id крео, под которым лежит строка. Проставляется здесь, а не
       вычисляется в таблице по индексу: таблица получает строки готовым
       списком и о том, где кончилась одна ветка и началась другая, знать не
       может. */
    const walk = (nodes: Node[], depth: number, root: string) => {
      for (const n of nodes) {
        const kids = depth === 0 ? n.children : undefined;
        const hasKids = !!kids?.length;
        const isOpen = eff.has(n.id);
        const мой = depth === 0 ? n.id : root;
        out.push({ node: n, depth, hasKids, open: isOpen, root: мой });
        // Копия перед сортировкой: массив детей принадлежит дереву, и сортировка
        // на месте перетасовала бы его для всех, кто по нему ходит, — включая
        // экспорт и каскад отметок.
        if (isOpen && hasKids) walk([...kids!].sort(byBranch), depth + 1, мой);
      }
    };
    walk(tops, 0, "");
    return { flat: out, roots: tops };
    // `hideNoSpend` здесь обязателен: он теперь режет и внутри ветки, а без
    // него в списке зависимостей переключатель менял бы только верхний уровень
    // (тот считается в `shown`), а раскрытое крео осталось бы с прежними
    // строками до следующей перерисовки по другой причине.
  }, [board, shown, branches, open, sortKey, sortDesc, branchKey, branchDesc, filters,
      hideNoSpend, accFacts]);

  /* Якорь Shift-диапазона: последняя строка, которую отметили обычным кликом.
     Держим в ref, а не в сторе — это состояние жеста, а не настройка. */
  const anchor = React.useRef<string | null>(null);

  /* Escape снимает выделение — привычка из любого файлового менеджера.
   *
   *  Кнопка «снять выбор» есть, но она в панели внизу справа, и чтобы до неё
   *  дойти, надо сначала её там найти. Выделение при этом переживает
   *  перезагрузку страницы: набрал полсотни строк, отвлёкся, вернулся — и
   *  снимать их по одной. Escape закрывает это одним движением.
   *
   *  Не мешает полям: пока курсор в поиске, Escape чистит его (см. FilterBar),
   *  и до этого обработчика событие уже не доходит по проверке ниже. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!useStore.getState().analytics.selected.length) return;
      e.preventDefault();
      setSelected(new Set());
      anchor.current = null;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSelected]);

  /* Отметки и развороты переживают перезагрузку, а объекты — нет: за неделю
     объявление удаляют, каб банят, срез меняют. Чужие id надо выбрасывать, а
     не хранить вечно, и вот почему это было видно глазами: строка светилась
     лаймом, а панель внизу писала «0 объектов». Подсветка спрашивала «есть ли
     id в наборе» (есть), а счётчик — «есть ли такой узел в дереве» (нет), и
     они расходились. Чистим по приходу леса, одним проходом. */
  React.useEffect(() => {
    const live = new Set<string>();
    const walk = (ns: Node[]) => {
      for (const n of ns) {
        live.add(n.id);
        if (n.children) walk(n.children);
      }
    };
    for (const [label, tree] of Object.entries(branches)) {
      live.add("cr:" + label);
      walk(tree);
    }
    if (!live.size) return;
    const s = useStore.getState().analytics;
    const keepIds = (ids: string[]) => ids.filter((id) => live.has(id));
    const nextSel = keepIds(s.selected);
    const nextOpen = keepIds(s.open);
    if (nextSel.length !== s.selected.length || nextOpen.length !== s.open.length) {
      setAnalytics({ selected: nextSel, open: nextOpen });
    }
  }, [branches, setAnalytics]);

  /* Выделение — кликом по строке, как в файловом менеджере.
   *
   *  Галок в строках нет: квадратик на каждой из сотни строк оказался мусором.
   *  Правила привычные и потому не требуют объяснения на экране:
   *    клик            — выделить только эту ветку (прошлое снимается);
   *    Cmd/Ctrl+клик   — добавить или убрать, не трогая остальное;
   *    Shift+клик      — диапазон от предыдущей по видимому порядку.
   *  Разворот при этом отдельно, на шевроне: выделять и раскрывать одним
   *  жестом нельзя — по дереву ходят чаще, чем выбирают. */
  const onRowClick = React.useCallback(
    (id: string, mods: { shift: boolean; add: boolean }) => {
      /* Текущий набор берём из стора, а НЕ из замыкания рендера: два быстрых
         клика подряд иначе читают один снимок, и второй затирает первый —
         проверено на живой панели. */
      const cur = new Set(useStore.getState().analytics.selected);

      /* Диапазон по Shift СНЯТ 11.08 по просьбе владельца: на живой панели он
         прихватывал строки, которых не выбирали. Причина в том, что набор и
         подсветка считают отметку по-разному — узел кладётся в набор своим id,
         а «отмечен» решается по листьям, — и до тех пор, пока эти два взгляда
         не сведены в один, любой массовый жест будет давать лишнее.
         Сводить их надо отдельной работой, а не заплаткой под жест. */
      anchor.current = id;
      /* Обычный клик ПЕРЕКЛЮЧАЕТ строку, а не только включает.
         
         Раньше снять отметку можно было лишь через Cmd, и это ловушка: ткнул
         не туда — и обратно уже никак, кроме как найти модификатор. Теперь
         повторный клик по единственной отмеченной строке её снимает.
         
         Клик по ДРУГОЙ строке при этом по-прежнему заменяет выбор целиком:
         иначе выделение копится молча, и в manage уезжает то, что отмечали
         пять минут назад. Снимаем только когда строка уже одна и она же. */
      const отмечена = cur.has(id);
      /* Клик по НЕотмеченной строке заменяет выбор целиком — как было.
         Клик по уже отмеченной снимает её вместе с поддеревом, а остальное
         оставляет: убрать лишнюю строку из набора — обычное движение, и
         требовать ради него модификатор значит заставлять переотмечать
         полсотни строк заново. */
      const on = !отмечена;
      const base = mods.add || отмечена ? cur : new Set<string>();
      /* Ждать больше нечего: дерево целиком уже в памяти, каскад считается
         синхронно. Раньше здесь была догрузка ветки — без неё «отметить крео»
         означало отметить неизвестно что. */
      setSelected(cascadeSelect(roots, id, on, base));
    },
    [flat, roots, setSelected],
  );

  /* Отмеченное собирается обходом ДЕРЕВА, а не видимого плоского списка.
     Раньше здесь была карта по `flat`, и отметки на строках свёрнутых веток
     молча выпадали из панели действий, оставаясь в наборе: свернул ветку —
     счётчик уменьшился, а в manage уехало бы не то, что показано. */
  const chosen = React.useMemo(
    () => collectSelected(roots, selected),
    [roots, selected],
  );

  /* Подсветки пресета по совпадению дат здесь больше нет, и это не упрощение.
     Она сравнивала выбор человека с датами, посчитанными В БРАУЗЕРЕ, — то есть
     держала вторую копию смысла каждого пресета. Теперь нажатым считается тот,
     чьё ИМЯ лежит в `period.preset` (`PeriodPicker`): имя пришло от человека,
     а что оно значит — знает движок, и спорить им не о чем. Заодно исчезла
     болезнь «два зажатых сегмента разом», когда диапазоны случайно совпадали. */

  /* Итоги считаются по ТОМУ, ЧТО НА ЭКРАНЕ, включая фильтры соца и статуса.
   *
   *  Без фильтров сумма берётся из строк лидерборда — это точная цифра среза,
   *  включая расход, у которого нет разбивки по объявлениям.
   *
   *  Под фильтром так нельзя: строка крео несёт ПОЛНЫЙ спенд, фильтр сумм на
   *  узлах не пересчитывает (и правильно делает — иначе он умел бы стирать
   *  деньги в самой таблице). Поэтому под фильтром итог складывается по
   *  выжившим объявлениям — по тем, что фильтр оставил. Цифра станет меньше
   *  точной ровно на неразложенный по объявлениям расход, и об этом честно
   *  говорит пометка «по фильтру» в самой строке. */
  const filtered = filters.socs.length > 0 || filters.statuses.length > 0 || !!filters.q.trim();

  /* Окончательно ли крупное число (#149). Считается по КОНЦУ ОКНА, который
     вернул демон, а не по тому, что стоит в поле ввода: показываем мы ответ, а
     не намерение — пока новый срез едет, на экране лежит прежний.
     Порогов здесь нет: сравниваются две даты. */
  /* Есть ли в срезе НЕЗАКРЫТЫЙ прошлый день. Считается по `stale_gap_s`, и это
     не приближение: демон вычисляет недобор ТОЛЬКО по дням с `closed_at IS
     NULL` (`_SP_OPEN` в `scripts/analytics_daemon.py`), значит непустой недобор
     сам по себе доказывает, что день не закрыт. Закрытый день пометить этим
     нельзя в принципе — ошибка возможна только в сторону молчания, а она здесь
     и есть безопасная.

     Порог «какой недобор считать недобором» не заводится: он один на продукт и
     живёт в `staleLevel`. */
  const открытыеДни = React.useMemo(
    () =>
      Object.values(branches).some((tree) =>
        tree.some((n) => staleLevel(n.stale_gap_s ?? null) !== "ok"),
      ),
    [branches],
  );

  /* СОСТАВ ОКНА — ОТ СБОРЩИКА, КОГДА ОН ЕГО ПРИСЫЛАЕТ. Сколько дней окна не
     закрыто, сколько их всего и заметно ли незакрытое в сумме — считает он
     одним запросом по `account_day`, там же живёт и порог. Панель читает
     решение и не заводит своего: две константы в двух языках расходятся молча.

     Полей может не быть на этом деплое — тогда `readOpenDays` отдаёт пустое, и
     правило обходится без порога (см. `lib/analytics-final`). */
  const составОкна = React.useMemo(() => readOpenDays(board), [board]);

  const неитог = React.useMemo(
    () => неИтог({
      since: board?.since ?? null,
      until: board?.until ?? "",
      /* Сегодняшний день — ИЗ ОТВЕТА, в поясе продукта. Часы браузера здесь
         решали бы, считать ли последний день окна закрытым, и у байера за
         полночь по своим часам «незакрытый день» пропадал бы на сутки раньше
         срока. Ответа нет — пусто, и правило само разберётся. */
      today: board?.period?.today ?? "",
      openDays: открытыеДни,
      openDaysCount: составОкна.openDays,
      windowDaysFromEngine: составОкна.windowDays,
      materialFromEngine: составОкна.material,
    }),
    [board?.since, board?.until, board?.period?.today, открытыеДни, составОкна],
  );

  const totals = React.useMemo(() => {
    if (!board) return null;
    if (!filtered) {
      /* СУММА НАСЛЕДУЕТ НЕЗНАНИЕ СТРОК (#122). `?? 0` превращал «не собрано» в
         ноль ещё до сложения, и плитка сверху говорила «0 подписок» там, где
         строки под ней честно писали «не собрано». Ноль тут — утверждение, а
         утверждать нечего: хоть одна строка дала число — считаем, ни одной —
         числа нет. */
      const s = (k: keyof CreativeRow): number | null => {
        let было = false;
        let acc = 0;
        for (const r of shown) {
          const v = r[k] as number | null | undefined;
          if (v === null || v === undefined || !Number.isFinite(v)) continue;
          было = true;
          acc += v;
        }
        return было ? acc : null;
      };
      const spend = s("spend"), ftd = s("ftd");
      return {
        spend, ftd, sub: s("sub"),
        cpftd: spend !== null && ftd ? spend / ftd : null,
        крео: shown.length,
      };
    }
    /* Та же честность под фильтром: `null` доживает до экрана, а не гасится в
       ноль на входе в сложение (#122). */
    let spend: number | null = null, ftd: number | null = null, sub: number | null = null;
    const добавить = (было: number | null, v: number | null | undefined) =>
      (v === null || v === undefined || !Number.isFinite(v) ? было : (было ?? 0) + v);
    const leaves = (ns: Node[]) => {
      for (const n of ns) {
        if (n.children?.length) leaves(n.children);
        else if (n.kind === "ad") {
          spend = добавить(spend, n.spend);
          ftd = добавить(ftd, n.ftd);
          sub = добавить(sub, n.sub);
        }
      }
    };
    leaves(roots);
    return {
      spend, ftd, sub,
      cpftd: spend !== null && ftd ? spend / ftd : null,
      крео: roots.length,
    };
  }, [board, shown, roots, filtered]);

  /* Скролл-прогресс по `main`. Сам `main` не скроллится — его оборачивает
     `#canvas` в AppShell с `overflow-y-auto`. useScroll с `target` ловит
     движение `main` через scroll-события viewport'а и не зависит от того, на
     каком контейнере висит overflow. На 0 — вершина main у верха viewport'а,
     на 1 — низ main у низа. */
  const mainRef = React.useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: mainRef });
  /* Тонкая полоска 1.5px у верха канвы: растёт слева направо по мере
     прокрутки, источник прогресса — `scaleX` от 0 до 1. Никаких чисел и
     подписей: это инструмент, не индикатор загрузки. */
  const barScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <main ref={mainRef} className="flex h-full min-h-0 flex-col gap-2.5 p-4">
      {/* Полоса прогресса скролла: 1.5px у верха, sticky, чтобы прилипала к
          канве и не уезжала вместе с контентом. `transform-origin: left` —
          иначе `scaleX` растёт из центра, и рост читался бы как расходящаяся
          заливка, а не как заполнение слева. */}
      <motion.div
        aria-hidden
        style={{ scaleX: barScaleX, transformOrigin: "0% 50%" }}
        className="sticky top-0 z-20 -mx-4 h-[1.5px] origin-left bg-primary/80"
      />
      {/* ── A. Строка среза ────────────────────────────────────────────────
          Одна линия: где мы находимся и за какой период. Раньше здесь же жила
          диагностика сбора — одиннадцать пар «подпись — значение», которые
          читались первыми, хотя отвечают на вопрос «можно ли верить цифрам»,
          а не «сколько денег». Теперь диагностика стоит рядом с деньгами
          одним знаком (см. ряд B), а этот ряд занят только срезом. */}
      <header className="flex flex-none flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
          Creative analytics
        </h1>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {/* ОДИН ОБЩИЙ ВЫБОР ПЕРИОДА, тот же самый, что у листа кампаний.
              Здесь стоял свой: поле дат, четыре кнопки со своей арифметикой и
              «All». Второй такой же контур и есть та болезнь, о которой этот
              иссус, — он разошёлся бы с первым в первый же день. Кнопки, даты,
              пояс и оговорки живут в `PeriodPicker`; лист только говорит, ЧТО
              сказать про сутки, потому что кабинетов у него много. */}
          <PeriodPicker
            value={period}
            resolved={board?.period ?? null}
            onChange={setPeriod}
            busy={pending}
            суткиТекст={оСуткахПарка(board?.period ?? null)}
          />

          {/* «За всё» остаётся, но становится ЯВНЫМ выбором с двумя настоящими
              датами, а не тем, что случалось само. Раньше запрос без дат молча
              отдавал весь диапазон базы — lifetime под видом среза, ровно то,
              что владелец запретил. Границы берём из ответа движка
              (`stored_from` — самый ранний хранимый день, `today` — его
              сегодня), а не из своих часов; не знаем их — кнопка выключена. */}
          <Button
            onClick={() => {
              const п = board?.period;
              if (!п?.stored_from || !п.today) return;
              setPeriod({ since: п.stored_from, until: п.today });
            }}
            disabled={!board?.period?.stored_from || !board?.period?.today}
            className={cn(CTRL, CTRL_IDLE, "disabled:opacity-40")}
          >
            All time
          </Button>

          <Button
            onClick={() => {
              void load(period, geo);
              // Кнопка обязана не только перечитать базу, но и пнуть сбор:
              // иначе она молчит о том, что в базу давно не пишут, а починку
              // доступа замечает через полчаса.
              void pullCollector(true);
              // И перечитать состав кабинетов: бан каба — ровно та новость,
              // ради которой жмут «обновить», а сам по себе он не приезжает.
              void pullAccounts();
            }}
            disabled={pending}
            /* Надпись НЕ меняется на «гружу…». Смена текста меняла ширину
               кнопки, ряд перекладывался, и нажатие «обновить» выглядело как
               мигание всей шапки. Загрузка показывается вращением иконки. */
            className={cn(CTRL, CTRL_IDLE, "disabled:opacity-60")}
          >
            <RefreshCw className={cn("size-3.5 flex-none", pending && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      {collector?.blocked ? <BlockedBanner st={collector} /> : null}
      {/* Состояние передаём своё: лист уже опрашивает `/collector` сам и умеет
          пнуть его кнопкой «Refresh». Спокойный тон гасим — про блокировку
          строкой выше стоит своя, более подробная плашка, а два сообщения об
          одном и том же учат не читать оба. */}
      <CollectorVerdict st={collector} showNotice={false} />

      {/* ── B. Деньги и доверие к ним ──────────────────────────────────────
          Единственное крупное на экране. Служебные счётчики отсюда ушли к
          фильтрам, которыми они и порождены: «крео на экране» — это результат
          фильтрации, а не выручка, и стоять между депозитами и подписками ему
          было незачем.

          Индикатор состояния стоит ЗДЕСЬ, а не строкой выше, ровно потому, что
          отвечает на вопрос об этих числах: можно ли им верить. */}
      {totals ? (
        <div
          className={cn(
            "flex flex-none flex-wrap items-center gap-x-7 gap-y-3 rounded-xl border border-border",
            "surface-blur bg-card px-4 py-2.5",
            // Липкая: длинный срез прокручивается на сотню строк, и «сколько
            // всего» уезжает первым же движением колеса — ровно тогда, когда
            // с ним и сравнивают строку под курсором.
            "sticky top-0 z-30",
          )}
        >
          {[
            /* СПЕНД ЗА НЕЗАКРЫТЫЙ ДЕНЬ — НЕ ИТОГ, И ЧИСЛО ГОВОРИТ ЭТО САМО
               (#149). Лист и раньше честно писал в поповере «часть спенда
               протухла, настоящая цифра выше» — и крупно показывал неверное
               число. Признались и всё равно соврали: человек читает крупное.
               Теперь у числа знак нижней границы и своя подпись, и оба видны
               без единого нажатия. Правило — в `lib/analytics-final`, здесь
               только показ. */
            [
              неитог?.label ?? "spend",
              неитог?.граница ? нижняяГраница(money(totals.spend)) : money(totals.spend),
              неитог?.hint ?? "total spend across the creatives shown",
            ],
            ["deposits", num(totals.ftd), "first deposits (FTD) for the period"],
            [
              /* Цена депа считается из спенда, значит и она нижняя граница:
                 настоящая цена ВЫШЕ показанной. Промолчать здесь значит дать
                 закрыть связку по цифре, которая выглядит лучше правды. */
              неитог?.граница ? "cost per FTD so far" : "cost per FTD",
              totals.cpftd == null
                ? DASH
                : неитог?.граница
                  ? нижняяГраница(money(totals.cpftd))
                  : money(totals.cpftd),
              неитог?.граница
                ? "Spend is not final yet, so the real cost per deposit is higher than this."
                : "spend divided by the number of deposits",
            ],
            ["subs", num(totals.sub), "bot subscriptions for the period"],
          ].map(([k, v, hint]) => (
            <span key={k} className="flex flex-col leading-none" title={hint}>
              <span className="tnum text-[19px] font-semibold tracking-tight text-foreground">
                {v}
              </span>
              <span className={cn("microlabel mt-1.5", неитог?.граница && k !== "deposits"
                                                        && k !== "subs" && "text-warning")}>
                {k}
              </span>
            </span>
          ))}

          {/* Отдельной плашкой — почему число не окончательное. Знак «≥» у
              цифры замечают, а объяснить его должен текст рядом, а не поповер:
              поповер открывают ради подробностей, а не ради диагноза. */}
          {неитог ? (
            /* СОСТАВ ОКНА СЛОВАМИ И ЧИСЛОМ. «Не закрыт 1 день из 30» и «не
               закрыты все 30» — разные новости, и решения по ним разные;
               прежняя плашка говорила одно и то же в обоих случаях, стояла на
               каждом окне и потому не значила ничего.
               Цвет достаётся только тому случаю, где стоит и знак ≥: янтарная
               плашка на верной сумме отменяет доверие ко всем остальным. */
            <span
              className={cn(
                "self-center rounded-md border px-2 py-0.5 text-[11.5px]",
                неитог.граница
                  ? "border-warning/30 bg-warning-soft text-warning"
                  : "border-border bg-elevated text-muted-foreground",
              )}
              title={неитог.hint}
            >
              {неитог.дни
                ? `${неитог.дни} not closed`
                : неитог.почему === "today" ? "today is still running" : "day not closed"}
            </span>
          ) : null}

          {/* Под фильтром цифры другие, и молчать об этом нельзя: иначе они
              читаются как итог всего среза, а это разные вещи. */}
          {filtered ? (
            <span
              className="self-center rounded-md border border-primary-line bg-primary-soft px-2 py-0.5 text-[11.5px] text-foreground"
              title="totals summed over the ads the filter kept — excluding spend not broken down by ad"
            >
              filtered
            </span>
          ) : null}

          <div className="ml-auto">
            <DataState
              st={collector}
              byMoney={board?.coverage ?? null}
              ads={board?.coverage_ads ?? null}
              branches={branches}
              /* Чего в ЭТОМ окне не спрашивали (#122). Приезжает вместе со
                 срезом, а не с `/collector`: вопрос не «жив ли сбор сейчас», а
                 «полон ли период, на который человек сейчас смотрит». */
              тишина={board?.тишина}
            />
          </div>
        </div>
      ) : null}

      {/* ── C. Строка работы ───────────────────────────────────────────────
          Фильтры среза слева, настройки таблицы справа. Разделение не
          косметическое: слева то, что меняет НАБОР строк, справа то, что меняет
          их ВИД. Раньше «колонки» и «свернуть всё» стояли в одном ряду с
          датами, то есть выглядели как часть выбора среза, а счётчик «крео на
          экране» жил среди денег — хотя порождён он именно фильтром и меняется
          вместе с ним. */}
      <div className="flex flex-none flex-wrap items-start gap-x-3 gap-y-2">
        <FilterBar
          value={filters}
          onChange={setFilters}
          socs={socOptions}
          /* Только подписи. Значения фильтра — id из `socOptions`. */
          socLabels={profLabels}
          statuses={statusOptions}
          geos={geoOptions}
        />

        <div className="ml-auto flex flex-none items-center gap-1.5">
          {/* Сколько строк осталось после фильтров. Стоит рядом с самими
              фильтрами, потому что отвечает на вопрос «что я сейчас натворил
              переключателями», а не «сколько я заработал». */}
          {board ? (
            <span className="tnum whitespace-nowrap px-1 text-[12px] text-faint">
              {num(totals?.крео ?? 0)} creatives
            </span>
          ) : null}

          {/* Переключатель на месте ВСЕГДА, даже когда скрывать нечего. Раньше
              он появлялся и исчезал вместе с числом, и соседние кнопки на
              каждой смене диапазона переезжали на его ширину. */}
          <Button
            onClick={() => setHideNoSpend((v) => !v)}
            disabled={hiddenNoSpend === 0}
            className={cn(
              CTRL,
              hideNoSpend && hiddenNoSpend > 0 ? CTRL_ON : CTRL_MUTED,
              hiddenNoSpend === 0 && "opacity-40",
            )}
          >
            <EyeOff className="size-3.5 flex-none" />
            <span className="tnum">{hiddenNoSpend}</span>
            <span className="sr-only">
              {hideNoSpend ? "Show creatives without spend" : "Hide creatives without spend"}
            </span>
          </Button>

          {/* Сортировка внутри развёрнутого крео — своя, отдельно от верхней.
              Показана вместе с текущей метрикой: настройка переживает
              перезагрузку и меняет порядок сотни строк, поэтому «почему кабы
              стоят так» не должно быть загадкой. */}
          <BranchSort
            value={branchKey}
            desc={branchDesc}
            visible={visible}
            onChange={(k, d) => setAnalytics({ branchKey: k, branchDesc: d })}
          />

          {/* «Свернуть всё» вместо гармошки. Раньше раскрытие крео молча
              закрывало соседнее, и сравнить два крео рядом было нельзя. */}
          <Button
            onClick={() => setOpen(new Set())}
            disabled={!open.size}
            className={cn(CTRL, CTRL_MUTED, !open.size && "opacity-40")}
          >
            <ChevronsDownUp className="size-3.5 flex-none" />
            Collapse all
          </Button>

          {/* Выгрузка ровно того, что на экране: те же строки, тот же порядок,
              те же колонки. Поэтому берём `flat`, а не корни дерева — иначе в
              файле оказался бы второй, свой порядок, и разошёлся бы с таблицей
              незаметно. Свёрнутая ветка в файл не попадает — чтобы выгрузить
              кабы, крео надо развернуть. */}
          <Button
            /* Даты берём из `board`, а НЕ из полей ввода `since`/`until`.
               Это разные вещи, и код это знает: строкой 278 стоит
               `if (since === board.since && …) return` — сторож ровно на их
               расхождение. Поля успевают уехать вперёд данных при выборе
               пресета (загрузка асинхронная), при ручном вводе (дебаунс 400мс)
               и навсегда, если запрос упал. Имя файла тогда обещает период,
               которого в файле нет, — а спорить с ним человеку нечем, он
               открывает файл через неделю. Рядом это уже сделано правильно:
               `SelectionBar` получает `board?.since` (:1073). */
            onClick={() =>
              saveText(
                BOM +
                  toCsv(flat, visible, {
                    // Те же факты о кабинетах, что рисует таблица: иначе файл
                    // знал бы про кабинет не то, что экран.
                    accounts: accFacts,
                    // И то же число скрытых крео, что стоит в строке ИТОГО под
                    // таблицей: итог по показанным, выданный за весь срез, —
                    // это неверная цифра с уверенным видом.
                    hidden: hideNoSpend ? hiddenNoSpend : 0,
                  }),
                csvFilename(board?.since ?? "", board?.until ?? ""),
              )
            }
            disabled={!flat.length}
            className={cn(CTRL, CTRL_MUTED, !flat.length && "opacity-40")}
          >
            <Download className="size-3.5 flex-none" />
            CSV
          </Button>

          <ColumnPicker
            visible={visible}
            onChange={(next) => {
              setVisible(next);
              saveVisible(next);
            }}
          />
        </div>
      </div>

      {/* Полоса наверху — только когда цифры НА ЭКРАНЕ есть. Тогда она честно
          говорит «показанное могло устареть», не отнимая показанного. Когда
          цифр нет, про ошибку рассказывает пустое состояние на месте таблицы:
          полоса плюс пустота под ней читаются как «сломалось дважды». */}
      {error && board ? (
        <div className="flex-none rounded-xl border border-destructive/40 bg-destructive-soft px-3 py-2 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      {/* Фильтр может съесть срез целиком — так бывает на днях, за которые
          спенд ещё не собран. Пустая таблица без объяснения читается как
          поломка, поэтому говорим причину и даём выход одной кнопкой. */}
      {board && !pending && shown.length === 0 && hiddenNoSpend > 0 ? (
        <div className="flex-none rounded-xl border border-border bg-card px-4 py-6 text-center text-[13px] text-muted-foreground">
          None of the {hiddenNoSpend} creatives in this range have spend connected.{" "}
          <button
            onClick={() => setHideNoSpend(false)}
            className="text-foreground underline underline-offset-2 hover:text-primary-ink"
          >
            Show them
          </button>
        </div>
      ) : null}

      {/* Отдельно про пустой ПОИСК. Раньше запрос, который ничего не нашёл,
          давал просто пустую таблицу — и было не понять, то ли такого нет, то
          ли лист сломался. Чаще всего оно есть, но лежит под выключенным
          переключателем «без спенда»: у 32 крео из 51 нет строки расхода, и
          искомое объявление живёт ровно там. Поэтому и причина, и выход. */}
      {board && !pending && shown.length > 0 && flat.length === 0 ? (
        <div className="flex-none rounded-xl border border-border bg-card px-4 py-6 text-center text-[13px] text-muted-foreground">
          {filters.q ? (
            <>
              No matches for “<span className="naming text-foreground">{filters.q}</span>”
              {hiddenNoSpend > 0 && hideNoSpend ? (
                <>
                  {" "}— but {hiddenNoSpend} creatives are hidden by the no-spend filter.{" "}
                  <button
                    onClick={() => setHideNoSpend(false)}
                    className="text-foreground underline underline-offset-2 hover:text-primary-ink"
                  >
                    Search those too
                  </button>
                </>
              ) : (
                "."
              )}
            </>
          ) : (
            <>
              No rows left after filtering.{" "}
              <button
                onClick={() => setFilters({ q: "", socs: [], statuses: [], geo })}
                className="text-foreground underline underline-offset-2 hover:text-primary-ink"
              >
                Reset filters
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* Что показать вместо таблицы — в своём компоненте, а не здесь.
          Причина техническая и дорогая: `vitest.config.ts` собирает только
          `lib/**`, тестов в `components/` нет, и лист целиком в тесте не
          отрисовать — данные приезжают эффектом, а `renderToStaticMarkup`
          эффектов не выполняет. Пока текст жил тут, приёмка вырезала пустое
          состояние целиком и подменила его заголовок признаком поломки — 502
          теста из 502 остались зелёными. */}
      {kind !== "table" ? (
        <AnalyticsEmpty kind={kind} detail={error} onRetry={() => void load(period, geo)} />
      ) : board ? (
        <CreativeTable
          rows={flat}
          /* Факты о кабинетах приходят СВЕРХУ, а не собираются в таблице.
             Раньше таблица строила свой индекс по снапшоту, а сортировка листа
             — свой; в облаке оба были пусты, и разворот показывал голые id. */
          accounts={accFacts}
          /* Имена соцев для строки кабинета. `n.socials` от этого не меняется:
             по нему фильтруют и выгружают, показывают — по этой карте. */
          profileLabels={profLabels}
          visible={visible}
          sortKey={sortKey}
          sortDesc={sortDesc}
          onSort={(k, d) => {
            setSortKey(k);
            setSortDesc(d);
          }}
          selected={selected}
          onRowClick={onRowClick}
          onToggle={toggle}
          onReorder={(next) => {
            setVisible(next);
            saveVisible(next);
          }}
          widths={analytics.widths}
          onWidths={(w) => setAnalytics({ widths: { ...analytics.widths, ...w } })}
          specialLabels={new Set([board.unlinked_label, ...NOT_A_CREATIVE])}
          /* Сколько крео среза не попало в таблицу. Итог считается по
             показанным строкам, и без этого числа «TOTAL» читается как весь
             срез — а это ровно та цифра, по которой принимают решение. */
          hiddenCount={hideNoSpend ? hiddenNoSpend : 0}
        />
      ) : null}

      <SelectionBar
        nodes={chosen}
        since={board?.since ?? ""}
        until={board?.until ?? ""}
        onClear={() => setSelected(new Set())}
      />
    </main>
  );
}

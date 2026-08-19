"use client";

/* Лист «Кабинеты» — ОДИН на все источники и на всех арендаторов (иссус #121).
 *
 *  ЧТО БЫЛО. Листов было два: этот, собранный из снапшота мака (соцы, пиксели,
 *  выбор, группы), и `CloudAccountsView`, собранный из базы (сводка-плитка, разрез
 *  по Business Manager). Развилка стояла на странице: есть снапшот — первый, нет —
 *  второй. Из-за неё владелец на своей учётке видел один экран, а свежая учётка —
 *  совершенно другой, и владелец сказал про них «они между собой спорят». Спорили
 *  не дизайны, а две копии одного листа, которые разошлись за неделю: у одной был
 *  поиск и выбор, у другой — сводка и БМ.
 *
 *  ЧТО СТАЛО. Источники сводятся ДО разметки (`unifiedAccounts`), и лист один. Он
 *  не спрашивает, откуда приехала строка: у неё либо есть поле, либо честно нет.
 *  Пустая учётка видит ТОТ ЖЕ лист — с теми же плиткой, фильтрами и колонками, —
 *  просто без строк и с прямым «ещё не собрано». Другого экрана для неё нет
 *  намеренно: экран, который видит только новичок, некому чинить.
 *
 *  КАБИНЕТ — ПЕРВИЧНАЯ СУЩНОСТЬ. Одна строка на кабинет, сколько бы соцев его ни
 *  видели и в скольких источниках он ни лежал. Общий каб не дублируется, находится
 *  поиском по каждому своему соцу и, когда фильтр по соцу снят, подписан «shared».
 *  Плоское произведение соц×каб 13.08 давало 209 строк на 138 кабинетов и врало в
 *  счётчике «всего» ровно на эту разницу.
 *
 *  Виртуализации нет намеренно: в парке под три сотни кабов, а таблица с
 *  фиксированной высотой строки на таком объёме рисуется быстрее, чем стоит сама
 *  виртуализация. Появится тысяча — вернуться сюда.
 */

import * as React from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowUp, Copy, Layers, Link2, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { api } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/coss";
import { Tip } from "@/components/ui/tooltip";
import { ColResizer } from "@/components/sections/ColResizer";
import { parseAccQuery, unmatched } from "@/lib/acc-query";
import { personalAccounts } from "@/lib/lichka";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/studio/control";
import { AttentionChips, StatusDot, statusMeta } from "@/components/sections/health-bits";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import {
  groupReady, membersByStatus, missingOf, nCabs, nGroups, nObjects, nSocials, objectsOfGroup,
  snapshotMember,
} from "@/lib/groups";
import { accountRows } from "@/lib/account-rows";
import { useAntik } from "@/lib/use-antik";
import { PAGE_SIZES, pageWindow, paginate } from "@/lib/paging";
import { staleSocials } from "@/lib/staleness";
import {
  DASH, accKey, disableReasonText, dominantCurrency, fieldEvidence, fundingText, listNoUploadReason,
  money, noUploadReason, отмечаемые, snapshotProfileOptions, unifiedAccounts, сводкаЛиста,
  можноЛить,
  type CloudAccountRow, type NoUploadReason, type UnifiedAccount, type СводкаЛиста,
} from "@/lib/cloud-accounts";
import {
  СОСТОЯНИЯ_МЕНЮ, ПУСТОЙ_СРЕЗ, вОхвате, профилиСписок, срез, счётПоСостояниям,
  type Состояние, type Срез,
} from "@/lib/cloud-filter";
import { DataHealth, type Факт } from "@/components/sections/DataHealth";
import { РЯД, поРяду, сортируется, type Ряд } from "@/lib/accounts-sort";
import { RefreshButton } from "./RefreshButton";
import { NoAccounts } from "./NoAccounts";
import { cn } from "@/lib/utils";

/** Подписи состояний по-английски. Внутри кода состояния зовутся по-русски (там же,
 *  где живёт правило), наружу выходит английский — интерфейс едет чужим людям. */
const СОСТОЯНИЕ_ПОДПИСЬ: Record<Состояние, string> = {
  "все": "All statuses",
  "живые": "Active",
  /* Слово владельца — «забаненные». Не «disabled» и не «not active»: разбана у
     Меты не бывает, и на экране это обязано читаться как потеря, а не как
     состояние настройки. */
  "забаненные": "Banned",
  "биллинг": "Billing / unsettled",
  "на проверке": "Under review",
  "не собрано": "Not collected",
  "без карты": "No card",
};

/** Почему кабинет не отмечается — словами, под курсор на его строке.
 *
 *  Причины различает `lib/cloud-accounts.noUploadReason`, здесь только их
 *  английские подписи — ровно так же, как у состояний фильтра выше. Разными они
 *  обязаны быть и на экране: «мы ещё не знаем, с каких соцев виден этот кабинет»
 *  и «соцы известны, но ни один не подключён» чинятся разным, и первое вообще не
 *  чинится человеком. Слить их в одну фразу значит послать его не туда. */
export const НЕЛЬЗЯ_ПОДПИСЬ: Record<NoUploadReason, string> = {
  /* Про сам кабинет, а не про соца: сказать здесь «нет живого окна» значило бы
     послать человека заводить окно ради кабинета, который не оживёт никогда. */
  "account-dead": "Banned by Meta — an upload here would be refused",
  "owners-unknown": "We do not know yet which profile sees this account",
  "no-live-window": "Profile has a token but no window in the antidetect",
  "no-connected-profile": "No profile that sees this account is connected",
  /* НЕ ЗОВЁМ В АНТИДЕТЕКТ, в отличие от соседней фразы: заводить окно негде —
     вендора, который его держал, у Обелисты нет вовсе. */
  "vendor-gone": "Only visible from profiles of an antidetect we dropped",
};

/** То же самое, но про ВЕСЬ лист: когда не отмечается ни один кабинет.
 *
 *  Отдельные фразы, а не те же самые. Подпись строки говорит про строку, и
 *  набранная сто раз подряд она не сообщает главного: дело не в этом кабинете.
 *  А узнаёт человек об этом иначе — не наводя курсор на каждый погашенный
 *  чекбокс, а с одной строки над таблицей. */
const НИЧЕГО_НЕ_ОТМЕТИТЬ: Record<NoUploadReason, string> = {
  /* Весь срез — мёртвые кабинеты. Фраза про соцев здесь была бы неправдой:
     подключай что угодно, залить в них всё равно нельзя. */
  "account-dead": "Everything shown is banned by Meta — nothing can be uploaded here",
  "owners-unknown": "We do not know yet which profile sees these accounts",
  "no-live-window": "Tokens are here, but their profiles are gone from the antidetect",
  "no-connected-profile": "None of the profiles that see these accounts is connected",
  "vendor-gone": "These accounts only lived on an antidetect Obelista dropped",
};

/** Колонки листа. Порядок — как читают строку: кто это → чей соц → сколько
 *  денег → чем платит → каким пикселем.
 *
 *  ТРЁХ КОЛОНОК ЗДЕСЬ БОЛЬШЕ НЕТ, и это решение владельца 17.08, подтверждённое
 *  живым продом:
 *    • `business manager` — вместе со всем измерением БМ (группировка,
 *      выпадашка, переключатель вида). Имя БМ осталось находимым поиском и в
 *      подсказке строки, но своей колонки не имеет;
 *    • `daily cap` — на проде читался `not set` у КАЖДОЙ строки;
 *    • `checked` — читался `2 min ago` у каждой строки. Свежесть данных
 *      говорится один раз сверху, а не переписывается в сотне ячеек.
 *
 *  Освободившиеся ~380px уходят имени кабинета и пикселю: на них и смотрят,
 *  когда собирают связку. Ширины замерены на живых данных. */
interface Col { id: string; title: string; w: number; right?: boolean }

const ACC_COLS: Col[] = [
  { id: "cab", title: "ad account", w: 340 },
  { id: "soc", title: "profile", w: 210 },
  { id: "spend", title: "spend", w: 120, right: true },
  { id: "pay", title: "billing", w: 150 },
  { id: "pixel", title: "pixel", w: 220 },
];

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready" };

export function AccountsView() {
  const router = useRouter();
  const snapshot = useStore((s) => s.snapshot);
  const selection = useStore((s) => s.cabSelection);
  const groups = useStore((s) => s.cabGroups);
  const setSelection = useStore((s) => s.setCabSelection);
  const clearSelection = useStore((s) => s.clearCabSelection);
  const createGroup = useStore((s) => s.createGroupFromSelection);
  const addToGroup = useStore((s) => s.addSelectionToGroup);
  /* Удаления, переименования и дубля группы здесь БОЛЬШЕ НЕТ — они и не
     работали: три строки доставали действия из стора, и ни одна кнопка их не
     звала. Место работы с группой одно, лист «Аплоад» (`UploadView`,
     `GroupActions`); здесь остаётся чип-навигация в него. */
  const accountCols = useStore((s) => s.accountCols);
  const setCol = useStore((s) => s.setAccountCol);
  const colW = React.useCallback(
    (c: Col) => accountCols[c.id] ?? c.w,
    [accountCols],
  );
  const setActive = useStore((s) => s.setActiveGroup);
  /* Откуда лист берёт профили и кабинеты. Переключатель уехал в «Интеграции»
     (решение владельца 17.08) — лист только читает и называет режим меткой.
     `снапРежим` — короткое имя, потому что развилок по нему ниже несколько, и
     каждая объяснена на месте. */
  const dataSource = useStore((s) => s.dataSource);
  const снапРежим = dataSource === "snapshot";

  /* Строки базы. Ходим за ними ВСЕГДА, а не «когда снапшота нет»: развилка по
     источнику и была той самой парой источников правды, которую запрещает иссус.
     Мак от этого не страдает — ответ демона либо дополнит его строки состоянием,
     либо приедет пустым и ничего не изменит. */
  const [load, setLoad] = useState<Load>({ state: "loading" });
  /* Именно `CloudAccountRow`, а не `CloudAccount`: строка ответа несёт ещё и
     соцев кабинета. Типом пошире объекты доехали бы те же самые, но `owners` в
     сведении был бы не виден — то есть поле молча перестало бы существовать для
     всех, кто читает код, оставаясь в данных. */
  const [cloud, setCloud] = useState<CloudAccountRow[] | null>(null);

  const fetchCloud = React.useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const r = await api.accounts();
      setCloud(r.accounts || []);
      setLoad({ state: "ready" });
    } catch (e) {
      /* Строки, которые уже приехали, не выбрасываем: сбой перезагрузки не повод
         очистить экран. Показываем прошлый набор и говорим, что он прошлый. */
      setLoad({ state: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  /* OAuth загружается в обоих режимах, но в Snapshot mode он только обогащает
     уже существующие строки. Membership ниже остаётся snapshot-only. */
  React.useEffect(() => {
    void fetchCloud();
  }, [fetchCloud]);

  /* Снапшот знает про кабинеты, но не про соцев: ни кто из них ещё существует,
     ни у кого есть токен. И то и другое нужно прямо здесь — кабинет с
     неподключённого соца залить нечем (движок пойдёт в Graph от имени
     приложения и получит отказ), а с выбывшего нечем тем более.

     Оба множества — `null`, пока список ПУСТ, и это не перестраховка: пустой
     список означает «сравнивать не с чем», а не «все выбыли». Так бывает и на
     маке (антидетект закрыт), и на сервере, где локального антидетекта нет
     вовсе. Посчитать пустоту приговором значит пометить призраком каждую
     строку листа разом. */
  const antik = useAntik();
  const present = useMemo(
    () => (antik.profiles.length ? new Set(antik.profiles.map((p) => p.id)) : null),
    [antik.profiles],
  );
  const oauth = useMemo(
    () =>
      antik.profiles.length
        ? new Set(antik.profiles.filter((p) => p.connected).map((p) => p.id))
        : null,
    [antik.profiles],
  );

  /* Личные кабинеты. Они просачиваются в парк и внешне ничем не отличаются от
     агентских — а залив в них означает мгновенный бан и утянутый следом
     профиль. Признак выводится из данных (имя кабинета совпадает с именем
     аккаунта FB), а не из списка руками: список рос молча, и о новой личке
     узнавали по бану. */
  const личка = useMemo(() => personalAccounts(snapshot), [snapshot]);

  /* Одна строка на КАБИНЕТ. Снапшот даёт соцев и пиксели, база — состояние,
     биллинг и Business Manager; кто чей и что кого перекрывает, решено в
     `unifiedAccounts` и проверено тестами. */
  /* В Snapshot mode OAuth may update fields only on a provider/profile match;
     `membership: snapshot` prevents a cloud-only account from entering. */
  const rows = useMemo<UnifiedAccount[]>(
    () => unifiedAccounts(
      accountRows(snapshot, { present, oauth }),
      cloud,
      { personal: личка, membership: снапРежим ? "snapshot" : "all" },
    ),
    [snapshot, present, oauth, cloud, личка, снапРежим],
  );

  /* ЧТО ЛИСТ ПОКАЗЫВАЕТ — РЕШАЕТ РЕЖИМ, И ВЫБОРА У ЧЕЛОВЕКА НЕТ.
     Слова владельца 17.08: «мне пожалуйста либо то что с снапшота в режиме
     снапшота, либо с oAuth в режиме oAuth».

     ЧТО БЫЛО. Над таблицей стоял переключатель охвата «connected profiles · 109
     / whole park · 278» с абзацем на тридцать слов рядом. Он появился 15.08 по
     жалобе владельца («тянет всё непонятно откуда»), а через двое суток тот же
     владелец захотел не другой охват, а его отсутствие: «пускай становится
     недостижимым, похуй мне на эту старую стату».

     ЧТО СТАЛО. В серверном режиме — только то, до чего дотягивается OAuth:
     у соца есть и токен, и живое окно. В режиме снапшота — то, что лежит в
     снапшоте, и охват к нему не применяется вовсе (`вОхвате` требует
     `oauth === true`, которого в этом режиме не спрашивают, и вернул бы пустоту
     на непустом снапшоте — это закреплено отрицательным контролем в
     `__tests__/data-source-mode`).

     ЧЕГО ЭТО СТОИТ, ЧЕСТНО. 169 кабинетов, видимых только с отключённых
     профилей, перестают быть в этом списке — и вернуть их нечем. Их спенд при
     этом НЕ ПОТЕРЯН: `/ads` выбирает по окну дат и гео, без оглядки на
     подключённость профиля, поэтому в «Аналитике» они остаются. А лист
     «Кампании» их и так не показывал — там `вОхвате(парк, "подключённые")`
     зашит без переключателя с самого начала. То есть этот лист стал вести себя
     как соседний, а не завёл новое правило.

     `вОхвате` и `счётОхвата` при этом ОСТАЮТСЯ в библиотеке: их зовёт
     `CampaignsView`. Умирает выбор, а не механизм. */
  const парк = useMemo(
    () => (снапРежим ? rows : вОхвате(rows, "подключённые")),
    [rows, снапРежим],
  );

  const [фильтр, setФильтр] = useState<Срез>(ПУСТОЙ_СРЕЗ);
  /* Профиль принадлежит конкретному источнику. Если оставить его при
     переключении, валидный снапшот может выглядеть пустым из-за невидимого
     фильтра от серверного списка (и наоборот). Поиск и состояние сохраняем:
     они одинаково осмысленны в обоих режимах. */
  React.useEffect(() => {
    setФильтр((current) => (current.профиль ? { ...current, профиль: "" } : current));
  }, [dataSource]);
  const q = useDeferredValue(фильтр.запрос);
  const срезДляПоказа = useMemo<Срез>(() => ({ ...фильтр, запрос: q }), [фильтр, q]);
  const запрос = useMemo(() => parseAccQuery(q), [q]);

  const visible = useMemo(() => срез(парк, срезДляПоказа), [парк, срезДляПоказа]);
  /* СЧЁТЧИКИ ПУНКТОВ МЕНЮ — ПО СРЕЗУ БЕЗ САМОГО СТАТУСА, а не по всему парку и
     не по показанному.

     Это разбор столкновения двух прежних правил, каждое из которых было верно
     на своём объекте. Чипы считались по ВСЕМУ парку («иначе цена фильтра
     считалась бы после его же применения»), плитка — по ПОКАЗАННОМУ (прямые
     слова владельца: числа наверху обязаны считаться по тому же, что показано
     ниже). Слив их в один контрол, выбрать пришлось одно.

     Выбрано третье, и оно строже обоих: пункт меню обязан отвечать на «нажми
     меня — получишь N». Считай мы по показанному, после выбора «banned» у всех
     остальных пунктов встали бы нули, и меню перестало бы годиться для
     навигации. Считай по всему парку — оно врало бы при активном поиске.
     Поэтому режем всем, кроме статуса.

     Правило владельца «числа наверху = список внизу» при этом не потеряно: его
     держит сводная строка, которая считается ровно по `visible`. */
  const счёт = useMemo(
    () => счётПоСостояниям(срез(парк, { ...срезДляПоказа, состояние: "все" })),
    [парк, срезДляПоказа],
  );
  /* Выпадашка профилей считается ТЕМ ЖЕ правилом, что и показанный список:
     серверный режим — по подключённым соцам (`профилиСписок`), снапшотный — по
     всем владельцам строк снапшота (`snapshotProfileOptions`). Оставить здесь
     одно `профилиСписок` значило бы отдать в режиме снапшота пустой список
     фильтра над непустой таблицей.

     ПОКАЗЫВАЕМ ТОЛЬКО ИМЯ, БЕЗ ИДЕНТИФИКАТОРА (слова владельца: «показывать
     только имя профиля без айди»). Раньше строка была `${label} · ${id}`, и на
     живом проде это выглядело как «MeDuA6aeP - 15/8 SOC3 · 2fcc2d23-ecd8-4122
     -ac84-a72dfc77d002» — сорок символов мусора, из-за которых имя не
     помещалось в выпадашку шириной 200px. Идентификатор при этом никуда не
     делся: он остаётся ЗНАЧЕНИЕМ пункта, то есть тем, чем фильтр и работает.
     Имени у профиля может не быть — тогда честно показываем id, а не пустоту. */
  const profileOptions = useMemo(
    () => [
      { value: "", label: "All profiles" },
      ...(снапРежим ? snapshotProfileOptions(парк) : профилиСписок(парк))
        .map((p) => ({ value: p.id, label: p.label || p.id })),
    ],
    [парк, снапРежим],
  );

  /* Валюта листа считается ОДИН раз и передаётся вниз: пересчитывать её в каждой
     ячейке значило бы получить строки, посчитанные по разным основаниям. */
  const currency = useMemo(() => dominantCurrency(парк), [парк]);
  /* СВОДКА СЧИТАЕТСЯ ПО ТОМУ ЖЕ СРЕЗУ, ЧТО И ТАБЛИЦА ПОД НЕЙ — прямые слова
     владельца, и правило пережило снос плитки: два числа про одно и то же на
     одном экране человек читает как противоречие, и верит верхнему.

     Плитки из семи чисел больше нет. На проде она печатала ровно те же
     значения, что ряд чипов под ней («109 · 39 active · 70 banned» сверху,
     «all 109 · active 39 · banned 70» снизу), только сверху они не нажимались.
     Счётчики уехали в выпадающее меню статусов — туда, где по ним можно
     что-то сделать, — а здесь осталось то, чего в меню нет: деньги и карты. */
  const сводка = useMemo(() => сводкаЛиста(visible, currency), [visible, currency]);

  /* ПОРЯДОК СТРОК. По умолчанию — по спенду вниз, как было до появления
     сортировки: лист не имеет права переставиться сам у того, кто на заголовки
     не нажимал. Живёт состоянием одного захода, а не в сторе: «как я сейчас
     смотрю» — не настройка экрана. */
  const [ряд, setРяд] = useState<Ряд>(РЯД);
  const flat = useMemo(() => поРяду(visible, ряд, currency), [visible, ряд, currency]);
  const поКолонке = React.useCallback((id: string) => {
    setРяд((был) => (
      был.id === id
        /* Повторное нажатие переворачивает. Первое нажатие по НОВОЙ колонке
           даёт `desc` у денег и `asc` у всего остального: деньги смотрят
           «где больше», а имена и профили — по алфавиту сверху. */
        ? { id, desc: !был.desc }
        : { id, desc: id === "spend" }
    ));
  }, []);

  /* Страница листа. В сторе живёт только РАЗМЕР страницы (это настройка под
     свой экран), а номер — состояние одного захода: возвращаться на седьмую
     страницу после перезагрузки незачем. */
  const pageSize = useStore((s) => s.accountsPageSize);
  const setPageSize = useStore((s) => s.setAccountsPageSize);
  const [page, setPage] = useState(1);
  const paged = useMemo(() => paginate(flat, page, pageSize), [flat, page, pageSize]);
  /* Фильтр сузил список — возвращаемся в начало. Без этого поиск с седьмой
     страницы показывает пустоту, и это читается как «ничего не нашлось».
     Смена порядка — туда же: после сортировки человек смотрит НАЧАЛО списка
     («где больше всего потрачено»), а не седьмую страницу нового порядка. */
  React.useEffect(() => {
    setPage(1);
  }, [срезДляПоказа, pageSize, ряд]);

  /* Строки вставленного списка, которым в парке ничего не соответствует.
     Считаются по ВСЕМ кабинетам — и мимо охвата тоже, а не только мимо
     фильтров: иначе кабинет с отключённого соца объявлялся бы пропавшим, хотя
     он на месте и виден одним нажатием. «Не нашлось» обязано значить «такого у
     тебя нет», а не «сейчас не показан». */
  const промах = useMemo(
    () => unmatched(запрос, rows.map((r) => ({ id: r.act_id, name: r.name || undefined }))),
    [запрос, rows],
  );

  /* Отметки и связки считаются ПО КАБИНЕТУ, а не по паре «соц × каб»: кабинет —
     первичная сущность, и общий каб не может быть отмечен «наполовину». */
  const selectedKeys = useMemo(() => new Set(selection.map((m) => accKey(m.act))), [selection]);
  const inGroup = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const g of groups) {
      for (const mem of g.members) {
        const k = accKey(mem.act);
        m.set(k, [...(m.get(k) || []), g.name]);
      }
    }
    return m;
  }, [groups]);

  /* Кабинет, у которого не знают соца, отметить нельзя: движок резолвит кабы
     ВНУТРИ профиля (`core/uploader.py: resolve_profile`) и на чужом отвечает
     «Кабинеты не найдены». Строка при этом показывается наравне со всеми — она
     часть парка, и прятать её было бы враньём о его размере.

     ПРЕДИКАТ ОДИН НА ОБА РЕЖИМА, И ЭТО ИСПРАВЛЕНИЕ, А НЕ УБОРКА.

     Здесь стояла тернарная развилка по режиму: в снапшотном отбирал
     `можноЛить`, в серверном — «у строки есть профиль». То есть в серверном
     режиме действовало СВОЁ правило, отличное от того, которым отбирает
     `выбрать` ниже. (Дословно выражение здесь не приводится: сторож в
     `__tests__/data-source-mode` ищет его по тексту и справедливо ловит даже
     цитату в объяснении.) Комментарий на этом же месте
     утверждал, что второго правила заводить нельзя и что иначе «выбрать всё»
     никогда не сойдётся. Ровно это и происходило.

     Разбор. `noUploadReason` проверяет бан ПЕРВОЙ строкой, раньше профиля
     (`cloud-accounts.ts`). Значит забаненный кабинет, у которого профиль
     известен, проходил `Boolean(r.profile)` и попадал в `выбираемые`, но
     `выбрать` отсеивал его как `можноЛить === false`. В `selection` он не
     появлялся никогда, поэтому `allVisibleSelected` ниже был вечно `false` на
     любом парке, где есть хоть один забаненный каб с профилем. На проде
     владельца таких 70 из 109.

     Видимое следствие: галка в шапке не загоралась ПОСЛЕ нажатия, а так как
     `onSelectAll` передаёт `!allVisibleSelected`, она всегда передавала `true`
     — то есть «выбрать всё» работало в одну сторону, снять выделение ею было
     нельзя вообще.

     Лечение — то, что комментарий и требовал: одно правило, `можноЛить`, то же
     самое, которым отбирает `выбрать` и по которому гаснет чекбокс строки.
     Проверено тестом, который на прежнем коде КРАСНЫЙ
     (`__tests__/accounts-select-all`). */
  const выбираемые = useMemo(() => отмечаемые(visible), [visible]);

  /* Не отмечается НИ ОДИН кабинет парка — это про учётку, а не про строку, и
     сказать это надо один раз сверху. Считается по всем строкам, а не по срезу:
     иначе фильтр, оставивший на экране один неотмечаемый каб, объявлял бы
     проблемой всю учётку. Какая из трёх причин попадёт в текст, решает
     `listNoUploadReason` — правило одно и проверено тестом. Считается по
     ОХВАТУ: строка говорит про то, что человек сейчас видит, и звать его
     подключать соца из-за истории парка, которую он сам открыл, незачем. */
  const ничегоНеОтметить = useMemo(() => listNoUploadReason(парк), [парк]);

  const выбрать = React.useCallback(
    (accs: UnifiedAccount[], on: boolean) => {
      const ключи = new Set(accs.map((a) => accKey(a.act_id)));
      const без = selection.filter((m) => !ключи.has(accKey(m.act)));
      setSelection(
        on
          ? [
              ...без,
              ...accs.filter(можноЛить).map((a) => (
                снапРежим && snapshot
                  ? snapshotMember(a.profile!, a.act_id, snapshot)
                  : { profile: a.profile!, act: a.act_id, source: "server" as const }
              )),
            ]
          : без,
      );
    },
    [selection, setSelection, снапРежим, snapshot],
  );

  const переключить = React.useCallback(
    (a: UnifiedAccount) => {
      if (!можноЛить(a)) return;
      выбрать([a], !selectedKeys.has(accKey(a.act_id)));
    },
    [выбрать, selectedKeys],
  );

  const allVisibleSelected =
    выбираемые.length > 0 && выбираемые.every((r) => selectedKeys.has(accKey(r.act_id)));

  const readyCount = groups.filter((g) => groupReady(g, snapshot)).length;
  const totalObjects = groups.reduce((n, g) => n + objectsOfGroup(g), 0);
  const totalCabs = groups.reduce((n, g) => n + g.members.length, 0);

  const пусто = rows.length === 0;

  /* ФАКТЫ О ДАННЫХ — СПИСКОМ, А НЕ СТОПКОЙ ПЛАШЕК.
     Собираются здесь, а рисуются `DataHealth`: она обязана оставаться немой и
     отрисовываемой без запросов, иначе на неё нельзя посмотреть глазами до
     деплоя. Каждый факт — до десяти слов; подробность приложена только там, где
     она несёт действие или дословный ответ сервера. */
  const факты = useMemo<Факт[]>(() => {
    const out: Факт[] = [];

    /* Соцы, у которых сбор упал. ИМЯ ПЕРВЫМ, идентификатор — под курсор.
       На проде эта строка начиналась с `2fcc2d23-ecd8-4122-ac84-a72dfc77d002`,
       и первое, что сообщал экран, человеку не говорило ничего. */
    for (const s of staleSocials(snapshot)) {
      out.push({
        id: `stale:${s.profile}`,
        тон: "внимание",
        что: `${s.label || s.profile} — sync failed, showing older data`,
        детали: `${s.accounts} ad accounts from the last good sync. ${s.error}`,
      });
    }

    if (load.state === "error") {
      out.push({
        id: "collector",
        тон: снапРежим ? "внимание" : "тревога",
        что: снапРежим
          ? "OAuth enrichment is unavailable; snapshot membership is preserved"
          : "The collector did not return ad accounts",
        /* Дословный ответ демона, не «что-то пошло не так»: по нему отличают
           неверный адрес сборщика от отсутствующей ручки, и другого признака
           на экране нет. */
        детали: load.message,
      });
    }

    if (снапРежим && !snapshot) {
      out.push({
        id: "snapshot-missing",
        тон: "внимание",
        что: "Snapshot mode is on and no snapshot has loaded",
        детали: "Nothing is shown from the server instead.",
        куда: { href: "/integrations", текст: "Switch the source back" },
      });
    } else if (снапРежим && rows.length === 0) {
      out.push({
        id: "snapshot-empty",
        тон: "внимание",
        что: "The snapshot carries no ad accounts",
        детали: snapshot?.generated_at
          ? `Collected ${snapshot.generated_at}. This is its content, not a read failure.`
          : "This is its content, not a read failure.",
      });
    }

    if (ничегоНеОтметить) {
      out.push({
        id: "nothing-selectable",
        тон: "внимание",
        что: НИЧЕГО_НЕ_ОТМЕТИТЬ[ничегоНеОтметить],
        куда: ничегоНеОтметить === "no-connected-profile"
          ? { href: "/socials", текст: "Connect a profile" }
          : undefined,
      });
    }

    return out;
  }, [snapshot, снапРежим, load, rows, ничегоНеОтметить]);

  return (
    /* ЛИСТ — КОЛОНКА ВО ВСЮ ВЫСОТУ КАНВАСА, И ЭТО НЕ ВЁРСТКА РАДИ ВЁРСТКИ.
       От неё зависит липкая шапка таблицы: `position: sticky` считается
       относительно ближайшего ПРОКРУЧИВАЕМОГО предка, а обёртка таблицы
       объявлена `overflow-*` и потому этим предком и является. Пока у неё не
       было ограничения по высоте, прокручивать внутри было нечего — страница
       ехала целиком, шапка уезжала вместе с ней, и приёмка это измерила:
       `thead top=-143.36` при видимой таблице. Классы `sticky` стояли и не
       делали ничего.

       Поэтому высота задаётся здесь: `lg:h-full` опирается на канвас оболочки
       (`AppShell`: `lg:h-[calc(100dvh-3.5rem)]`), а таблица ниже забирает
       остаток и прокручивается сама. Приём не новый — так устроен лист
       «Аналитика» (`AnalyticsView`: `flex h-full min-h-0 flex-col`), и второй
       способ рядом разъехался бы с первым.

       На узком экране высоту канваса оболочка не задаёт (правила только с
       `lg`), поэтому там границу ставит сама обёртка таблицы — см. ниже. */
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-5", "lg:flex lg:h-full lg:min-h-0 lg:flex-col")}>
      <div className="mb-3 flex flex-none flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-heading text-base font-semibold tracking-tight">Ad accounts</h1>
        <div className="flex items-center gap-2">
          {/* Переключателя «by BM / flat list» здесь больше нет: измерение
              Business Manager ушло с листа целиком (решение владельца 17.08).
              Вместе с ним ушли группировка, шапки групп и колонка БМ. */}
          {/* «reload» перечитывает `/accounts`. В режиме снапшота этой ручки
              лист не касается вовсе, и кнопка обещала бы действие, которого
              не будет. Сбор с машины (`RefreshButton`) остаётся: он обновляет
              как раз снапшот. */}
          {!снапРежим && (
            <button
              type="button"
              onClick={() => void fetchCloud()}
              disabled={load.state === "loading"}
              className={cn(
                "focus-ring rounded-md border border-border px-2.5 py-1 text-2xs",
                "text-muted-foreground transition-colors duration-150",
                "hover:bg-hover hover:text-foreground disabled:opacity-50",
              )}
            >
              {load.state === "loading" ? "loading…" : "reload"}
            </button>
          )}
          {/* Сбор с машины оператора — только там, где он вообще что-то делает.
              В облаке антидетекта нет, и кнопка обещала бы несуществующее. */}
          {antik.profiles.length > 0 && <RefreshButton />}
        </div>
      </div>

      {/* ВСЁ О СОСТОЯНИИ ДАННЫХ — ОДНОЙ СТРОКОЙ. Здесь стояло до шести блоков
          во всю ширину подряд: устаревшие соцы, ошибка коллектора, две плашки
          режима снапшота, «нечего отметить» и вердикт сбора. Стопка
          предупреждений — это ноль информации: её перестают читать целиком.
          Разбор — в `sections/DataHealth`; вердикт сбора живёт ВНУТРИ неё, а не
          заменён. */}
      <DataHealth
        className="mb-3 flex-none"
        факты={факты}
        режим={снапРежим
          ? ["Snapshot", snapshot?.provider, snapshot?.snapshot_revision]
              .filter(Boolean)
              .join(" · ")
          : undefined}
      />

      {/* Управление листом: поиск, чей парк, какие статусы. Один ряд, три
          контрола, ни одного переключателя вида. */}
      <div className="mb-2 flex flex-none flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
          {/* Вставку списка ловим ОТДЕЛЬНО от ввода.
              `<input>` однострочный, и переводы строк он вырезает — вставленный
              список из двадцати кабинетов схлопывается в одну кашу, где имя
              склеивается со следующим id, и не находится ничего. Проверено на
              живой панели: «0 из 88».
              Поэтому текст берём из буфера сами, а в поле показываем сводку. */}
          <Input
            value={запрос.list ? `list · ${запрос.size} lines` : фильтр.запрос}
            onChange={(e) => setФильтр({ ...фильтр, запрос: e.target.value })}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (!/[\n;,]/.test(text)) return;   // обычная вставка — не мешаем
              e.preventDefault();
              setФильтр({ ...фильтр, запрос: text });
            }}
            /* Плейсхолдер называет, ЧТО можно ввести, и не пересказывает
               устройство: «or paste a list» жило здесь и съедало полстроки, а
               про вставку человек всё равно узнаёт вставкой. Само умение
               никуда не делось — оно ниже, чипом с числом строк. */
            placeholder="Search accounts, profiles, BM…"
            aria-label="Search ad accounts by name, id, profile or business manager; a pasted list is recognised"
            className="pl-8 pr-8"
          />
          {/* Крестик очистки. Поле, в котором лежит фильтр, обязано уметь
              опустеть одним нажатием: иначе человек выделяет текст мышью, и на
              вставленном списке из двадцати строк это неудобно вдвойне. */}
          {(фильтр.запрос || запрос.list) && (
            <button
              type="button"
              onClick={() => setФильтр({ ...фильтр, запрос: "" })}
              aria-label="Clear search"
              className="focus-ring absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2
                         place-items-center rounded text-muted-foreground
                         transition-colors duration-150 hover:bg-hover hover:text-foreground"
            >
              <X className="size-3.5" strokeWidth={1.6} aria-hidden />
            </button>
          )}
        </div>
        <div className="w-[190px]">
          {/* ИМЯ У ПОЛЯ СВОЁ, А НЕ РОДОВОЕ. Без него `SelectField` подставляет
              литерал «select», и рядом стоящие профиль со статусом становятся
              двумя одинаково названными контролами: с клавиатуры и с читалкой
              экрана их не различить, и браузерная приёмка тоже не различила. */}
          <SelectField
            label="Filter by profile"
            value={фильтр.профиль}
            onChange={(v) => setФильтр({ ...фильтр, профиль: v })}
            options={profileOptions}
          />
        </div>
        {/* На месте выпадашки Business Manager теперь стоит статус — прямая
            замена по словам владельца. Счётчик едет на самом пункте: цену
            фильтра видно ДО нажатия. Пункт с нулём не исчезает — исчезающий
            пункт читается как «такого не бывает». */}
        <div className="w-[190px]">
          <SelectField
            label="Filter by account status"
            value={фильтр.состояние}
            onChange={(v) => setФильтр({ ...фильтр, состояние: v as Состояние })}
            options={СОСТОЯНИЯ_МЕНЮ.map((с) => ({
              value: с,
              label: с === "все"
                ? `${СОСТОЯНИЕ_ПОДПИСЬ[с]} · ${счёт[с]}`
                : `${СОСТОЯНИЕ_ПОДПИСЬ[с]} · ${счёт[с]}`,
            }))}
          />
        </div>
        {/* Три числа, а не два: на странице — сколько под фильтром — сколько
            всего. Без первого «86 из 172» на экране с 50 строками читается
            как потеря кабинетов, а это ровно тот испуг, который здесь дороже
            всего. */}
        <span className="tnum ml-auto text-xs text-muted-foreground">
          {paged.total ? `${paged.from}–${paged.to} · ` : ""}
          {visible.length} of {парк.length}
        </span>
      </div>

      {/* СВОДНАЯ СТРОКА вместо плитки на семь чисел. Здесь только то, чего нет
          в меню статусов: сколько денег и сколько кабинетов без карты. Оба
          числа считаются по `visible` — по тому же, что показано ниже.
          «Без карты» НАЖИМАЕТСЯ: это не статус Меты (пересекается и с
          активными, и с баном), поэтому пунктом меню оно быть не может, но
          отобрать эти строки нужно постоянно. */}
      <SummaryLine
        сводка={сводка}
        currency={currency}
        выбрано={фильтр.состояние === "без карты"}
        onБезКарты={() => setФильтр({
          ...фильтр,
          состояние: фильтр.состояние === "без карты" ? "все" : "без карты",
        })}
      />

      {/* Вставили список — отмечаем одной кнопкой.
          Отметку НЕ делаем автоматически: вставка в поле поиска бывает и
          промахом, а молча изменившийся набор из двадцати кабинетов — это
          ровно тот случай, когда залив уходит не туда, а заметно это уже по
          спенду. Одно нажатие вместо двадцати щелчков — и так вся экономия. */}
      {запрос.list && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary-line
                        bg-primary-soft px-3 py-2">
          <span className="tnum text-xs text-foreground">
            {запрос.size} in the list, {visible.length} matched
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => выбрать(выбираемые, true)}
            disabled={!выбираемые.length}
          >
            <Copy className="size-3.5" /> Select matched
          </Button>
          {промах.length > 0 && (
            /* Что именно не нашлось — списком, а не числом. «Нашлось 18 из 20»
               без имён означает, что два потерянных кабинета обнаружатся
               после залива. */
            <span
              className="text-xs text-warning"
              title={"Not in accounts:\n" + промах.join("\n")}
            >
              not found: {промах.length} — hover to see
            </span>
          )}
        </div>
      )}

      {/* СВЯЗКИ — НАД ТАБЛИЦЕЙ, А НЕ ПОД НЕЙ.
          Здесь стояла сетка карточек в самом низу листа: чтобы увидеть свои
          связки, надо было пролистать пятьдесят строк таблицы. Слова владельца:
          «перенести туда где их лучше сразу будет видно».

          КАРТОЧКИ СТАЛИ ЧИПАМИ, И ЭТО НЕ ПОТЕРЯ. Полноразмерная карточка с
          именем, счётчиками, чипами внимания и кнопкой уже существует — на
          листе «Аплоад», который и есть место работы со связкой. Держать её
          вторую копию здесь значило иметь два места, где одно и то же
          редактируется по-разному, — а из-за размера копия и уехала вниз, где
          её не видно. Здесь остаётся то, ради чего на связку смотрят из
          таблицы: как называется, сколько в ней кабов, готова ли. */}
      {groups.length > 0 && (
        <div className="mb-2 flex flex-none items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {groups.map((g) => {
              const готова = groupReady(g, snapshot);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { setActive(g.id); router.push("/upload"); }}
                  title={
                    готова
                      ? `${g.name} — bundle ready`
                      : `${g.name} — missing: ${missingOf(g, snapshot).join(", ")}`
                  }
                  className={cn(
                    "focus-ring flex items-center gap-1.5 rounded-md border px-2 py-1 text-2xs",
                    "transition-colors duration-150 hover:border-border-strong hover:bg-hover",
                    готова ? "border-primary-line bg-primary-soft" : "border-border",
                  )}
                >
                  {/* Готовность — точкой, а не словом: чипов бывает десяток, и
                      «bundle ready» на каждом превращает ряд в стену текста. */}
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 flex-none rounded-full",
                      готова ? "bg-primary" : "bg-warning",
                    )}
                  />
                  <span className="max-w-[160px] truncate font-medium">{g.name}</span>
                  <span className="tnum text-faint">{g.members.length}</span>
                </button>
              );
            })}
          </div>
          <span className="tnum flex-none text-2xs text-muted-foreground">
            {readyCount} of {groups.length} ready · {nObjects(totalObjects)}
          </span>
          <Button size="xs" variant="outline" onClick={() => router.push("/upload")}>
            Open bundles
          </Button>
        </div>
      )}

      {/* «Ни один кабинет не отмечается» уехало в строку здоровья данных выше:
          это факт про данные, и стоять он обязан там же, где остальные, а не
          шестым блоком в стопке. */}

      {пусто ? (
        /* Пустая учётка остаётся НА ТОМ ЖЕ листе: выше уже нарисованы плитка с
           нулями и фильтры, и человек видит, что лист живой, а данных пока нет.
           Текст пустоты общий на всю панель — он не зовёт чинить фоновый сбор,
           которого у арендатора не существует.

           «Asking the collector…» в режиме снапшота НЕ показываем: за
           коллектором мы не ходили и не пойдём, а `load` так и остался в
           начальном «loading» — вечное многоточие было бы неправдой о том, что
           происходит. Почему пусто, сказано плашкой выше. */
        <div className="flex-none rounded-xl border border-dashed border-border">
          {!снапРежим && load.state === "loading" ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Asking the collector…
            </p>
          ) : (
            <NoAccounts />
          )}
        </div>
      ) : (
        <AccountsTable
          flat={paged.items}
          selected={selectedKeys}
          onSelect={переключить}
          inGroup={inGroup}
          allSelected={allVisibleSelected}
          onSelectAll={() => выбрать(выбираемые, !allVisibleSelected)}
          cols={ACC_COLS}
          colWidth={colW}
          onResize={setCol}
          ряд={ряд}
          onРяд={поКолонке}
          empty={
            /* Пусто по РАЗНЫМ причинам, и лечение у них разное. Режим, не
               дотянувшийся ни до одной строки, — это не «ничего не нашлось»:
               кабинеты в базе есть, просто ни один не виден с подключённого
               профиля. Предлагать здесь «сбросить фильтры» значит послать
               человека делать то, что не поможет.

               КНОПКИ «ПОКАЗАТЬ ВСЕ» ЗДЕСЬ БОЛЬШЕ НЕТ. Она переключала охват,
               а охвата не существует: лист показывает то, до чего дотягивается
               режим, и расширить его нечем (решение владельца 17.08). Значит и
               обещать расширение нельзя — остаётся назвать единственное
               действие, которое правда помогает. */
            !снапРежим && парк.length === 0 && rows.length > 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium">
                  No ad account is visible from a connected profile
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  {rows.length} accounts belong to profiles that are not connected right now.
                </p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/socials">Connect a profile</Link>
                </Button>
              </div>
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium">Nothing matches</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {парк.length} ad accounts in total.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setФильтр(ПУСТОЙ_СРЕЗ)}
                >
                  Reset filters
                </Button>
              </div>
            )
          }
          footer={<Pager paged={paged} onPage={setPage} size={pageSize} onSize={setPageSize} />}
        />
      )}

      {/* ПАНЕЛЬ ВЫБОРА — она же место, где собирается связка.
          Прибита к низу окна и появляется, как только отмечена первая строка:
          отмечают по всему списку и через страницы, и уводить человека вниз за
          кнопкой значило бы терять место, где он был. */}
      {!!selection.length && (
        <div className="sticky bottom-3 z-20 mt-3 flex flex-none flex-wrap items-center gap-x-3 gap-y-2
                        rounded-xl border border-primary-line bg-primary-soft px-3 py-2
                        shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)]">
          <span className="tnum text-sm font-medium">{nCabs(selection.length)} selected</span>
          <span className="text-xs text-muted-foreground">
            across {nSocials(new Set(selection.map((m) => m.profile)).size)}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {groups.length > 0 && (
              <div className="w-[170px]">
                <SelectField
                  value=""
                  placeholder="Add to group"
                  onChange={(id) => id && addToGroup(id)}
                  options={groups.map((g) => ({ value: g.id, label: g.name }))}
                />
              </div>
            )}
            <Button
              size="sm"
              onClick={() => {
                const id = createGroup();
                if (id) setActive(id);
              }}
            >
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              New group
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Сводная строка листа: деньги и карты. Всё, что можно было отфильтровать,
 *  живёт в меню статусов и здесь не повторяется.
 *
 *  ЧТО БЫЛО. Плитка на семь чисел в рамке, высотой в две строки: `109 · 39
 *  active · 70 banned · 0 billing · 0 not collected · 73 no card · $7,716.05`.
 *  Прямо под ней стоял ряд чипов с ТЕМИ ЖЕ ЧЕТЫРЬМЯ числами, только
 *  нажимаемыми. Владелец назвал это «дашбордом с подбивкой цифр» и был прав:
 *  верхняя половина не сообщала ничего, чего не сообщала нижняя, зато занимала
 *  место над таблицей — на листе, чья работа и есть таблица.
 *
 *  ЧТО СТАЛО. Одна строка без рамки. Статусы уехали в меню — туда, где по ним
 *  можно что-то сделать; здесь осталось то, чего в меню нет.
 *
 *  «БЕЗ КАРТЫ» НАЖИМАЕТСЯ, И ЭТО НЕ УКРАШЕНИЕ. Пунктом меню оно быть не может:
 *  меню — это корзины статуса Меты, а «нет карты» пересекается и с активными, и
 *  с забаненными (73 из 109 на живом парке). Но отбирать эти строки нужно
 *  постоянно — это список того, что не польётся, сколько в него ни целься.
 *
 *  Экспортируется ради смотрелки: лист целиком ходит за данными запросом, а эта
 *  строка рисуется от голых пропсов, и посмотреть на неё надо глазами. */
export function SummaryLine({ сводка, currency, выбрано, onБезКарты }: {
  сводка: СводкаЛиста;
  currency: string;
  выбрано: boolean;
  onБезКарты: () => void;
}) {
  return (
    <div className="mb-2 flex flex-none flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
      <span className="tnum font-medium text-foreground">
        {money(сводка.spent, currency)}
        <span className="ml-1.5 text-2xs font-normal text-muted-foreground">spent</span>
      </span>

      <button
        type="button"
        onClick={onБезКарты}
        aria-pressed={выбрано}
        title={
          "No payment method on file: these will not deliver, whatever the balance."
          + (сводка.cardUnknown
            ? ` ${сводка.cardUnknown} more have never been collected — we do not know.`
            : "")
        }
        className={cn(
          "focus-ring tnum rounded px-1.5 py-0.5 transition-colors duration-150",
          выбрано
            ? "bg-warning-soft text-warning"
            : "text-muted-foreground hover:bg-hover hover:text-foreground",
        )}
      >
        {сводка.noCard}
        <span className="ml-1.5 text-2xs">no card</span>
      </button>

      {/* Кабинет в другой валюте не влезает в общую сумму, и молчать об этом
          нельзя: иначе итог просто меньше правды, и объяснить это будет нечем. */}
      {сводка.otherCurrency > 0 && (
        <span className="text-2xs text-warning">
          {сводка.otherCurrency} in another currency, not in the total
        </span>
      )}
    </div>
  );
}

/* Полоса выбора охвата и плитка итогов удалены целиком.

   Полоса охвата — переключатель «connected profiles · 109 / whole park · 278»
   с абзацем объяснения рядом. Он появился 15.08 по жалобе владельца («тянет
   всё непонятно откуда») и был снят 17.08 его же решением: «пускай становится
   недостижимым, похуй мне на эту старую стату — мне пожалуйста либо то что с
   снапшота в режиме снапшота, либо с oAuth в режиме oAuth». Теперь охват
   решает режим, и выбора нет; правило применяется в самом листе одной
   строкой. `вОхвате`/`счётОхвата` из библиотеки НЕ удалены — их зовёт
   `CampaignsView`.

   Плитка итогов — семь чисел, дублировавших ряд чипов прямо под собой. Её
   заменила `SummaryLine` выше: статусы уехали в меню, деньги и карты остались
   строкой.

   (Имена снесённых компонентов здесь намеренно не написаны: сторож в
   `__tests__/accounts-scope` проверяет их отсутствие по тексту файла и ловит
   даже упоминание в некрологе.) */

export interface AccountsTableProps {
  flat: UnifiedAccount[];
  /** Ключи отмеченных кабинетов (`accKey`). */
  selected: Set<string>;
  onSelect: (a: UnifiedAccount) => void;
  /** Кабинет → в каких связках он уже состоит. */
  inGroup: Map<string, string[]>;
  allSelected: boolean;
  onSelectAll: () => void;
  cols: Col[];
  colWidth: (c: Col) => number;
  onResize?: (id: string, w: number) => void;
  /** Текущий порядок и нажатие по заголовку. */
  ряд: Ряд;
  onРяд: (id: string) => void;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
}

/** Сама таблица, отдельно от того, кто ходит за данными.
 *
 *  Разделение не ради красоты. Компонент с `useEffect` нельзя отрисовать иначе как в
 *  живом браузере: серверный рендер эффектов не выполняет и всегда даёт состояние
 *  «загружаю». А посмотреть на лист глазами надо ДО деплоя — 13.08 двенадцать листов
 *  уехали в PR, не показавшись никому, и это оказалось дороже любой правки. Таблица
 *  без загрузки рисуется из готовых строк чем угодно, включая `renderToStaticMarkup`
 *  и смотрелку в `lib/__tests__/preview-cloud-accounts.test.ts`.
 *
 *  ГРУППИРОВКИ ЗДЕСЬ БОЛЬШЕ НЕТ. Разрез по Business Manager ушёл с листа целиком
 *  (решение владельца 17.08), а вместе с ним — шапки групп, раскрытие, второй
 *  набор колонок и развилка `groups ? … : flat`. Таблица снова одна.
 *
 *  ЗАГОЛОВОК СОРТИРУЕТ. Affordance взят у листа «Аналитика» (`CreativeTable`):
 *  та же стрелка `ArrowUp`, тот же поворот на 180° для убывания, никакой стрелки
 *  когда сортировка не по этой колонке. Второй визуальный язык для одного и того
 *  же действия на соседних листах — это способ заставить человека учиться дважды.
 *  Сама сортировка живёт в `lib/accounts-sort`: в ней есть чему ломаться
 *  (смешанные валюты, «ноль» против «не знаем»), и место этому — в тестируемом
 *  модуле, а не в `onClick`. */
export function AccountsTable(p: AccountsTableProps) {
  const пусто = !p.flat.length;
  /* Набор колонок считается ИЗ ТОГО ЖЕ списка, который рисует шапку. Второй
     список рядом разъехался бы с первым на первой же правке, и таблица поехала
     бы столбцами: шапка про одно, ячейки про другое. Заметить это можно только
     глазами, а прочитать сдвинутую таблицу человек всё равно попробует — и
     поверит не тому числу. */
  const видимые = React.useMemo(() => new Set(p.cols.map((c) => c.id)), [p.cols]);
  return (
    /* ДВА ВЛОЖЕННЫХ ЭЛЕМЕНТА, А НЕ ОДИН, И РАЗНИЦА СУЩЕСТВЕННАЯ.

       Снаружи — рамка и подвал (страницы, «показывать по»). Внутри — то, что
       прокручивается. Раньше это был один `div`, и подвал уезжал вместе с
       содержимым: пролистав пятьдесят строк, человек терял переключатель
       страниц, то есть единственный способ увидеть следующие пятьдесят.

       ВНУТРЕННИЙ — ЕДИНСТВЕННЫЙ СКРОЛЛПОРТ ТАБЛИЦЫ, и именно к нему липнет
       шапка. Ограничение по высоте обязательно: без него прокручивать внутри
       нечего, и `sticky` на `<thead>` не делает ровно ничего (замерено
       приёмкой: `thead top=-143.36` при видимой таблице).

       Границы две, потому что высоту канваса оболочка задаёт только с `lg`:
         • десктоп — `lg:flex-1` забирает остаток колонки листа;
         • узкий экран — `max-h-[70dvh]`, чтобы шапка липла и там, а под
           таблицей оставалось место подвалу и панели выбора.

       `overflow-auto`, а не `overflow-hidden`: на телефоне таблица шире экрана,
       и `hidden` не прятал лишнее, а ОТРЕЗАЛ правые колонки — пиксель
       становился недостижим вообще ничем. */
    <div className={cn(
      "flex flex-col rounded-xl border border-border bg-card",
      "lg:min-h-0 lg:flex-1",
    )}>
      <div className="max-h-[70dvh] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1">
      {/* `table-fixed`: без него браузер сам раздаёт ширины по содержимому и
          перетаскивание не держится — колонка возвращается на место, как только в
          неё приедет строка подлиннее.
          `min-w` посчитан по сумме объявленных ширин колонок плюс чекбокс
          (40 + 340 + 210 + 120 + 150 + 220), а не оставлен от прежнего набора из
          восьми колонок: лишние 200px заставляли таблицу скроллиться вбок там,
          где она уже помещалась. */}
      <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-elevated/95 backdrop-blur">
          <tr className="border-b border-border text-left">
            <th className="w-10 px-3 py-2">
              <Checkbox
                checked={p.allSelected}
                onCheckedChange={p.onSelectAll}
                aria-label="Select all shown"
              />
            </th>
            {p.cols.map((c) => {
              const можно = сортируется(c.id);
              const этот = p.ряд.id === c.id;
              return (
                <th
                  key={c.id}
                  style={{ width: p.colWidth(c) }}
                  aria-sort={этот ? (p.ряд.desc ? "descending" : "ascending") : undefined}
                  className={cn(
                    "microlabel relative px-2 py-2 text-2xs text-muted-foreground",
                    c.right && "text-right",
                  )}
                >
                  {/* Заголовок — кнопка ТОЛЬКО там, где нажатие что-то меняет.
                      Кнопка, которая на два нажатия отвечает ничем, учит не
                      нажимать и остальные. */}
                  {можно ? (
                    <button
                      type="button"
                      onClick={() => p.onРяд(c.id)}
                      className={cn(
                        "focus-ring group/th -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1",
                        "rounded px-1 py-0.5 transition-colors duration-150 hover:text-foreground",
                        c.right && "justify-end",
                        этот && "text-foreground",
                      )}
                    >
                      <span className="truncate">{c.title}</span>
                      {/* Стрелка есть только у активной колонки. Бледные
                          стрелки на всех сразу превращают шапку в рябь, и
                          понять, по чему список отсортирован, становится
                          труднее, а не легче. */}
                      <ArrowUp
                        aria-hidden
                        className={cn(
                          "size-3 flex-none transition-[transform,opacity] duration-150 ease-out",
                          этот
                            ? cn("text-primary-ink opacity-100", p.ряд.desc && "rotate-180")
                            : "opacity-0 group-hover/th:opacity-40",
                        )}
                      />
                    </button>
                  ) : (
                    c.title
                  )}
                  {p.onResize && (
                    <ColResizer
                      id={c.id}
                      width={p.colWidth(c)}
                      onResize={p.onResize}
                      label={c.title}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {p.flat.map((a) => (
            <AccountRow
              key={a.act_id}
              account={a}
              видимые={видимые}
              selected={p.selected.has(accKey(a.act_id))}
              onSelect={p.onSelect}
              inGroup={p.inGroup.get(accKey(a.act_id))}
            />
          ))}
        </tbody>
      </table>
      </div>

      {пусто && p.empty}
      {p.footer}
    </div>
  );
}

/** Одна строка листа. Всё, что она показывает, приходит готовым: строка не знает,
 *  из какого источника приехало поле, и не имеет права додумывать пустое. */
function AccountRow({ account: a, видимые, selected, onSelect, inGroup }: {
  account: UnifiedAccount;
  /** Какие колонки рисует ЭТА таблица (id из `ACC_COLS`). Строка обязана знать
   *  набор, а не догадываться о нём: шапку рисует один список, ячейки — другой
   *  код, и разъехавшись, они дают сдвинутые столбцы. Такое видно только
   *  глазами на живом экране, а прочитать таблицу со сдвигом человек всё равно
   *  попробует — и поверит не тому числу. */
  видимые?: Set<string>;
  selected: boolean;
  onSelect: (a: UnifiedAccount) => void;
  inGroup?: string[];
}) {
  const есть = (id: string) => !видимые || видимые.has(id);
  const billing = fundingText(a);
  const reason = disableReasonText(a);
  const px = a.pixels;
  /* Почему кабинет не отмечается — и отмечается ли вообще. Правило живёт в
     `lib/cloud-accounts`, здесь только показ. */
  const нельзя = noUploadReason(a);
  /* Кого показать в колонке соца. Обычно это соц залива; когда лить нечем, но
     связи известны, — первого из них. Спрятать их значило бы сказать «не знаем»
     там, где мы знаем: кабинет виден с этих профилей, просто ни один не
     подключён, и это ровно тот факт, по которому человек идёт подключать. */
  const показан = a.profile || a.owners[0]?.profile || null;
  const ещё = a.owners.filter((o) => o.profile !== показан);
  const главный = a.owners.find((o) => o.profile === показан);
  /* ИМЯ ПРОФИЛЯ, А НЕ ЕГО ИДЕНТИФИКАТОР. На проде в этой клетке стояло
     `00076f0a-c36a-4209-a77…`, хотя рядом в тех же данных лежало
     `1/8 MediaBuyer3 hiu` — имя окна в антидетекте, то самое, которым профиль
     зовут вслух. Проверено на живой базе 17.08: имя есть у ВСЕХ профилей
     арендатора, то есть подстановка ничего не прячет.
     Идентификатор не выброшен: он под курсором и остаётся тем, чем работают
     фильтр и спека залива. Имени нет — честно показываем id, а не пустоту.

     ТРИ ИСТОЧНИКА ИМЕНИ, А НЕ ОДИН, и порядок не вкусовой. Сначала имя того
     владельца, которого мы и показываем; следом `profileLabel` самой строки —
     его кладёт `unifiedAccounts`, и у строк, приехавших только из снапшота,
     список `owners` бывает пуст, а имя при этом известно.

     Найдено глазами на смотрелке: одна строка снова печатала `2fcc2d23` при
     живом имени рядом. Тот же дефект, ради которого вся правка, только этажом
     ниже — и тестами он не ловился, потому что все фикстуры имели владельцев. */
  const имяСоца = главный?.label || a.profileLabel || показан;

  return (
    <tr
      onClick={() => onSelect(a)}
      /* Высота фиксирована под три имени пикселя: это форма большинства строк, и
         равнять по ней дешевле, чем позволять таблице гулять от двух до восьми. */
      style={{ height: 64 }}
      className={cn(
        "border-b border-border/60 transition-colors duration-150 last:border-0",
        нельзя ? "cursor-default" : "cursor-pointer",
        selected ? "bg-primary-soft" : "hover:bg-hover",
      )}
    >
      <td
        className="px-3 py-2"
        onClick={(e) => e.stopPropagation()}
        title={нельзя ? НЕЛЬЗЯ_ПОДПИСЬ[нельзя] : undefined}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onSelect(a)}
          disabled={!!нельзя}
          aria-label={`Select ${a.name || a.act_id}`}
        />
      </td>

      <td className="max-w-0 min-w-[180px] px-2 py-2">
        <div className="flex items-center gap-2">
          <StatusDot status={a.status || undefined} />
          {/* Имя занимает всю строку целиком. Чип группы ушёл на вторую строку:
              наверху он отъедал у имени треть, и кабинеты превращались в
              «Hiuhiu_Media…», то есть переставали различаться между собой.
              Business Manager — В ПОДСКАЗКЕ. Своей колонки у него больше нет
              (решение владельца 17.08), но данные никуда не делись, и «чей это
              БМ» иногда спрашивают. Поиск по нему тоже работает. */}
          <span
            className="truncate"
            title={
              (a.name || a.act_id)
              + (a.bm_name || a.bm_id ? `\nBusiness Manager: ${a.bm_name || a.bm_id}` : "")
            }
          >
            {a.name || <span className="italic text-muted-foreground">no name from Meta</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5 truncate font-mono text-2xs text-muted-foreground">
          <span className="truncate">{a.act_id}</span>
          {a.status && a.status !== "ACTIVE" && (
            <span className="flex-none font-sans text-destructive" title={reason || undefined}>
              {statusMeta(a.status).label}
              {reason ? ` · ${reason}` : ""}
            </span>
          )}
          {a.personal && (
            /* Не иконка, а слово: иконку на этой строке уже несут статус и OAuth,
               третий значок читался бы как украшение. «Личка» — то самое слово,
               которым это называют вслух. */
            <span
              title="Personal FB ad account — never upload here: it gets disabled instantly and takes the profile down with it"
              className="flex-none rounded border border-destructive/40 bg-destructive-soft
                         px-1 font-sans text-destructive"
            >
              personal
            </span>
          )}
          {inGroup && (
            <span
              title={`In groups: ${inGroup.join(", ")}`}
              className="flex-none rounded border border-primary-line bg-primary-soft px-1 font-sans text-primary-ink"
            >
              {inGroup.length === 1 ? inGroup[0] : `${inGroup.length} groups`}
            </span>
          )}
        </div>
      </td>

      <td className="px-2 py-2">
        {!показан ? (
          /* Пусто — это «не знаем», а не «соца нет». В облаке так выглядит весь
             парк до первого моста с машины, и написать здесь «none» значило бы
             утверждать про каждый каб то, чего никто не проверял. */
          <span className="text-2xs text-muted-foreground" title="we do not know yet which profiles this ad account is visible from">
            {DASH}
          </span>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              {/* Не `font-mono`: моноширинный шрифт был выбран под
                  идентификатор, а имя профиля — обычный текст, и в моно оно
                  занимает на четверть больше и читается хуже. */}
              <span className="truncate text-xs" title={показан}>{имяСоца}</span>
              {/* ДВА признака, а не один, и щит достаётся только тому, у кого
                  верны оба: токен соца И живое окно в антидетекте. Пока список
                  соцев не приехал — молчим: нарисовать «нет доступа» раньше
                  ответа значит соврать. */}
              {главный?.oauth === true && главный.present !== false && (
                <ShieldCheck
                  className="size-3.5 flex-none text-primary-ink"
                  strokeWidth={1.75}
                  aria-label="Profile connected via OAuth"
                />
              )}
              {главный?.oauth === false && (
                <span
                  title="Profile is not connected to the app — nothing to upload with"
                  className="flex-none rounded border border-warning/30 bg-warning-soft px-1 text-2xs text-warning"
                >
                  no OAuth
                </span>
              )}
              {главный?.oauth === true && главный.present === false && (
                /* Токен есть, окна нет — и это не полбеды, а полный отказ:
                   залив идёт ВНУТРИ окна. Отдельный бейдж, потому что чинится
                   он в антидетекте, а «no OAuth» — в панели. */
                <span
                  title="The token is here, but this profile no longer exists in the antidetect — an upload runs inside its window"
                  className="flex-none rounded border border-warning/30 bg-warning-soft px-1 text-2xs text-warning"
                >
                  no window
                </span>
              )}
            </div>
            {ещё.length > 0 && (() => {
              /* Соцы, с которых виден тот же кабинет. Строка одна, и этот бейдж —
                 единственное место, где видно остальных. Выбывшие из антика
                 помечены отдельно: «виден ещё с пяти» и «виден ещё с одного
                 живого и четырёх призраков» — разные факты.
                 ИМЕНАМИ, как и главный соц: список идентификаторов через запятую
                 не читается вовсе. */
              const призраков = ещё.filter((o) => o.present === false).length;
              const имена = ещё.map((o) => o.label || o.profile);
              return (
                <div
                  className="flex items-center gap-1 truncate text-2xs text-muted-foreground"
                  title={
                    `The same ad account is visible from: ${имена.join(", ")}` +
                    (призраков
                      ? `\n${призраков} of them ${призраков === 1 ? "is" : "are"} gone from the antidetect — kept for history, not usable for upload`
                      : "")
                  }
                >
                  {/* «shared» словом, а не одной иконкой: общий кабинет — это не
                      украшение строки, а причина, по которой он не задвоился. */}
                  <Link2 className="size-3 flex-none" strokeWidth={1.5} aria-hidden />
                  <span className="flex-none">shared</span>
                  <span className="truncate">· {имена.join(", ")}</span>
                  {!!призраков && (
                    <span className="flex-none text-ghost">· {призраков} gone</span>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </td>

      <td
        className="tnum px-2 py-2 text-right font-mono text-xs"
        title={fieldEvidence(a, "amount_spent")}
      >
        {money(a.amount_spent, a.currency)}
      </td>

      {/* «no card» — утверждение, и делать его можно только про кабинет, состояние
          которого снимали. У неопрошенного пустое поле значит «не знаем», а
          оранжевое «no card» пугало бы владельца тем, чего никто не проверял. */}
      <td className="px-2 py-2">
        {billing ? (
          <span className="block truncate text-2xs" title={billing}>{billing}</span>
        ) : a.status_checked_at ? (
          <span
            className="text-2xs text-warning"
            title="No payment method — this ad account will not deliver"
          >
            no card
          </span>
        ) : (
          <span className="text-2xs text-muted-foreground" title="never collected">{DASH}</span>
        )}
      </td>

      {есть("pixel") && (
      <td className="px-2 py-2">
        {/* ВСЕ пиксели кабинета и ИМЕНАМИ, а не первый айдишкой: имя
            («hiu—Bangla-ogaff») несёт агентство, гео и оффер, то есть ровно то, по
            чему пиксель и опознают. Айди остался в подсказке: он нужен, но не
            глазам. Максимум три имени, остальные — сноской, иначе высота строки
            зависела бы от того, сколько пикселей завели на кабинете. */}
        {px.length ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            {px.slice(0, 3).map((p) => (
              <span key={p.id} className="truncate text-2xs" title={p.name ? `${p.name}\n${p.id}` : p.id}>
                {p.name || <span className="font-mono text-faint">{p.id}</span>}
              </span>
            ))}
            {px.length > 3 && (
              <Tip
                placement="left"
                content={
                  <span className="flex flex-col gap-0.5">
                    {px.map((p) => (
                      <span key={p.id} className="whitespace-nowrap">
                        {p.name || p.id}
                        {p.name ? <span className="ml-2 font-mono text-faint">{p.id}</span> : null}
                      </span>
                    ))}
                  </span>
                }
              >
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="focus-ring w-fit rounded text-2xs text-primary-ink
                             transition-colors duration-150 ease-out hover:text-foreground"
                >
                  +{px.length - 3} more
                </button>
              </Tip>
            )}
          </div>
        ) : a.inSnapshot ? (
          /* Кабинет собирали с машины оператора и пикселей у него не нашли — это
             факт. У кабинета из базы пикселей нет в самих данных, и «none» было бы
             утверждением о том, чего никто не смотрел. */
          <span className="text-2xs text-ghost">none</span>
        ) : (
          <span className="text-2xs text-muted-foreground" title="pixels are only collected from a profile on the operator's machine">
            {DASH}
          </span>
        )}
      </td>
      )}
    </tr>
  );
}

/** Переключатель страниц и размера страницы.
 *
 *  Живёт ПОД таблицей, а размер страницы — слева от номеров: «показывать по»
 *  трогают раз в жизнь, а по страницам ходят постоянно, и частому действию
 *  место ближе к правому краю, где рука.
 *
 *  Одна страница — полосу не рисуем совсем, но «показывать по» оставляем:
 *  именно из-за него список и уместился в одну страницу, и вернуть 25 обратно
 *  должно быть можно там же, где поставил.
 */
function Pager({
  paged,
  onPage,
  size,
  onSize,
}: {
  paged: { page: number; pages: number; total: number };
  onPage: (n: number) => void;
  size: number;
  onSize: (n: number) => void;
}) {
  if (!paged.total) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
      <label className="flex items-center gap-1.5 text-2xs text-muted-foreground">
        Rows per page
        <select
          value={size}
          onChange={(e) => onSize(Number(e.target.value))}
          aria-label="How many ad accounts to show per page"
          className="focus-ring rounded-md border border-border bg-background px-1.5 py-1
                     text-xs text-foreground outline-none hover:border-border-strong"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      {paged.pages > 1 && (
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onPage(paged.page - 1)}
            disabled={paged.page <= 1}
            aria-label="Previous page"
          >
            Prev
          </Button>
          {pageWindow(paged.page, paged.pages).map((n, i) =>
            n === null ? (
              <span key={`gap${i}`} className="px-1 text-2xs text-ghost">…</span>
            ) : (
              <Button
                key={n}
                variant={n === paged.page ? "outline" : "ghost"}
                size="xs"
                onClick={() => onPage(n)}
                aria-current={n === paged.page ? "page" : undefined}
                className={cn("tnum min-w-8", n === paged.page && "border-primary text-primary-ink")}
              >
                {n}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onPage(paged.page + 1)}
            disabled={paged.page >= paged.pages}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

/* Плашка «часть парка устарела» (`StaleBanner`) удалена: то же самое теперь
   говорит `sections/DataHealth` — одной строкой вместе с остальными фактами о
   данных, и с ИМЕНЕМ профиля вместо его идентификатора. Прежняя плашка
   начинала сообщение с `2fcc2d23-ecd8-4122-ac84-a72dfc77d002`, то есть первым
   на экран выходило то, что человеку не говорит ничего. */

/* Своего пустого состояния у листа больше нет: оно вынесено целиком
   (`NoAccounts.tsx`). Там же записано, почему текст перестал звать чинить
   фоновый сбор. */

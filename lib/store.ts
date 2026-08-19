"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Account, BuildCtx, CabGroup, DataSource, Form, Group, GroupMember, ResolvedState, Snapshot,
  TagDef,
} from "./types";
import { distributePixel, newGroup, snapshotIdentity, type SnapshotIdentity } from "./groups";
import {
  DEFAULT_FORM, DEF_BIND, DEF_CATALOG, DEF_TAGS, LICHKA, START_FORM, mergeProfiles,
} from "./seed";
import { mergePreset, resolveState } from "./form";
import { parseIds } from "./build-spec";
import { specToState } from "./spec-to-state";
import { ALL_SCOPE_IDS, scopeCarries, sliceForm } from "./preset-scope";
import { EMPTY_BRIDGE, type BridgeState } from "./snapshot-bridge";
import { DEFAULT_VISIBLE, LS_KEY as COLUMNS_LS_KEY } from "./analytics-columns";
import { DEFAULT_PAGE_SIZE, normalizeSize } from "./paging";
import { ensureCreoName } from "./naming-guard";

/** Состояние листа «Аналитика».
 *
 *  Всё здесь — настройка рабочего места, а не состояние одного захода. Байер
 *  приходит к таблице десятки раз в день, и «набери срез заново» это ровно та
 *  неприятность, ради которой лист переделывался. Раньше не хранилось ничего,
 *  кроме списка колонок, и то в отдельном ключе localStorage.
 *
 *  Set сериализуется массивом: JSON в localStorage множеств не умеет. */
export interface AnalyticsSlice {
  visible: string[];
  /** Ширины по id колонки. Держим сами, а не отдаём react-aria: тогда они
   *  переживают и перестановку колонок, и перезагрузку страницы. */
  widths: Record<string, number>;
  sortKey: string;
  sortDesc: boolean;
  /** Сортировка ВНУТРИ развёрнутого крео — по кабинетам, отдельно от верхней.
   *
   *  Два разных вопроса: наверху «какой крео лучше», внутри «на каком кабе он
   *  идёт». Отвечают они разными метриками: сверху обычно депы, а внутри —
   *  расход, потому что искать надо каб, который жрёт и не отдаёт. Одна общая
   *  сортировка заставляла выбирать между этими вопросами. */
  branchKey: string;
  branchDesc: boolean;
  geo: string | null;
  hideNoSpend: boolean;
  /** Поиск по именам узлов дерева. */
  q: string;
  socs: string[];
  statuses: string[];
  open: string[];
  selected: string[];
}

export function blankAnalytics(): AnalyticsSlice {
  return {
    visible: [...DEFAULT_VISIBLE],
    widths: {},
    sortKey: "ftd",
    sortDesc: true,
    // Внутри крео по умолчанию расход: кабы разворачивают, чтобы найти тот,
    // который тратит. Депов на отдельном кабе часто ноль у всех сразу, и
    // сортировка по ним внутри ветки не различает ничего.
    branchKey: "spend",
    branchDesc: true,
    geo: null,
    hideNoSpend: true,
    q: "",
    socs: [],
    statuses: [],
    open: [],
    selected: [],
  };
}

/** v3 → v4: список колонок жил в отдельном ключе localStorage, всё остальное не
 *  жило нигде. Переносим колонки, чтобы у того, кто уже настроил таблицу под
 *  себя, порядок не сбросился на дефолтный. */
export function migrateAnalytics(
  persisted: Record<string, unknown>,
  legacyColumns: string[] | null,
): AnalyticsSlice {
  const cur = (persisted.analytics as AnalyticsSlice | undefined) ?? blankAnalytics();
  if (persisted.analytics) {
    /* Сортировка внутри ветки появилась позже самого среза: у тех, кто уже
       что-то настроил, её в сохранённом объекте нет, и без подстановки она
       приехала бы как undefined — сортировка кабов молча отключилась бы. */
    const b = blankAnalytics();
    return {
      ...cur,
      branchKey: cur.branchKey ?? b.branchKey,
      branchDesc: cur.branchDesc ?? b.branchDesc,
    };
  }
  return legacyColumns?.length ? { ...cur, visible: legacyColumns } : cur;
}

export interface UserPreset {
  /** Срез формы по области пресета. Пресеты, сохранённые до появления областей,
   *  лежат тут целой формой — и применяются целиком (scope не задан). */
  form: Partial<Form>;
  picked: string[];
  groups: Group[];
  /** Секции, которые несёт пресет. undefined = старый пресет, применяем всё. */
  scope?: string[];
  savedAt?: number;
}

/** Состояние синхронизации снапшота. Живёт в сторе, а не в компоненте: индикатор
 *  в шапке рисуется на всех листах, а тянет данные оболочка. */
export interface SyncState {
  lastPullAt: number | null;
  source: string;
  pulling: boolean;
  /** Фактический интервал проверки: минута с плагином, 5 минут без него. */
  pollMs: number;
  /* Чем кончилась ПОСЛЕДНЯЯ попытка. Раньше состояния было два — «тяну» и «не
     тяну», — и провал выглядел ровно как успех: спиннер гас, цифры оставались
     старыми, и понять это можно было только по времени данных. */
  lastOkAt: number | null;
  error: string;
  /** Сколько соцев подключено к приложению и сколько профилей в антике.
   *  Нужно, чтобы лист кабинетов мог сказать «собралось 4 из 5», а не делать
   *  вид, что парк перед тобой целиком. */
  coverage?: { connected: number; in_antik: number };
}

interface BuilderState {
  form: Form;
  tags: Record<string, TagDef>;
  bind: Record<string, string>;
  catalog: Record<string, Account[]>;
  picked: Record<string, string[]>;
  groups: Record<string, Group[]>;
  /** Группы кабинетов, каждая со своей полной связкой. Плоский список, а не
   *  разбивка по профилю: группа собирается сразу с нескольких соцев. */
  cabGroups: CabGroup[];
  /** Какая группа открыта в редакторе аплоада. */
  activeGroup: string | null;
  /** Отмеченные кабы в листе «Кабинеты» — сырьё для новой группы. */
  cabSelection: GroupMember[];
  dispMode: "name" | "id";
  /** Облачный лист кабинетов: группировать по Business Manager или показать плоским
   *  списком. Решение владельца 14.08: группировка полезна, но обязательной быть не
   *  должна. Хранится вместе с остальными настройками вида — переключатель, который
   *  забывается при переходе между листами, приходится щёлкать заново каждый раз.
   *
   *  ПО УМОЛЧАНИЮ «none», и это правка #166. Стояло «bm»: экран входа открывался
   *  разрезом по Business Manager, хотя владелец прямым текстом сказал, что БМ
   *  ему как сущность НЕ НУЖНЫ. Первое, что он видел, отвечало на вопрос,
   *  которого не задавал, — и отвечало неверно (тёзки-группы). Переключатель
   *  остался на месте: кому нужен разрез, тот его включит и настройка запомнится. */
  cabGroupBy: "bm" | "none";
  /** Откуда лист профилей и кабинетов берёт данные: сервер с OAuth или уже
   *  загруженный снапшот арендатора. По умолчанию `"server"` — существующее
   *  поведение, которое переключателем НЕ меняется ни в чём.
   *
   *  Настройка, а не состояние захода: запасной ход включают, когда OAuth
   *  ненадёжен, и он обязан пережить перезагрузку страницы. */
  dataSource: DataSource;
  healthMode: "problems" | "all";
  theme: "dark" | "light";
  railCollapsed: boolean;
  userPresets: Record<string, UserPreset>;
  snapshot: Snapshot | null;
  sync: SyncState;
  bridge: BridgeState;
  /** Настройка рабочего места в листе «Аналитика». */
  analytics: AnalyticsSlice;
  /** Ширины колонок листа «Кабинеты», по id колонки.
   *
   *  Отдельно от `analytics.widths`: таблицы разные, колонки разные, и общий
   *  словарь однажды выдал бы ширину «спенда» аналитики колонке «спенд»
   *  кабинетов — они называются одинаково, а значат разное. */
  accountCols: Record<string, number>;
  /** Сколько строк на странице листа «Кабинеты». Настройка, а не состояние
   *  захода: её выставляют под свой экран один раз. */
  accountsPageSize: number;
  setAccountsPageSize: (n: number) => void;

  /* Запрос ручного обновления снапшота.
   *
   *  Счётчик, а не функция в сторе: саму загрузку ведёт оболочка (там живёт
   *  поллинг, мост и разбор источников), а кнопка теперь стоит на листе
   *  кабинетов. Передавать колбэк через стор значит хранить в состоянии
   *  замыкание на размонтированный компонент; тик — просто число. */
  refreshRequest: number;
  requestRefresh: () => void;

  patchForm: (patch: Partial<Form>) => void;
  setField: <K extends keyof Form>(key: K, value: Form[K]) => void;
  setProfile: (id: string) => void;
  setTag: (tag: string) => void;
  setTheme: (theme: "dark" | "light") => void;
  setRailCollapsed: (v: boolean) => void;
  setSync: (patch: Partial<SyncState>) => void;
  setBridge: (b: BridgeState) => void;
  setDispMode: (m: "name" | "id") => void;
  setCabGroupBy: (m: "bm" | "none") => void;
  setDataSource: (m: DataSource) => void;
  setHealthMode: (m: "problems" | "all") => void;
  setAnalytics: (patch: Partial<AnalyticsSlice>) => void;
  setAccountCol: (id: string, w: number) => void;

  togglePicked: (id: string) => void;
  setPickedFromText: (text: string) => void;
  pickAll: () => void;
  pickNone: () => void;

  addGroup: (cabs?: string) => void;
  addGroupFromSelected: () => void;
  updateGroup: (i: number, key: keyof Group, val: string) => void;
  deleteGroup: (i: number) => void;

  /* ── группы кабинетов со своей связкой (листы «Кабинеты» и «Аплоад») ── */
  toggleCab: (m: GroupMember) => void;
  setCabSelection: (ms: GroupMember[]) => void;
  clearCabSelection: () => void;
  createGroupFromSelection: (name?: string) => string | null;
  renameCabGroup: (id: string, name: string) => void;
  deleteCabGroup: (id: string) => void;
  duplicateCabGroup: (id: string) => void;
  /** Разлить пиксель, ссылку и хвост этого кабинета на все кабинеты его соца. */
  applyMemberLinkToProfile: (groupId: string, from: GroupMember) => void;
  setActiveGroup: (id: string | null) => void;
  setGroupField: <K extends keyof Form>(id: string, key: K, value: Form[K]) => void;
  setGroupPage: (id: string, profile: string, page: string) => void;
  patchGroupForm: (id: string, patch: Partial<Form>) => void;
  copyGroupForm: (fromId: string, toId: string) => void;
  applyPresetToGroup: (id: string, preset: string) => void;
  removeGroupMember: (id: string, m: GroupMember) => void;
  addSelectionToGroup: (id: string) => void;
  setMemberField: (
    id: string, m: GroupMember, key: "pixel" | "link" | "tail", value: string
  ) => void;
  setAllMemberPixels: (id: string, pixel: string) => void;

  addTag: (key: string) => void;
  updateTagPrefix: (key: string, prefix: string) => void;
  deleteTag: (key: string) => void;

  applyUserPreset: (name: string) => void;
  /** `fromGroup` — сохранить форму этой группы кабинетов, а не форму конструктора. */
  saveUserPreset: (name: string, scope?: string[], fromGroup?: string) => void;
  renameUserPreset: (from: string, to: string) => void;
  deleteUserPreset: (name: string) => void;

  importSpec: (spec: Record<string, unknown>) => void;
  setSnapshot: (snap: Snapshot) => void;
}

const INITIAL_FORM = mergePreset(DEFAULT_FORM, START_FORM, DEF_BIND);

/** Ключ пары соц+каб. Один act_id бывает виден с двух соцев, и это РАЗНЫЕ
 *  члены группы: заливать надо с того, который выбран. */
/** Члены группы — на ревизию ТЕКУЩЕГО снапшота, если это тот же провайдер.
 *
 *  Ревизия меняется при каждой пересборке снапшота, а группа переживает их
 *  десятками. Резолв на ревизию больше не смотрит (`resolveSnapshotMember`), но
 *  ЗАПИСАНА она в члене — и уезжает в JSON бандла (`bundleJson`). Не обновив её
 *  здесь, панель обещала бы движку ревизию, которой уже нет, и «ровно тот парк,
 *  что видно на экране» стало бы неправдой в первом же поле.
 *
 *  ЧУЖОЙ ПРОВАЙДЕР НЕ ШТАМПУЕТСЯ. Член адспауэровской группы обязан остаться
 *  адспауэровским и упереться в `provider_mismatch`: молча переписать его под
 *  шардовый парк значило бы залив с чужого окна. */
function перештамп(ms: GroupMember[], id: SnapshotIdentity | null): GroupMember[] {
  if (!id) return ms;
  let менялось = false;
  const out = ms.map((m) => {
    if (m.source !== "snapshot" || (m.provider || "").toLowerCase() !== id.provider) return m;
    if (m.snapshot_revision === id.revision && m.snapshot_generated_at === id.generatedAt) return m;
    менялось = true;
    return { ...m, snapshot_revision: id.revision, snapshot_generated_at: id.generatedAt };
  });
  return менялось ? out : ms;
}

const memberKey = (m: GroupMember) => [
  m.source || "legacy",
  m.provider || "",
  m.snapshot_revision || "",
  m.provider_profile_id || m.profile,
  m.act,
].join(":");

function dedupeMembers(ms: GroupMember[]): GroupMember[] {
  const seen = new Set<string>();
  const out: GroupMember[] = [];
  for (const m of ms) {
    const k = memberKey(m);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

/** Первый свободный id. Счётчик, а не время и не случайность: id попадает в
 *  localStorage, и он должен переживать перезагрузку без коллизий. */
function nextGroupId(gs: CabGroup[]): string {
  const used = new Set(gs.map((g) => g.id));
  let n = 1;
  while (used.has("g" + n)) n++;
  return "g" + n;
}

/** Старые хвост-группы → группы со связкой.
 *
 *  Раньше группа держала список кабов плюс пиксель и хвост ПОВЕРХ одной общей
 *  формы. Переносим так: форма группы — та самая общая форма, а пиксель и
 *  хвост встают в неё обычными полями. Кабы достаём регуляркой: в строке они
 *  лежали либо как `act_…`, либо как имена, а имена без каталога всё равно не
 *  разрешаются — их оператор доберёт руками в листе «Кабинеты». */
function migrateGroups(p: Partial<BuilderState>): CabGroup[] {
  const out: CabGroup[] = [];
  const base = (p.form || INITIAL_FORM) as Form;
  const old = p.groups || {};
  for (const profile of Object.keys(old)) {
    for (const g of old[profile] || []) {
      const acts = (g.cabs || "").match(/act_\d+/g) || [];
      if (!acts.length) continue;
      out.push({
        id: nextGroupId(out),
        name: `${profile} · ${out.length + 1}`,
        members: acts.map((act) => ({ profile, act })),
        form: {
          ...base,
          profile,
          pixel: g.pixel && g.pixel !== "auto" ? g.pixel : base.pixel,
          creoUrl: g.tail || base.creoUrl,
        },
      });
    }
  }
  return out;
}

function nextGroupName(gs: CabGroup[]): string {
  const used = new Set(gs.map((g) => g.name));
  let n = gs.length + 1;
  while (used.has("Group " + n)) n++;
  return "Group " + n;
}

/** Имя копии: к исходному приписывается `copy1`, `copy2` и так далее.
 *
 *  Не «— копия»: копий бывает пять подряд, и одинаковые имена в списке групп
 *  различить нельзя вообще ничем — а выбирают группу именно по имени, и залив
 *  уходит по выбранной.
 *
 *  Копия копии не превращается в `copy1 copy1`: суффикс отрезается и нумерация
 *  продолжается от базового имени. */
function copyName(src: string, gs: CabGroup[]): string {
  const base = src.replace(/\s+copy\d+$/i, "").trim();
  /* Берём МАКСИМАЛЬНЫЙ занятый номер и прибавляем единицу, а не первый
     свободный. Разница видна ровно в одном сценарии, зато неприятном: удалил
     copy1, сделал новую — при «первом свободном» она снова станет copy1, то
     есть другой набор кабинетов получит имя, которое минуту назад значило
     другое. Группу выбирают по имени, и залив уходит по выбранной. */
  const rx = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+copy(\\d+)$", "i");
  let max = 0;
  for (const g of gs) {
    const m = rx.exec(g.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${base} copy${max + 1}`;
}

export const useStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      form: INITIAL_FORM,
      tags: { ...DEF_TAGS },
      bind: { ...DEF_BIND },
      catalog: { ...DEF_CATALOG },
      picked: {},
      groups: {},
      cabGroups: [],
      activeGroup: null,
      cabSelection: [],
      dispMode: "name",
      cabGroupBy: "none",
      dataSource: "server",
      healthMode: "problems",
      theme: "light",
      railCollapsed: false,
      userPresets: {},
      snapshot: null,
      sync: { lastPullAt: null, source: "", pulling: false, pollMs: 5 * 60 * 1000,
              lastOkAt: null, error: "" },
      bridge: EMPTY_BRIDGE,
      analytics: blankAnalytics(),
      accountCols: {},
      accountsPageSize: DEFAULT_PAGE_SIZE,
      refreshRequest: 0,

      patchForm: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),
      setField: (key, value) => set((s) => ({ form: { ...s.form, [key]: value } })),
      setProfile: (id) => set((s) => ({ form: { ...s.form, profile: id, tag: s.bind[id] ?? "" } })),
      setTag: (tag) =>
        set((s) => ({ form: { ...s.form, tag }, bind: { ...s.bind, [s.form.profile]: tag } })),
      setTheme: (theme) => set({ theme }),
      setRailCollapsed: (v) => set({ railCollapsed: v }),
      setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),
      setBridge: (bridge) => set({ bridge }),
      setDispMode: (m) => set({ dispMode: m }),
      setCabGroupBy: (m) => set({ cabGroupBy: m }),
      setDataSource: (dataSource) => set((s) => ({
        dataSource,
        /* Выбор хранит не только act_id, но и профиль, из которого пойдёт залив.
           Один кабинет может встретиться в обоих источниках с разными owner-
           связями, поэтому переносить старый выбор через смену источника нельзя:
           строка выглядела бы выбранной по act_id, а в группу уехал бы профиль
           из предыдущего режима. Повторное нажатие уже выбранного сегмента
           ничего не сбрасывает. */
        cabSelection: s.dataSource === dataSource ? s.cabSelection : [],
      })),
      setHealthMode: (m) => set({ healthMode: m }),
      setAnalytics: (patch) =>
        set((s) => ({ analytics: { ...s.analytics, ...patch } })),
      setAccountCol: (id, w) =>
        set((s) => ({ accountCols: { ...s.accountCols, [id]: Math.round(w) } })),
      // Через normalizeSize, а не как пришло: значение переживает обновления
      // панели в localStorage, и «показывать по 7 строк» из старой версии
      // сломало бы лист молча.
      setAccountsPageSize: (n) => set({ accountsPageSize: normalizeSize(n) }),
      requestRefresh: () => set((s) => ({ refreshRequest: s.refreshRequest + 1 })),

      togglePicked: (id) =>
        set((s) => {
          const p = s.form.profile;
          const arr = (s.picked[p] || []).slice();
          const i = arr.indexOf(id);
          if (i >= 0) arr.splice(i, 1);
          else arr.push(id);
          return { picked: { ...s.picked, [p]: arr } };
        }),
      setPickedFromText: (text) =>
        set((s) => {
          const p = s.form.profile;
          return { picked: { ...s.picked, [p]: parseIds(text, s.catalog[p] || []) } };
        }),
      pickAll: () =>
        set((s) => {
          const p = s.form.profile;
          const ids = (s.catalog[p] || []).filter((c) => !LICHKA[c.id]).map((c) => c.id);
          return { picked: { ...s.picked, [p]: ids } };
        }),
      pickNone: () =>
        set((s) => ({ picked: { ...s.picked, [s.form.profile]: [] } })),

      addGroup: (cabs = "") =>
        set((s) => {
          const p = s.form.profile;
          const list = [...(s.groups[p] || []), { cabs, pixel: "auto", tail: "" }];
          return { groups: { ...s.groups, [p]: list } };
        }),
      addGroupFromSelected: () => {
        const s = get();
        const p = s.form.profile;
        get().addGroup((s.picked[p] || []).join(", "));
      },
      updateGroup: (i, key, val) =>
        set((s) => {
          const p = s.form.profile;
          const list = (s.groups[p] || []).map((g, idx) => (idx === i ? { ...g, [key]: val } : g));
          return { groups: { ...s.groups, [p]: list } };
        }),
      deleteGroup: (i) =>
        set((s) => {
          const p = s.form.profile;
          const list = (s.groups[p] || []).filter((_, idx) => idx !== i);
          return { groups: { ...s.groups, [p]: list } };
        }),

      /* ── группы кабинетов ──────────────────────────────────────────── */

      toggleCab: (m) =>
        set((s) => {
          const k = memberKey(m);
          const has = s.cabSelection.some((x) => memberKey(x) === k);
          return {
            cabSelection: has
              ? s.cabSelection.filter((x) => memberKey(x) !== k)
              : [...s.cabSelection, m],
          };
        }),
      setCabSelection: (ms) => set({ cabSelection: dedupeMembers(ms) }),
      clearCabSelection: () => set({ cabSelection: [] }),

      createGroupFromSelection: (name) => {
        const s = get();
        if (!s.cabSelection.length) return null;
        const id = nextGroupId(s.cabGroups);
        const g = newGroup(id, name?.trim() || nextGroupName(s.cabGroups), s.cabSelection.slice());
        set({ cabGroups: [...s.cabGroups, g], cabSelection: [], activeGroup: id });
        return id;
      },
      renameCabGroup: (id, name) =>
        set((s) => ({
          cabGroups: s.cabGroups.map((g) => (g.id === id ? { ...g, name } : g)),
        })),
      deleteCabGroup: (id) =>
        set((s) => ({
          cabGroups: s.cabGroups.filter((g) => g.id !== id),
          activeGroup: s.activeGroup === id ? null : s.activeGroup,
        })),
      duplicateCabGroup: (id) =>
        set((s) => {
          const src = s.cabGroups.find((g) => g.id === id);
          if (!src) return {};
          const nid = nextGroupId(s.cabGroups);
          const copy: CabGroup = {
            id: nid,
            name: copyName(src.name, s.cabGroups),
            /* Члены копируются ПОЭЛЕМЕНТНО, а не ссылкой на массив: у члена
               свои пиксель, ссылка и хвост, и общий объект означал бы, что
               правка в копии молча меняет оригинал. Ровно то, чего от дубля
               не ждут. */
            members: src.members.map((m) => ({ ...m })),
            pageByProfile: { ...(src.pageByProfile || {}) },
            form: { ...src.form },
          };
          return { cabGroups: [...s.cabGroups, copy], activeGroup: nid };
        }),

      applyMemberLinkToProfile: (groupId, from) =>
        set((s) => ({
          cabGroups: s.cabGroups.map((g) =>
            g.id !== groupId
              ? g
              : {
                  ...g,
                  /* Только кабинеты ТОГО ЖЕ соца. Ссылка и хвост — это трекер
                     и его метки, а они у каждого профиля свои: разлить их на
                     всю группу значило бы отправить чужой трафик в чужую
                     статистику, и заметили бы это только по нулям в отчёте. */
                  members: g.members.map((m) =>
                    m.profile === from.profile
                      ? {
                          ...m,
                          link: from.link || "",
                          tail: from.tail || "",
                          /* Пиксель едет вместе со ссылкой и хвостом. Это одна
                             настройка, а не три: пиксель, ссылка и метки — про
                             один и тот же трекер одного и того же профиля.
                             Разлить два поля из трёх значит оставить кабинеты
                             в состоянии, которого не бывает в работе, и
                             человек всё равно пойдёт доставлять пиксель
                             руками — ровно от этого кнопка и избавляет. */
                          pixel: from.pixel || "",
                        }
                      : m,
                  ),
                },
          ),
        })),
      setActiveGroup: (id) => set({ activeGroup: id }),

      setGroupField: (id, key, value) =>
        set((s) => ({
          cabGroups: s.cabGroups.map((g) =>
            g.id === id ? { ...g, form: { ...g.form, [key]: value } } : g
          ),
        })),
      setGroupPage: (id, profile, page) =>
        set((s) => ({
          cabGroups: s.cabGroups.map((g) => {
            if (g.id !== id) return g;
            const next = { ...(g.pageByProfile || {}) };
            const value = page.trim();
            if (value) next[profile] = value;
            else delete next[profile];
            return { ...g, pageByProfile: next };
          }),
        })),
      patchGroupForm: (id, patch) =>
        set((s) => ({
          cabGroups: s.cabGroups.map((g) =>
            g.id === id ? { ...g, form: { ...g.form, ...patch } } : g
          ),
        })),
      /* Связка копируется БЕЗ кабинетов: группы тем и отличаются, что кабы у
         них разные, а настройки бывают общими. */
      copyGroupForm: (fromId, toId) =>
        set((s) => {
          const src = s.cabGroups.find((g) => g.id === fromId);
          if (!src) return {};
          return {
            cabGroups: s.cabGroups.map((g) =>
              g.id === toId ? distributePixel({ ...g, form: { ...src.form } }) : g
            ),
          };
        }),
      applyPresetToGroup: (id, preset) =>
        set((s) => {
          const up = s.userPresets[preset];
          if (!up) return {};
          const full = !up.scope;
          return {
            cabGroups: s.cabGroups.map((g) => {
              if (g.id !== id) return g;
              const form = full
                ? ({ ...DEFAULT_FORM, ...up.form } as Form)
                : ({ ...g.form, ...up.form } as Form);
              // Пиксель из пресета едет на кабинеты: в группе его больше негде
              // показать, а тихо оставить в форме — значит залить не туда молча.
              return distributePixel({ ...g, form });
            }),
          };
        }),
      removeGroupMember: (id, m) =>
        set((s) => {
          const k = memberKey(m);
          return {
            cabGroups: s.cabGroups.map((g) =>
              g.id === id ? { ...g, members: g.members.filter((x) => memberKey(x) !== k) } : g
            ),
          };
        }),
      /* Переопределение конкретного кабинета внутри группы: пиксель, ссылка,
         хвост. Пустая строка стирает переопределение, а не пишет пустоту:
         хранить копию значения связки нельзя — при смене общего кабинет молча
         остался бы на старом. */
      setMemberField: (id, m, key, value) =>
        set((s) => {
          const k = memberKey(m);
          return {
            cabGroups: s.cabGroups.map((g) =>
              g.id === id
                ? {
                    ...g,
                    members: g.members.map((x) =>
                      memberKey(x) === k ? { ...x, [key]: value.trim() || undefined } : x
                    ),
                  }
                : g
            ),
          };
        }),
      /* Один пиксель всем кабинетам группы — не «значение по умолчанию», а
         запись в каждый кабинет. Второго уровня (общий + личный) больше нет:
         именно он и путал. "auto" здесь — сброс личных выборов. */
      setAllMemberPixels: (id, pixel) =>
        set((s) => ({
          cabGroups: s.cabGroups.map((g) =>
            g.id === id
              ? {
                  ...g,
                  members: g.members.map((x) => ({
                    ...x,
                    pixel: pixel && pixel !== "auto" ? pixel : undefined,
                  })),
                }
              : g
          ),
        })),
      addSelectionToGroup: (id) =>
        set((s) => {
          if (!s.cabSelection.length) return {};
          return {
            cabGroups: s.cabGroups.map((g) =>
              g.id === id ? { ...g, members: dedupeMembers([...g.members, ...s.cabSelection]) } : g
            ),
            cabSelection: [],
          };
        }),

      addTag: (key) =>
        set((s) => {
          if (!key || s.tags[key]) return {};
          return { tags: { ...s.tags, [key]: { prefix: key + "--" } } };
        }),
      updateTagPrefix: (key, prefix) =>
        set((s) => ({ tags: { ...s.tags, [key]: { prefix } } })),
      deleteTag: (key) =>
        set((s) => {
          const tags = { ...s.tags };
          delete tags[key];
          const bind = { ...s.bind };
          for (const p in bind) if (bind[p] === key) bind[p] = "";
          const form = s.form.tag === key ? { ...s.form, tag: bind[s.form.profile] || "" } : s.form;
          return { tags, bind, form };
        }),

      /* Пресет с областью накладывается ПОВЕРХ текущей формы: «только таргетинг»
         обязан поменять таргетинг и не тронуть остальное. Пресет без области —
         старый, сохранённый целой формой: он по-прежнему заменяет сетап целиком
         (через DEFAULT_FORM), иначе у старых пресетов поехало бы поведение. */
      applyUserPreset: (name) =>
        set((s) => {
          const up = s.userPresets[name];
          if (!up) return {};
          const full = !up.scope;
          const form = full
            ? ({ ...DEFAULT_FORM, ...up.form } as Form)
            : ({ ...s.form, ...up.form } as Form);
          const next: Partial<BuilderState> = { form };
          if (full || scopeCarries(up.scope!, "picked")) {
            next.picked = { ...s.picked, [form.profile]: up.picked.slice() };
          }
          if (full || scopeCarries(up.scope!, "groups")) {
            next.groups = { ...s.groups, [form.profile]: up.groups.map((g) => ({ ...g })) };
          }
          return next;
        }),
      /* Форму берём с того листа, откуда сохраняют.
         На «Аплоаде» человек правит форму КОНКРЕТНОЙ группы, и форма
         конструктора там ни при чём: кнопка, которая сохраняет невидимый
         сетап вместо того, что на экране, врёт молча — и обнаруживается это
         через залив. Кабы и хвост-группы из группы в пресет не едут: они
         принадлежат группе (`members`), а пресет переживает десятки заливов. */
      saveUserPreset: (name, scope, fromGroup) =>
        set((s) => {
          const p = s.form.profile;
          const sc = scope && scope.length ? scope : ALL_SCOPE_IDS;
          const g = fromGroup ? s.cabGroups.find((x) => x.id === fromGroup) : null;
          // Просили форму группы, а группы уже нет — лучше не сохранить ничего,
          // чем сохранить под этим именем чужой сетап конструктора.
          if (fromGroup && !g) return {};
          return {
            userPresets: {
              ...s.userPresets,
              [name]: {
                form: sliceForm(g ? g.form : s.form, sc),
                picked: !g && scopeCarries(sc, "picked") ? (s.picked[p] || []).slice() : [],
                groups:
                  !g && scopeCarries(sc, "groups") ? (s.groups[p] || []).map((x) => ({ ...x })) : [],
                scope: sc,
                savedAt: Date.now(),
              },
            },
          };
        }),
      renameUserPreset: (from, to) =>
        set((s) => {
          const up = s.userPresets[from];
          if (!up || !to.trim() || from === to) return {};
          // Порядок ключей = порядок в списке: пересобираем, подменяя имя на месте.
          const next: Record<string, UserPreset> = {};
          for (const k in s.userPresets) next[k === from ? to : k] = s.userPresets[k];
          return { userPresets: next };
        }),
      deleteUserPreset: (name) =>
        set((s) => {
          const up = { ...s.userPresets };
          delete up[name];
          return { userPresets: up };
        }),

      importSpec: (spec) =>
        set((s) => {
          const { form: f, picked } = specToState(spec, s.tags);
          const form = { ...DEFAULT_FORM, ...f };
          const next: Partial<BuilderState> = { form };
          if (picked !== null) next.picked = { ...s.picked, [form.profile]: picked };
          return next;
        }),
      setSnapshot: (snap) =>
        set((s) => {
          const catalog = { ...s.catalog };
          for (const p in snap.profiles || {}) {
            const accs = snap.profiles?.[p].accounts || [];
            if (accs.length) catalog[p] = accs.map((a) => ({ id: a.id, name: a.name }));
          }
          const id = snapshotIdentity(snap);
          return {
            snapshot: snap,
            catalog,
            cabGroups: s.cabGroups.map((g) => ({ ...g, members: перештамп(g.members, id) })),
            cabSelection: перештамп(s.cabSelection, id),
          };
        }),
    }),
    {
      name: "zaliv-panel-v2",
      storage: createJSONStorage(() => localStorage),
      // v0 → v1: акцент "green" убран, дефолтом стал лайм. Сохранённый выбор
      // цвета сбрасываем — иначе у всех, кто уже открывал панель, в localStorage
      // так и лежал бы старый accent, и нового цвета они бы не увидели. Форму,
      // пресеты и каталог migrate не трогает.
      // v1 → v2: хвост-группы стали группами со СВОЕЙ связкой. Без миграции у
      // всех, кто уже открывал панель, в localStorage остались бы старые
      // группы, а новый лист открылся бы пустым — и выглядело бы это как
      // «панель потеряла мою работу».
      // v2 → v3: пиксель группы переехал на кабинеты. У тех, кто уже выбрал его
      // на шаге «Цель», значение осталось бы в форме, где его больше не видно —
      // переносим на кабинеты, иначе залив ушёл бы с пикселем, которого никто
      // не показывает.
      // v3 → v4: лист аналитики обзавёлся своим срезом настроек. До этого
      // сохранялся только список колонок, и то отдельным ключом localStorage;
      // развороты, отметки, сортировка и фильтры не переживали даже минуту —
      // авто-рефреш звал load(), а тот обнулял их безусловно.
      // v4 → v5: имя крео стало обязательным в хвосте шаблона объявления.
      // Без миграции правка дефолта чинила ровно один сценарий — чистый
      // браузер и новая группа. У того, кто уже работал с панелью, форма из
      // localStorage перекрывает дефолт (см. merge ниже), и он продолжил бы
      // заливать объявления, которые аналитика не может связать ни с одним
      // крео. Чиним форму, все группы и пресеты с областью «нейминг».
      // v5 → v6: выбор акцента убран, акцент один — фиолетовый. Без подъёма
      // версии у того, кто выбрал лайм, в localStorage так и лежал бы
      // `accent: "lime"`, а атрибут `data-accent` больше никем не читается —
      // панель осталась бы фиолетовой, но мусор в сторе жил бы вечно. Само
      // удаление делает `delete p.accent` ниже, оно безусловное.
      // v6 → v7: groups created before provenance existed are explicitly
      // Server/OAuth groups. They must never masquerade as members of whatever
      // snapshot happens to be current after an upgrade.
      version: 7,
      migrate: (persisted, from) => {
        const p = { ...((persisted || {}) as Partial<BuilderState>) };
        /* `accent` в типе больше нет, а в чужом localStorage он есть — у всех,
           кто открывал панель до 10.08. Удаляем через каст: без него ключ
           переживёт миграцию и останется висеть навсегда, потому что
           `partialize` его уже не перезапишет. */
        delete (p as Record<string, unknown>).accent;
        if (from < 2 && !p.cabGroups) {
          p.cabGroups = migrateGroups(p);
          p.activeGroup = null;
        }
        if (from < 3 && p.cabGroups) p.cabGroups = p.cabGroups.map(distributePixel);
        if (from < 4) {
          let legacy: string[] | null = null;
          try {
            const raw = window.localStorage.getItem(COLUMNS_LS_KEY);
            legacy = raw ? (JSON.parse(raw) as string[]) : null;
          } catch {
            legacy = null;
          }
          p.analytics = migrateAnalytics(p as Record<string, unknown>, legacy);
        }
        if (from < 5) {
          const fix = (f?: Partial<Form>) =>
            f && typeof f.nmAd === "string" ? { ...f, nmAd: ensureCreoName(f.nmAd) } : f;
          p.form = fix(p.form) as Form | undefined;
          if (p.cabGroups)
            p.cabGroups = p.cabGroups.map((g) => ({ ...g, form: fix(g.form) as Form }));
          if (p.userPresets)
            p.userPresets = Object.fromEntries(
              Object.entries(p.userPresets).map(([k, v]) => [k, { ...v, form: fix(v.form) }]),
            ) as typeof p.userPresets;
        }
        if (from < 7 && p.cabGroups) {
          p.cabGroups = p.cabGroups.map((g) => ({
            ...g,
            members: g.members.map((m) => ({ ...m, source: m.source || "server" })),
          }));
        }
        return p as BuilderState;
      },
      partialize: (s) => ({
        form: s.form, tags: s.tags, bind: s.bind, catalog: s.catalog, picked: s.picked,
        groups: s.groups, dispMode: s.dispMode, healthMode: s.healthMode,
        cabGroupBy: s.cabGroupBy,
        /* Источник данных переживает перезагрузку — этого прямо требует иссус
           #XR-34 («режим сохраняется в локальном хранилище браузера»).

           НИ ПОДНЯТИЯ ВЕРСИИ, НИ ВЕТКИ МИГРАЦИИ здесь нет намеренно: `merge`
           ниже — это `{...current, ...persisted}`, поэтому старое хранилище,
           в котором ключа нет вовсе, оставляет значение по умолчанию
           `"server"`. Это и есть требование «по умолчанию Server/OAuth для
           существующих пользователей», выполненное устройством, а не
           отдельной веткой, которую пришлось бы поддерживать. */
        dataSource: s.dataSource,
        theme: s.theme, railCollapsed: s.railCollapsed, userPresets: s.userPresets,
        analytics: s.analytics,
        accountCols: s.accountCols,
        accountsPageSize: s.accountsPageSize,
        // cabSelection намеренно НЕ сохраняем: отметки в таблице — состояние
        // одного захода, а не настройка.
        cabGroups: s.cabGroups, activeGroup: s.activeGroup,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<BuilderState>;
        return {
          ...current,
          ...p,
          tags: { ...current.tags, ...(p.tags || {}) },
          bind: { ...current.bind, ...(p.bind || {}) },
          catalog: { ...current.catalog, ...(p.catalog || {}) },
          form: { ...current.form, ...(p.form || {}) },
        };
      },
    }
  )
);

// ── derived selectors (pure helpers over the store) ────────────────────────
export function buildCtx(s: BuilderState): BuildCtx {
  return { tags: s.tags, bind: s.bind, profiles: mergeProfiles(s.snapshot), catalogAll: s.catalog, lichka: LICHKA, snapshot: s.snapshot };
}

export function resolvedFromStore(s: BuilderState): ResolvedState {
  const p = s.form.profile;
  return resolveState(s.form, s.picked[p] || [], s.groups[p] || []);
}

// Stable empty fallbacks — never build `x || []` inside a selector (new ref → infinite loop in zustand v5).
export const EMPTY_IDS: string[] = [];
export const EMPTY_ACCOUNTS: Account[] = [];
export const EMPTY_GROUPS: Group[] = [];

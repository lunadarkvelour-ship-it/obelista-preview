// Domain types — mirror the original zaliv_builder.html data model.

export interface Profile { id: string; label: string; team: string }
export interface Account { id: string; name: string }
export interface TagDef { prefix: string }
export type AcctMode = "all_active" | "pick" | "exclude";
export interface Group { cabs: string; pixel: string; tail: string }
export interface LiveGroup extends Group { ids: string[] }

/** Raw editable form fields (what the user types). */
export interface Form {
  profile: string;
  tag: string;
  acctMode: AcctMode;
  nCamp: number;
  nAdset: number;
  nAd: number;
  objective: string;
  convLoc: string;
  pixel: string;
  event: string;
  formId: string;
  attribution: string;
  budgetLevel: string;
  daily: number;
  bidStrategy: string;
  cap: number | "";
  geo: string;
  ageMin: number;
  ageMax: number;
  gender: string;
  device: string;
  userOs: string;
  osVer: string;
  advAud: boolean;
  plcMode: string;
  plats: string[];
  positions: string;
  page: string;
  link: string;
  videoLines: string;
  creoSrc: string;
  staticAsVideo: boolean;
  creoCta: string;
  creoPt: string;
  creoHl: string;
  creoUrl: string;
  nmCamp: string;
  nmAdset: string;
  nmAd: string;
  activate: string;
  startTime: string;
  startLocal: boolean;
  specialCat: string;
  /** Указания к связке свободным текстом — то, что человек хочет сказать модели.
   *
   *  Заведено потому, что другого места для прозы в панели не было, и её писали
   *  в `creatives[].file`: «Там 4 крео в папке from ffmpeg script», «по 1
   *  кампании на каб ставим» вперемешку с настоящими именами. Движок обязан
   *  читать `file` как имя файла — половина спеки прозой это обещание ломала. */
  notes: string;
}

/** Normalized state consumed by build/validate — equals old readState() output. */
export interface ResolvedState {
  profile: string;
  tag: string;
  acctMode: AcctMode;
  picked: string[];
  groups: Group[];
  nCamp: number;
  nAdset: number;
  nAd: number;
  objective: string;
  convLoc: string;
  pixel: string;
  event: string;
  formId: string;
  attribution: string;
  budgetLevel: string;
  daily: number;
  bidStrategy: string;
  cap: number;
  geo: string[];
  ageMin: number;
  ageMax: number;
  gender: string;
  device: string;
  userOs: string;
  osVer: string;
  advAud: boolean;
  plcMode: string;
  plats: string[];
  positions: string[];
  page: string;
  link: string;
  videos: string[];
  creoSrc: string;
  staticAsVideo: boolean;
  creoCta: string;
  creoPt: string;
  creoHl: string;
  creoUrl: string;
  nmCamp: string;
  nmAdset: string;
  nmAd: string;
  activate: string;
  startTime: string;
  startLocal: boolean;
  specialCat: string;
  notes: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Spec = Record<string, any>;

/** Кабинет вместе с соцем, через который он виден.
 *
 *  Пара, а не голый act_id: один и тот же кабинет бывает доступен с нескольких
 *  подключённых соцев (`SnapshotAccount.also_on`), а движок резолвит кабы ВНУТРИ
 *  профиля (`core/uploader.py: resolve_profile`) и на чужом отвечает «Кабинеты не
 *  найдены». Значит соц обязан ехать вместе с кабом до самой спеки. */
export interface GroupMember {
  profile: string;
  act: string;
  /** Membership provenance. Snapshot members are valid only against the exact
   * provider + revision that created them; labels and timestamps are not identity. */
  source?: "snapshot" | "server";
  provider?: string;
  provider_profile_id?: string;
  snapshot_revision?: string;
  snapshot_generated_at?: string;
  /** Пиксель именно этого кабинета. Пусто — `auto`.
   *
   *  Нужен потому, что в одной группе живут кабинеты РАЗНЫХ агентств, а пиксель
   *  принадлежит агентству. Общий `auto` спасает не всегда: он берёт первый
   *  пиксель кабинета, а их бывает несколько, и нужный не обязательно первый. */
  pixel?: string;
  /** Ссылка этого кабинета. Пусто — ссылка связки (шаг «Page и оффер»). */
  link?: string;
  /** URL-хвост этого кабинета. Пусто — хвост связки (шаг «Креативы»).
   *
   *  Ссылка и хвост едут вместе с пикселем: пиксель другого агентства значит и
   *  чужой лендинг, и чужие метки в хвосте. Поэтому переопределяются там же, где
   *  пиксель, и так же режут бандл. */
  tail?: string;
}

/** Группа кабинетов со СВОЕЙ полной связкой.
 *
 *  Раньше группа переопределяла только пиксель и хвост поверх одной общей формы.
 *  Теперь у каждой группы форма целиком: на разные группы льют разное, вплоть до
 *  цели и структуры. Заполняется руками или из пресета. */
export interface CabGroup {
  id: string;
  name: string;
  members: GroupMember[];
  /** A Page belongs to a profile, while a group may span several profiles. */
  pageByProfile?: Record<string, string>;
  form: Form;
}

/** Одна связка на выходе: (группа × соц).
 *
 *  Разрез именно такой, потому что `spec.accounts` резолвится внутри одного
 *  профиля. Группа на четырёх соцах даёт четыре записи — и это же формат,
 *  который потом съест `execute_bundle`, когда он появится в MCP. */
export interface BundleItem {
  /** Имя группы на момент сборки — для текста и заголовков. НЕ идентификатор:
   *  имена свободный ввод без проверки уникальности, и две группы с
   *  одинаковым именем (частый случай — «EG» для двух срезов крео одного гео)
   *  дадут одинаковый `group`. Считать или искать по этому полю нельзя —
   *  для этого `groupId`. */
  group: string;
  /** `CabGroup.id`, устойчивый между переименованиями и совпадающими
   *  именами. Всё, что должно знать «эта связка из ТОЙ группы, а не из
   *  тёзки», использует его, а не `group`. */
  groupId: string;
  profile: string;
  source?: "snapshot" | "server";
  provider?: string;
  provider_profile_id?: string;
  snapshot_revision?: string;
  snapshot_generated_at?: string;
  accounts: string[];
  /** Пиксель этой связки: «auto» либо конкретный id. Разрез идёт и по нему —
   *  см. `buildBundle`. */
  pixel: string;
  page: string;
  /** Ссылка и хвост этой связки. В JSON не едут — они уже внутри `spec`
   *  (`link`, `creatives[].url_params`); здесь лежат, чтобы превью могло
   *  показать, ЧЕМ связки одной группы отличаются друг от друга. */
  link: string;
  tail: string;
  spec: Spec;
}

export interface SnapshotPixel { id: string; name?: string; last_fired_time?: string }
export interface SnapshotAccount {
  id: string;
  name: string;
  status?: string;
  disable_reason?: string;
  balance?: string | number;
  spent?: string | number;
  currency?: string;
  limit?: string | number;
  /** Имя БМ, которому принадлежит каб (или его id, если имя пустое). */
  business?: string;
  /** Способ оплаты как его показывает ФБ («Visa · 1234»); пусто — карты нет. */
  funding?: string;
  pixels?: SnapshotPixel[];
  /** Другие ПОДКЛЮЧЁННЫЕ соцы, с которых виден этот же кабинет.
   *
   *  Заполняет демон и только по данным приложения: расширение заходит не
   *  везде, и его «не встретился» не означает «его там нет». У профилей без
   *  подключения поля нет вовсе — это честнее пустого списка, который читался
   *  бы как «проверено, больше нигде». */
  also_on?: Array<{ profile: string; label?: string }>;
  error?: string;
}
export interface SnapshotPage {
  id: string;
  name: string;
  published?: boolean;
  /** username привязанного IG; отсутствует — IG-объявление с этой ФП не соберётся. */
  instagram?: string;
  instagram_id?: string;
}
export interface SnapshotBusiness { id: string; name?: string; verification?: string }
export interface SnapshotProfile {
  /** Имя профиля в антике, без команды («17/7 spx»). */
  label?: string;
  /** Команда профиля («keine» / «rodion»); пусто — панель покажет «?». */
  team?: string;
  accounts?: SnapshotAccount[];
  billing_issues?: string[];
  pages?: SnapshotPage[];
  businesses?: SnapshotBusiness[];
  notes?: string[];
  /** Когда данные ЭТОГО соца собрались в последний раз. Своё на профиль, а не
   *  одно на снапшот: соцы падают поодиночке, и общая метка не может быть
   *  правдой сразу про собравшийся и про несобравшийся. */
  collected_at?: string;
  /** Чем кончилась последняя попытка собрать этот соц. Пусто — успехом.
   *  Заполнено — кабинеты ниже от прошлого обхода (см. `collected_at`). */
  collect_error?: string;
}
export interface Snapshot {
  source?: string;
  provider?: string;
  snapshot_revision?: string;
  run_id?: string;
  started_at?: string;
  completed_at?: string;
  generated_at?: string;
  errors?: Record<string, string>;
  profiles?: Record<string, SnapshotProfile>;
}

/* ── ОТКУДА ПАНЕЛЬ БЕРЁТ ПРОФИЛИ И КАБИНЕТЫ ──────────────────────────────── */

/** Источник данных о профилях и их кабинетах.
 *
 *  • `server` — как было и как останется по умолчанию: `/accounts` + `/socials`,
 *    охват считается по OAuth (`cloud-filter.правилоОхвата`).
 *  • `snapshot` — только уже загруженный в стор снапшот арендатора
 *    (`snapshot.profiles`), БЕЗ обращения к OAuth. Оперативный запасной ход на
 *    время, пока подключение профилей ненадёжно: профиль, у которого сервер не
 *    может подтвердить токен, всё равно виден и выбираем.
 *
 *  Переключатель обратим в обе стороны мгновенно и ничего не мигрирует: это
 *  ВЫБОР ИСТОЧНИКА, а не переезд. Серверный путь не трогается вовсе. */
export type DataSource = "server" | "snapshot";

/** Подписи переключателя — ОДНО место на оболочку и на тесты. Второй экземпляр
 *  списка разъехался бы с первым молча (правило CLAUDE.md про договорённость
 *  двух мест). */
export const DATA_SOURCE_OPTIONS: Array<{ value: DataSource; label: string }> = [
  { value: "server", label: "Server/OAuth" },
  { value: "snapshot", label: "Snapshot" },
];

/** Context needed by pure build/validate functions (formerly module globals). */
export interface BuildCtx {
  tags: Record<string, TagDef>;
  /** Привязка «соц → тег агентства». Из неё берётся тег, когда связка стоит на
   *  автоматическом теге. Необязательна: без неё тег угадывается по имени соца. */
  bind?: Record<string, string>;
  profiles: Profile[];
  catalogAll: Record<string, Account[]>;
  lichka: Record<string, number>;
  snapshot: Snapshot | null;
}

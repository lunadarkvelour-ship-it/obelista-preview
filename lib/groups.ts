/* Группы кабинетов со своей связкой + сборка бандла на заливку.
 *
 *  Почему бандл режется по (группа × соц), а не по группе: `spec.accounts`
 *  движок резолвит ВНУТРИ профиля (`core/uploader.py: resolve_profile`) и на
 *  чужих кабах отвечает «Кабинеты не найдены на профиле». Группа, собранная с
 *  четырёх соцев, обязана разъехаться на четыре спеки — иначе три из них
 *  упадут целиком.
 */

import { resolveState } from "./form";
import { buildSpec, buildTextBody, snapshotStamp } from "./build-spec";
import { DEFAULT_FORM, START_FORM, DEF_BIND } from "./seed";
import { mergePreset } from "./form";
import { hasCreoName } from "./naming-guard";
import { statusLabel } from "./account-status";
import type {
  BuildCtx, BundleItem, CabGroup, Form, GroupMember, Snapshot, SnapshotAccount, SnapshotPixel, Spec,
} from "./types";

/** Стартовая форма новой группы — та же, с которой открывается панель.
 *
 *  Тег стоит на «по соцу»: группы собираются из кабов разных агентств, и
 *  единственный тег на всю группу для них заведомо неверен. Не нашёлся тег —
 *  префикса просто не будет, то есть хуже, чем без авто, не станет. */
export function blankForm(): Form {
  return { ...mergePreset(DEFAULT_FORM, START_FORM, DEF_BIND), tag: TAG_BY_SOC };
}

export function newGroup(id: string, name: string, members: GroupMember[] = []): CabGroup {
  return { id, name, members, form: blankForm() };
}

export interface SnapshotIdentity {
  source: string;
  provider: string;
  revision: string;
  generatedAt?: string;
}

export function snapshotIdentity(snap: Snapshot | null | undefined): SnapshotIdentity | null {
  const provider = String(snap?.provider || "").trim().toLowerCase();
  const revision = String(snap?.snapshot_revision || "").trim();
  if (!provider || !revision) return null;
  return {
    source: String(snap?.source || ""),
    provider,
    revision,
    generatedAt: snap?.generated_at,
  };
}

/** Create the only kind of member Snapshot mode is allowed to persist. */
export function snapshotMember(profile: string, act: string, snap: Snapshot): GroupMember {
  const id = snapshotIdentity(snap);
  return {
    profile,
    act,
    source: "snapshot",
    provider: id?.provider,
    provider_profile_id: profile,
    snapshot_revision: id?.revision,
    snapshot_generated_at: id?.generatedAt,
  };
}

export type MemberResolution =
  | { status: "exact"; account: SnapshotAccount }
  | { status: "snapshot_identity_missing" }
  | { status: "provider_mismatch"; expected: string; actual: string }
  | { status: "profile_mismatch"; expected: string; actual: string }
  | { status: "profile_missing" }
  | { status: "account_missing" };

/** Кабинет члена группы в ТЕКУЩЕМ снапшоте — без подмены одного парка другим.
 *
 *  ПРОВАЙДЕР И СОЦ СВЯЗЫВАЮТ, РЕВИЗИЯ — НЕТ, и это разбор дефекта, а не
 *  послабление. Раньше свежая ревизия того же провайдера считалась
 *  несовпадением и группа падала закрыто. Но ревизия меняется при КАЖДОЙ
 *  пересборке снапшота — то есть после любого `refresh_snapshot` каждая уже
 *  собранная группа переставала резолвиться разом, и человек видел это так:
 *  пиксели пропали со всех строк («no pixels for this ad account in the
 *  snapshot»), кабинеты «нет в снапшоте», кнопка сборки промпта мертва
 *  навсегда. Починить было нечем — только собрать группы заново, до следующего
 *  скана.
 *
 *  Что охраняется по-прежнему: чужой ПРОВАЙДЕР (адспауэровский член не
 *  прилипает к шардовому парку), чужой СОЦ (`provider_profile_id`), пропавший
 *  соц и пропавший кабинет. Именно они означают «это другой граф»; новая
 *  ревизия того же провайдера означает «тот же парк, пересчитанный сегодня».
 *
 *  Ревизия при этом не забывается: `setSnapshot` (lib/store) перештамповывает
 *  членов группы на текущую — иначе JSON бандла обещал бы ревизию, которой
 *  больше нет. */
export function resolveSnapshotMember(
  m: GroupMember,
  snap: Snapshot | null | undefined,
): MemberResolution {
  const id = snapshotIdentity(snap);
  if (m.source === "snapshot") {
    if (!id || !m.provider) return { status: "snapshot_identity_missing" };
    if (m.provider.toLowerCase() !== id.provider) {
      return { status: "provider_mismatch", expected: m.provider, actual: id.provider };
    }
    if ((m.provider_profile_id || m.profile) !== m.profile) {
      return {
        status: "profile_mismatch",
        expected: m.provider_profile_id || m.profile,
        actual: m.profile,
      };
    }
    const profile = snap?.profiles?.[m.profile];
    if (!profile) return { status: "profile_missing" };
    const account = profile.accounts?.find((a) => a.id === m.act);
    return account ? { status: "exact", account } : { status: "account_missing" };
  }
  /* Server/legacy groups predate provider-bound membership. Preserve their
     historical account-status lookup across profiles; only Snapshot members
     are allowed to claim the exact provider/profile contract above. */
  const account = Object.values(snap?.profiles || {})
    .flatMap((profile) => profile.accounts || [])
    .find((candidate) => candidate.id === m.act);
  return account ? { status: "exact", account } : { status: "account_missing" };
}

function resolutionMessage(m: GroupMember, r: MemberResolution): string | null {
  switch (r.status) {
    case "exact": return null;
    case "snapshot_identity_missing": return `snapshot identity missing for ${m.profile}/${m.act}`;
    case "provider_mismatch":
      return `snapshot provider mismatch for ${m.act}: group ${r.expected}, current ${r.actual}`;
    case "profile_mismatch":
      return `snapshot profile mismatch for ${m.act}: group ${r.expected}, selected ${r.actual}`;
    case "profile_missing": return `snapshot profile missing: ${m.profile}`;
    case "account_missing": return `ad account missing from snapshot revision: ${m.act}`;
  }
}

export function membershipIssues(g: CabGroup, snap: Snapshot | null): string[] {
  const snapshotMembers = g.members.filter((m) => m.source === "snapshot");
  if (!snapshotMembers.length) return [];
  if (snapshotMembers.length && snapshotMembers.length !== g.members.length) {
    return ["mixed snapshot and Server/OAuth membership"];
  }
  return [...new Set(g.members
    .map((m) => resolutionMessage(m, resolveSnapshotMember(m, snap)))
    .filter((x): x is string => !!x))];
}

/** Соцы группы в порядке первого появления — он же порядок связок в бандле. */
export function groupProfiles(g: CabGroup): string[] {
  const out: string[] = [];
  for (const m of g.members) if (!out.includes(m.profile)) out.push(m.profile);
  return out;
}

export function membersOfProfile(g: CabGroup, profile: string): string[] {
  return g.members.filter((m) => m.profile === profile).map((m) => m.act);
}

/** Сколько объектов создастся на одном кабе: кампании + адсеты + объявления. */
export function objectsPerCab(f: Form): number {
  const nCamp = Number(f.nCamp) || 1;
  const nAdset = Number(f.nAdset) || 1;
  const nAd = Number(f.nAd) || 1;
  return nCamp * (1 + nAdset + nAdset * nAd);
}

export function objectsOfGroup(g: CabGroup): number {
  return objectsPerCab(g.form) * g.members.length;
}

/** Как кабинеты группы выглядят по данным снапшота.
 *
 *  Четыре корзины, и смешивать их нельзя — у каждой свой смысл:
 *   • `dead`    — Мета выключила навсегда. Разбана не бывает (владелец 13.08),
 *                 значит залив держим;
 *   • `review`  — Мета смотрит сама. Исход неизвестен, залив НЕ держим, но
 *                 молчать нельзя;
 *   • `unclear` — каб ЕСТЬ в снапшоте, но статус не опознан (Мета заводит
 *                 значения без предупреждения — снапшот в этом случае пишет
 *                 буквально `"UNKNOWN"`, `scripts/make_ui_snapshot.py:106`).
 *                 Залив НЕ держим — блокировать по незнанию хуже, чем пропустить
 *                 один осечный каб, — но и молчать нельзя;
 *   • `missing` — каба НЕТ в снапшоте вовсе. Это НЕ «мёртв»: снапшот бывает
 *                 позавчерашним, и блокировать из-за нехватки данных значит
 *                 останавливать работу там, где ничего не сломано.
 *  Пустота на месте `unclear`/`missing` читается как «проверено, чисто», а это
 *  неправда — обе корзины обязаны быть видны, хоть и не блокируют.
 *
 *  `unclear` и `missing` — РАЗНЫЕ «мы не знаем»: у первого каб виден, под
 *  вопросом только статус; у второго не видно самого каба. Раньше оба смысла
 *  жили в одном поле `unknown`, а развилка ниже была цепочкой if/else по
 *  `isDeadStatus`/`isReviewStatus` без финального else — статус-литерал
 *  `"UNKNOWN"` не совпадал ни с одной веткой и такой каб не попадал НИКУДА,
 *  молча проходя как обычный. Отсюда правило: развилка одна и исчерпывающая.
 *
 *  Статус берётся у самого свежего владельца каба — этим уже занимается
 *  `accountRows`, свою логику не заводим. */
export interface MembersByStatus {
  dead: string[];
  review: string[];
  unclear: string[];
  missing: string[];
}

export function membersByStatus(g: CabGroup, snap: Snapshot | null): MembersByStatus {
  const out: MembersByStatus = { dead: [], review: [], unclear: [], missing: [] };
  if (!snap) return out;
  const seen = new Set<string>();
  for (const m of g.members) {
    if (seen.has(m.act)) continue;
    seen.add(m.act);
    const resolved = resolveSnapshotMember(m, snap);
    if (resolved.status !== "exact") {
      out.missing.push(m.act);
      continue;
    }
    const acc = resolved.account;
    /* ЕДИНСТВЕННАЯ развилка — по statusLabel(), не по отдельным предикатам.
       Раньше здесь стоял if/else по isDeadStatus/isReviewStatus без финальной
       ветки, и статус-литерал "UNKNOWN" не совпадал ни с одной из них — каб
       проходил мимо всех корзин молча. `default` с приведением к `never`
       превращает будущую забытую ветку в ошибку компилятора: новый label в
       account-status.ts, для которого здесь не завели case, роняет
       `tsc --noEmit`, а не тонет в тишине рантайма. */
    const label = statusLabel(acc.status);
    switch (label) {
      case "disabled":
        out.dead.push(m.act);
        break;
      case "review":
        out.review.push(m.act);
        break;
      case "unknown":
        out.unclear.push(m.act);
        break;
      case "active":
      case "billing":
        // Норма и «лечится оплатой» — группу не задерживают. У биллинга уже
        // есть свой отдельный лист, дублировать его здесь незачем.
        break;
      default: {
        const exhaustive: never = label;
        throw new Error(`membersByStatus: неизвестный statusLabel ${exhaustive}`);
      }
    }
  }
  return out;
}

const few = (ids: string[]) =>
  ids.length <= 3 ? ids.join(", ") : `${ids.slice(0, 3).join(", ")}, +${ids.length - 3}`;

/** Чего не хватает группе до заливки.
 *
 *  Ровно те проверки, без которых движок гарантированно откажет или зальёт
 *  мусор. Мягкие замечания (крео меньше, чем адсетов) сюда не попадают — они
 *  живут в предупреждениях превью.
 *
 *  `snap` ОБЯЗАТЕЛЕН, хотя технически мог быть необязательным. Нарочно:
 *  прошлая версия этой проверки жила в `validate.ts`, который живой путь не
 *  зовёт, и не срабатывала ни разу. Необязательный параметр повторил бы ту же
 *  историю — точка вызова забыла бы его передать, и проверка тихо
 *  выключилась бы. Пусть требует компилятор. `null` передаётся ЯВНО и значит
 *  «снапшота нет», а не «проверять не надо». */
export function missingOf(g: CabGroup, snap: Snapshot | null): string[] {
  const f = g.form;
  const out: string[] = [];
  /* Слова причин — те же, что ждёт `isMissingSection` в UploadView.tsx: она
     сопоставляет причину с секцией по строке и принимает оба написания. */
  if (!g.members.length) out.push("ad accounts");
  if (!f.videoLines.split("\n").some((x) => x.trim())) out.push("creatives");
  if (!f.geo.split(",").some((x) => x.trim())) out.push("geo");
  if (!(Number(f.daily) > 0)) out.push("budget");
  if (f.convLoc === "WEBSITE" && !f.link.trim()) out.push("link");
  out.push(...membershipIssues(g, snap));
  /* Имя крео в шаблоне объявления проверяется ЗДЕСЬ, а не в мягких замечаниях
     превью. Проверка стояла в validate.ts, но живой путь
     (accounts → upload → preview) идёт через buildBundle и validate() не зовёт
     вовсе: предупреждение существовало и не показывалось никому.

     И это ровно тот класс, ради которого missingOf заведён — «движок зальёт
     мусор». Залив пройдёт, но расход этих объявлений навсегда осядет в
     «не опознан»: атрибуция режет имя по `--` и берёт последний кусок
     (core/attrib.py:241-244), а там будет случайный RAND5. Имя уже уйдёт в
     Мету, переименовывать станет нечего. */
  if (!hasCreoName(f.nmAd)) out.push("[CREO_NAME] at the end of the ad name");

  /* Мёртвый каб ДЕРЖИТ связку. Это не предупреждение: прошлая версия рисовала
     красную подпись, а `buildBundle` про неё не спрашивал — и спека с
     забаненным кабом уезжала в FB, где её ловил только канареечный каб уже
     после старта джобы. */
  const st = membersByStatus(g, snap);
  if (st.dead.length) out.push(`disabled ad accounts: ${few(st.dead)}`);
  return out;
}

export function groupReady(g: CabGroup, snap: Snapshot | null): boolean {
  return missingOf(g, snap).length === 0;
}

/** Пиксель, с которым поедет конкретный кабинет.
 *
 *  Источник ровно один — выбор на самом кабинете. Общего пикселя у группы нет
 *  намеренно: он был вторым местом, где то же самое значение задаётся, и на
 *  шаге «Цель» показывал пиксели ЧУЖОГО профиля (список берётся из глобальной
 *  формы, а группа живёт на своих соцах). Пусто — `auto`: движок возьмёт первый
 *  пиксель этого кабинета. */
export function pixelOf(m: GroupMember): string {
  return (m.pixel || "").trim() || "auto";
}

/** Пиксели, которые есть у КАЖДОГО кабинета группы.
 *
 *  Ровно то, что можно назначить всей группе разом, не соврав: пиксель, которого
 *  на кабинете нет, FB не примет. Кабинет, чьих пикселей снапшот не знает, честно
 *  обнуляет пересечение — общего мы не обещаем, раз проверить не можем. */
export function commonPixels(g: CabGroup, snapshot: Snapshot | null): SnapshotPixel[] {
  if (!g.members.length) return [];
  const listOf = (m: GroupMember) => {
    const r = resolveSnapshotMember(m, snapshot);
    return r.status === "exact" ? r.account.pixels || [] : [];
  };
  const rest = g.members.slice(1).map((m) => new Set(listOf(m).map((p) => p.id)));
  return listOf(g.members[0]).filter((p) => rest.every((s) => s.has(p.id)));
}

/** Общий пиксель формы → на кабинеты, а в форме `auto`.
 *
 *  Нужна там, где связка приезжает целиком со стороны (пресет, копия другой
 *  группы, старый localStorage): в таких формах пиксель ещё бывает задан, а
 *  показать его больше негде. Молча уронить значение нельзя, держать невидимым
 *  — тем более, поэтому переносим на кабинеты, где оно и видно. Свой выбор
 *  кабинета сильнее: его не перетираем. */
export function distributePixel(g: CabGroup): CabGroup {
  const px = (g.form.pixel || "").trim();
  if (!px || px === "auto") return g;
  return {
    ...g,
    members: g.members.map((m) => (m.pixel ? m : { ...m, pixel: px })),
    form: { ...g.form, pixel: "auto" },
  };
}

/** Ссылка и хвост конкретного кабинета: свои, иначе связки.
 *
 *  Здесь фолбэк на форму ЕСТЬ, в отличие от пикселя, и это не непоследовательность.
 *  Пиксель у каждого каба свой всегда — общего значения просто не существует.
 *  Ссылка и хвост наоборот: у всей группы обычно один лендинг, а свой нужен
 *  ровно тем кабам, что приехали от другого агентства вместе со своим пикселем.
 *  Поэтому их место — шаги «Page и оффер» и «Креативы», а на кабинете лежит
 *  переопределение, и пустое поле честно показывает унаследованное значение. */
export function linkOf(g: CabGroup, m: GroupMember): string {
  return (m.link || "").trim() || g.form.link;
}
export function tailOf(g: CabGroup, m: GroupMember): string {
  return (m.tail || "").trim() || g.form.creoUrl;
}

/** Чем один кабинет группы отличается от другого — он же ключ разреза бандла. */
export interface MemberSplit {
  pixel: string;
  page: string;
  link: string;
  tail: string;
}

export function splitOf(g: CabGroup, m: GroupMember): MemberSplit {
  return {
    pixel: pixelOf(m),
    page: g.pageByProfile?.[m.profile] || g.form.page,
    link: linkOf(g, m),
    tail: tailOf(g, m),
  };
}

/** Тег агентства «по соцу»: значение поля `tag`, которое разрешается на каждом
 *  соце отдельно. Не имя тега — под ним не может оказаться настоящий тег. */
export const TAG_BY_SOC = "__soc__";

/** Тег агентства для конкретного соца.
 *
 *  Сначала явная привязка соц → тег. Её пока задавать негде, поэтому есть
 *  второй заход: имя соца в антике содержит агентство («1/8 MediaBuyer3 hiuhiu»
 *  → тег `hiu`). Совпадение подлиннее сильнее короткого, чтобы `spx2` не
 *  проигрывал `spx`. Не нашли — пустой тег, префикса не будет: выдумывать
 *  агентство нельзя, нейминг по нему потом ищет статистику. */
export function tagForProfile(profile: string, ctx: BuildCtx): string {
  const bound = ctx.bind?.[profile];
  if (bound && ctx.tags[bound]) return bound;
  const p = ctx.profiles.find((x) => x.id === profile);
  const hay = `${p?.label || ""} ${p?.team || ""}`.toLowerCase();
  if (!hay.trim()) return "";
  let best = "";
  for (const key of Object.keys(ctx.tags)) {
    const k = key.toLowerCase();
    if (k && hay.includes(k) && k.length > best.length) best = key;
  }
  return best;
}

export function resolveTag(form: Form, profile: string, ctx: BuildCtx): string {
  return form.tag === TAG_BY_SOC ? tagForProfile(profile, ctx) : form.tag;
}

/** Нормализованное состояние одной связки. Общая точка для спеки и для текста:
 *  иначе описание и JSON разъезжаются, а верят обычно описанию. */
export function stateOf(
  g: CabGroup, profile: string, accounts: string[], ov: MemberSplit, ctx: BuildCtx
) {
  return resolveState(
    {
      ...g.form,
      profile,
      acctMode: "pick",
      pixel: ov.pixel,
      page: ov.page,
      link: ov.link,
      creoUrl: ov.tail,
      tag: resolveTag(g.form, profile, ctx),
    },
    accounts,
    []
  );
}

/** Спека одной связки: группа × соц × (пиксель, ссылка, хвост). */
export function specOf(
  g: CabGroup, profile: string, accounts: string[], ov: MemberSplit, ctx: BuildCtx
): Spec {
  return buildSpec(stateOf(g, profile, accounts, ov, ctx), null, ctx);
}

/** Весь залив: по записи на (группа × соц × пиксель × ссылка × хвост).
 *
 *  Почему разрез ещё и по пикселю. Движок резолвит пиксель на каждый кабинет
 *  (`core/uploader.py`), но берёт для этого ОДНО значение из спеки: `auto` даёт
 *  каждому кабу его собственный первый пиксель, а явный id ставит один и тот же
 *  всем. Кабинеты в группе бывают от разных агентств, и пиксель у них разный —
 *  значит кабинеты с разным выбором обязаны разъехаться по разным спекам.
 *  Форма группы в этом не участвует: `spec.pixel` всегда приходит сюда с
 *  кабинета (см. `pixelOf`), поле `form.pixel` для группы мертво.
 *
 *  Ссылка и хвост режут по той же причине: `spec.link` и `url_params` в спеке
 *  тоже одни на всех. А меняются они вместе с пикселем — чужое агентство значит
 *  и чужой лендинг, и чужие метки.
 *
 *  Кабы, у которых все три совпали, едут вместе: лишних спек не плодим.
 */
export function buildBundle(groups: CabGroup[], ctx: BuildCtx): BundleItem[] {
  if (groups.some((g) => membershipIssues(g, ctx.snapshot ?? null).length)) return [];
  const out: BundleItem[] = [];
  for (const g of groups) {
    if (!g.members.length) continue;
    /* Второй рубеж. Гейт выше уже не даёт нажать кнопку, но спека собирается и
       другими путями (сохранённый пресет, импорт), а мёртвый каб не должен
       уехать в Мету НИ ОДНИМ из них. Фильтруем здесь, а не полагаемся на то,
       что выше кто-то проверил. */
    const dead = new Set(membersByStatus(g, ctx.snapshot ?? null).dead);
    for (const profile of groupProfiles(g)) {
      const mine = g.members.filter((m) => m.profile === profile && !dead.has(m.act));
      if (!mine.length) continue;
      // Порядок — порядок первого появления: он же порядок связок в промпте, и
      // он должен быть устойчивым между пересборками.
      const bySplit = new Map<string, { ov: MemberSplit; accounts: string[]; member: GroupMember }>();
      for (const m of mine) {
        const ov = splitOf(g, m);
        const k = JSON.stringify([ov.pixel, ov.page, ov.link, ov.tail]);
        const cur = bySplit.get(k);
        if (cur) cur.accounts.push(m.act);
        else bySplit.set(k, { ov, accounts: [m.act], member: m });
      }
      for (const { ov, accounts, member } of bySplit.values()) {
        out.push({
          group: g.name,
          groupId: g.id,
          profile,
          source: member.source,
          provider: member.provider,
          provider_profile_id: member.provider_profile_id || member.profile,
          snapshot_revision: member.snapshot_revision,
          snapshot_generated_at: member.snapshot_generated_at,
          accounts,
          pixel: ov.pixel,
          page: ov.page,
          link: ov.link,
          tail: ov.tail,
          spec: specOf(g, profile, accounts, ov, ctx),
        });
      }
    }
  }
  return out;
}

/** Чем связка отличается от соседних по той же паре (группа, соц).
 *
 *  Пустая строка, когда на этой паре связка одна: тогда отличать не от чего, и
 *  подпись была бы шумом. Когда их несколько — а это ровно случай кабов разных
 *  агентств в одной группе, — две одинаковые шапки подряд читаются как дубль,
 *  и надо показать ИМЕННО то, что разъехалось. */
export function bundleDiffs(items: BundleItem[]): string[] {
  const key = (i: BundleItem) => i.group + "|" + i.profile;
  const n = new Map<string, number>();
  for (const i of items) n.set(key(i), (n.get(key(i)) || 0) + 1);
  return items.map((i) => {
    if ((n.get(key(i)) || 0) < 2) return "";
    const parts: string[] = [];
    if (i.pixel && i.pixel !== "auto") parts.push(`pixel ${i.pixel}`);
    if (i.link) parts.push(i.link);
    if (i.tail) parts.push(`URL params ${i.tail}`);
    return parts.join(" · ");
  });
}

/** JSON бандла — то, что уедет в чат и что потом съест `execute_bundle`.
 *
 *  Версия проставлена сразу: когда тул появится, он должен уметь отличить свой
 *  формат от чужого текста, а не угадывать по форме объекта. */
export function bundleJson(items: BundleItem[], stamp: string): Spec {
  const exact = items.filter((i) => i.source === "snapshot");
  const identities = new Set(exact.map((i) => `${i.provider || ""}:${i.snapshot_revision || ""}`));
  const provenance = exact.length === items.length && identities.size === 1 && exact.length
    ? {
        source: "local_antidetect_scan",
        provider: exact[0].provider,
        snapshot_revision: exact[0].snapshot_revision,
        generated_at: exact[0].snapshot_generated_at || stamp || "",
      }
    : undefined;
  return {
    version: 1,
    generated_at: stamp || "",
    ...(provenance ? { snapshot: provenance } : {}),
    sequential: true,
    bundles: items.map((i) => ({
      group: i.group,
      profile: i.profile,
      ...(i.source === "snapshot" ? {
        source: i.source,
        provider: i.provider,
        provider_profile_id: i.provider_profile_id,
        snapshot_revision: i.snapshot_revision,
      } : {}),
      accounts: i.accounts,
      pixel: i.pixel,
      spec: i.spec,
    })),
  };
}

/** Сколько объектов реально уедет — по items (buildBundle уже выбросил
 *  мёртвые кабы), не по всему составу группы: `objectsOfGroup(g)` о фильтре
 *  не знает вовсе, это чистая арифметика формы без снапшота. Без пересчёта
 *  число объектов обещает кабы, которых в спеке уже нет.
 *
 *  Общая для `bundleText` (шапка промпта) и превью (шапка экрана) намеренно:
 *  разошедшийся дубль этой формулы уже стоил бага — см. историю ниже.
 *
 *  Ключ — `groupId`, не `group` (имя): две группы с одним именем схлопнули бы
 *  свой счёт в одну запись, и каждая умножила бы свою форму на общую сумму —
 *  воспроизведено на двух группах «Same» по одному кабу: было 12 объектов на
 *  1-1-1 вместо честных 6. */
export function survivedObjects(items: BundleItem[], groups: CabGroup[]): number {
  const survivedByGroup = new Map<string, number>();
  for (const it of items) {
    survivedByGroup.set(it.groupId, (survivedByGroup.get(it.groupId) || 0) + it.accounts.length);
  }
  return groups.reduce((n, g) => n + objectsPerCab(g.form) * (survivedByGroup.get(g.id) || 0), 0);
}

/** Один промпт на весь залив.
 *
 *  Четыре вещи, ради которых он собран именно так:
 *   1. Человеческое описание КАЖДОЙ связки — чтобы оператор глазами увидел, что
 *      уезжает, до того как модель что-то создаст.
 *   2. Готовый JSON целиком и прямой запрет пересобирать — иначе модель читает
 *      описание как ТЗ и лепит свою спеку.
 *   3. Протокол вызовов по шагам. Раньше его не было вовсе: промпт говорил
 *      «отдавай в plan_upload», а `execute_upload` не называл ни разу — при том
 *      что тул без `confirmed_by_user=true` отказывается работать, и модели
 *      приходилось догадываться. Догадка на десяти кабах стоит дорого.
 *   4. Что делать с ошибкой плана: НЕ чинить спеку. Модели уже сказано «не
 *      пересобирай», и без явного «остановись» она разрешает это противоречие
 *      в свою пользу — правит спеку и льёт не то.
 */
export function bundleText(groups: CabGroup[], ctx: BuildCtx): string {
  const items = buildBundle(groups, ctx);
  if (!items.length) return "";

  const cabs = items.reduce((n, i) => n + i.accounts.length, 0);
  const profiles = new Set(items.map((i) => i.profile)).size;
  const objects = survivedObjects(items, groups);
  const stamp = snapshotStamp(ctx);
  // Файловые крео грузятся ВНУТРИ залива, по одному на каб. На десятке кабов
  // это десятки минут в одном заливе, и ровно поэтому у движка есть отдельная
  // фоновая заливка медиа с дедупом.
  const files = groups.some((g) => g.form.creoSrc === "file" && g.members.length);

  const L: string[] = [];
  /* Первой строкой и в каждом промпте: правила поведения в чате залива живут в
     скилле `obelista`, а не здесь. В промпте им не место — они длиннее самой
     спеки, их читает баер при каждом заливе, и меняются они чаще панели.
     Без этой строки модель ведёт себя по привычке: отчитывается о каждом
     вызове, объясняет очевидное и спрашивает апрув там, где спека уже
     проверена движком. */
  L.push("Use the obelista skill.");
  L.push("");
  L.push(
    `Залив: ${groups.length} ${plural(groups.length, "группа", "группы", "групп")}, ` +
      `${cabs} ${plural(cabs, "кабинет", "кабинета", "кабинетов")} на ${profiles} ` +
      `${plural(profiles, "соце", "соцах", "соцах")}, ${objects} ` +
      `${plural(objects, "объект", "объекта", "объектов")}. ` +
      `Связок ${items.length}.`
  );
  L.push("");
  L.push("ПРОТОКОЛ — выполняй по шагам, для каждой связки по очереди:");
  /* Нулевой шаг — инвариант, который дороже всего стоит при нарушении.
     Спеку иногда собирает не панель, а модель, и тогда крео уезжают хешами,
     а нейминг без [CREO_NAME]. Расход таких объявлений навсегда оседает в
     «не опознан»: имя уже в Мете, переименовывать нечего. 08.08 так ушло
     14 объявлений и $193. */
  L.push("0. Проверь у каждой связки: naming.ad кончается на \"--[CREO_NAME]\", и");
  L.push("   крео заданы ИМЕНАМИ (file / video_name_contains), а не image_hash / video_id.");
  L.push("   Не так — ОСТАНОВИСЬ и скажи юзеру: чинить надо в панели. Не правь сам.");
  L.push("1. plan_upload(spec) — spec бери ЦЕЛИКОМ из bundles[i].spec ниже, как есть.");
  L.push("2. Покажи план юзеру. Если plan_upload вернул ошибки — выведи их дословно и");
  L.push("   ОСТАНОВИСЬ и скажи баеру, что именно не так: правит он в панели, не ты.");
  L.push("3. Сразу execute_upload(spec, confirmed_by_user=true), спека ТА ЖЕ — апрув");
  L.push("   не спрашивай. Первый каб идёт канарейкой: создал ноль объектов — залив");
  L.push("   встаёт сам, остальные кабы не тронуты.");
  L.push("4. job_status(job_id) через ~60 секунд, дальше раз в минуту. Никаких таймеров.");
  L.push("5. Следующая связка — только после финала предыдущей: они делят один браузер");
  L.push("   профиля, параллельно нельзя.");
  if (files) {
    L.push(
      "Крео берутся файлами из папки ЗАЛИВЫ: сначала прогони upload_media на эти кабы " +
        "(фоновая задача, дедуп) — иначе файлы будут грузиться внутри залива по одному."
    );
  }

  const diffs = bundleDiffs(items);
  items.forEach((it, i) => {
    // По groupId, не по имени — та же причина, что у survivedByGroup выше:
    // тёзка по имени дала бы форму ЧУЖОЙ группы (таргетинг, бюджет,
    // структура) для этой связки, и текст описал бы не ту связку, что уедет.
    const g = groups.find((x) => x.id === it.groupId)!;
    const state = stateOf(g, it.profile, it.accounts, it, ctx);
    L.push("");
    L.push(
      `━━━ СВЯЗКА ${i + 1}/${items.length} · группа «${it.group}» · соц ${it.profile}` +
        (diffs[i] ? ` · ${diffs[i]}` : "") +
        " ━━━"
    );
    L.push(buildTextBody(state, null, ctx));
  });

  L.push("");
  L.push("Спеки уже собраны — НЕ ПЕРЕСОБИРАЙ и не дополняй. Порядок связок — этот:");
  L.push("```json");
  L.push(JSON.stringify(bundleJson(items, stamp), null, 2));
  L.push("```");
  L.push(
    "catalog вызывать не нужно: кабы, пиксель и Page уже проставлены панелью" +
      (stamp ? ` (снапшот от ${stamp}).` : ".")
  );
  return L.join("\n");
}

/* Счётные подписи. Заведены здесь, а не по месту, потому что «21 объектов» и
   «2 групп не готовы» вылезали в трёх листах сразу: склонение — свойство языка,
   а не конкретного экрана.
   Интерфейс переведён на английский, поэтому подписи считают по-английски
   (`pluralEn`), а `plural` со славянскими правилами остался ради текста
   промпта: он уезжает в движок и переводу не подлежит. */
export const nCabs = (n: number) => `${n} ${pluralEn(n, "ad account")}`;
export const nObjects = (n: number) => `${n} ${pluralEn(n, "object")}`;
export const nGroups = (n: number) => `${n} ${pluralEn(n, "group")}`;
export const nSocials = (n: number) => `${n} ${pluralEn(n, "profile")}`;
export const nBundles = (n: number) => `${n} ${pluralEn(n, "bundle")}`;

export function pluralEn(n: number, one: string, many = one + "s"): string {
  return n === 1 ? one : many;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

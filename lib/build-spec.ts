// Pure spec/text builders — ported 1:1 from web/zaliv_builder.html (buildSpec/buildText/buildAll).
// Key insertion order is preserved so JSON.stringify output is byte-identical to the original.

import { splitPositions } from "./placements";
import { ensureCreoName } from "./naming-guard";
import type { Account, BuildCtx, Group, LiveGroup, ResolvedState, Spec } from "./types";

/** Версия ОС в том виде, в каком её принимает FB: с дробной частью.
 *
 *  `targeting.custom` уходит в Мету passthrough — валидатор движка его не
 *  смотрит вовсе, поэтому промах вылезет только отказом адсета. В живых заливах
 *  работала форма `iOS_ver_14.0_and_above`, а человек набирает «14». Дописываем
 *  «.0» сами: угадывать за FB нечего, а привести к заведомо рабочему виду можно. */
export function osVersion(raw: string): string {
  const v = String(raw || "").trim().replace(/[^\d.]/g, "");
  if (!v) return v;
  return v.includes(".") ? v : v + ".0";
}

export function parseIds(text: string, catalog: Account[]): string[] {
  const out: string[] = [];
  (text || "")
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .forEach((t) => {
      let id: string | null = null;
      if (/^act_\d+$/.test(t)) id = t;
      else if (/^\d{8,}$/.test(t)) id = "act_" + t;
      else {
        const m = catalog.find((c) => c.name.toLowerCase().includes(t.toLowerCase()));
        if (m) id = m.id;
      }
      if (id && !out.includes(id)) out.push(id);
    });
  return out;
}

export function cabName(id: string, catalogAll: Record<string, Account[]>): string {
  for (const p in catalogAll) {
    const c = (catalogAll[p] || []).find((x) => x.id === id);
    if (c) return c.name;
  }
  return id;
}

export function liveGroups(s: ResolvedState, ctx: BuildCtx): LiveGroup[] {
  const catalog = ctx.catalogAll[s.profile] || [];
  return s.groups
    .map((g: Group) => ({ ...g, ids: parseIds(g.cabs, catalog) }))
    .filter((g) => (g.cabs || "").trim() !== "" || g.ids.length > 0);
}

export function buildSpec(s: ResolvedState, g: LiveGroup | null, ctx: BuildCtx): Spec {
  const pfx = (ctx.tags[s.tag] || { prefix: "" }).prefix || "";
  const spec: Spec = { profiles: [s.profile] };
  if (g) spec.accounts = g.ids;
  else if (s.acctMode === "all_active") spec.accounts = "all_active";
  else if (s.acctMode === "pick") spec.accounts = s.picked;
  else spec.accounts = { exclude: s.picked };
  spec.structure = `1-${s.nAdset}-${s.nAd}`;
  if (s.nCamp > 1) spec.campaigns_per_account = s.nCamp;
  spec.objective = s.objective;
  spec.conversion = { location: s.convLoc };
  if (s.convLoc === "WEBSITE") {
    spec.conversion.pixel = g ? g.pixel || "auto" : s.pixel || "auto";
    if (s.event) spec.conversion.event = s.event;
    if (s.attribution) spec.attribution = s.attribution;
  }
  if (s.convLoc === "INSTANT_FORM" && s.formId) spec.conversion.form_id = s.formId;
  spec.budget = { level: s.budgetLevel, daily_usd: s.daily };
  if (s.bidStrategy !== "LOWEST_COST_WITHOUT_CAP") {
    spec.bidding = { strategy: s.bidStrategy };
    if (s.cap) spec.bidding.cap_usd = s.cap;
  }
  spec.targeting = { geo: s.geo, age: [s.ageMin, s.ageMax], gender: s.gender };
  if (s.advAud) spec.targeting.advantage_audience = true;
  const custom: Spec = {};
  if (s.device !== "all") custom.device_platforms = [s.device];
  if (s.userOs !== "all") {
    custom.user_os = [s.osVer ? `${s.userOs}_ver_${osVersion(s.osVer)}_and_above` : s.userOs];
  }
  if (Object.keys(custom).length) spec.targeting.custom = custom;
  if (s.plcMode === "auto") spec.placements = "auto";
  else {
    spec.placements = { platforms: s.plats };
    /* Позиции переводятся в имена КАЖДОЙ платформы: лента у FB `feed`, у IG
       `stream`; рилсы `facebook_reels` против `reels`. Раньше сюда уходил один
       и тот же список в обе платформы, и падали все адсеты до единого
       (28.07: 16 кабов / 48 отказов; 29.07: 10 кабов / 30 отказов, 0 объектов).
       Пишем только выбранным платформам и только то, что у них существует:
       пустой список честнее неверного имени — FB тогда отдаст весь инвентарь
       платформы, а не откажет в создании адсета. */
    if (s.positions.length) {
      const split = splitPositions(s.positions);
      const KEYS = [
        ["facebook", "facebook_positions"],
        ["instagram", "instagram_positions"],
        ["messenger", "messenger_positions"],
        ["audience_network", "audience_network_positions"],
      ] as const;
      for (const [plat, key] of KEYS) {
        if (s.plats.includes(plat) && split[plat].length) spec.placements[key] = split[plat];
      }
    }
  }
  if (s.page && s.page !== "auto") spec.page = s.page;
  if (s.link) spec.link = s.link;
  const tail = g ? g.tail || "" : s.creoUrl || "";
  spec.creatives = s.videos.map((v) => {
    const o: Spec = s.creoSrc === "file"
      ? { file: v, cta: s.creoCta }
      : { video_name_contains: v, cta: s.creoCta };
    if (s.creoPt) o.primary_text = s.creoPt;
    if (s.creoHl) o.headline = s.creoHl;
    if (tail) o.url_params = tail;
    return o;
  });
  if (s.creoSrc === "file" && s.staticAsVideo) spec.static_as_video = true;
  /* Имя крео дописывается ЗДЕСЬ — в единственном месте, через которое шаблон
     попадает в спеку.
     Проверок выше по течению уже три (дефолт формы, миграция сохранённого,
     нормализация импорта), и все они советуют, а не обязывают: `missingOf`
     кладёт «[CREO_NAME] в конце имени объявления» в список нехватки, превью
     красит группу красным — но `buildBundle` по `groupReady` не фильтрует, и
     кнопка «копировать» отдаёт промпт вместе с этой группой. Значит стереть
     макрос руками и всё равно залить по-прежнему можно.
     Здесь этот путь закрывается: что бы ни лежало в форме, в спеку уедет
     шаблон с именем крео в хвосте. */
  spec.naming = {
    campaign: pfx + s.nmCamp,
    adset: pfx + s.nmAdset,
    ad: ensureCreoName(pfx + s.nmAd),
  };
  spec.activate = s.activate;
  if (s.startTime) {
    const v = s.startTime.replace("T", " ").slice(0, 16);
    if (s.startLocal) spec.start_time_local = v;
    else spec.start_time = v.replace(" ", "T");
  }
  if (s.specialCat) spec.special_ad_categories = [s.specialCat];
  /* Указания — ОТДЕЛЬНЫМ ключом связки и последним по порядку.
     Отдельным: раньше проза ехала в `creatives[].file`, который движок обязан
     читать как имя файла, — спека наполовину состояла из записок и не могла
     пройти валидацию по определению. `notes` движок принимает, но не исполняет
     и не валидирует (`core/matrix.py`, блок «Указания оператора»).
     Последним: порядок остальных ключей от появления нового не поехал, и в
     диффе слепка видно ровно то, что добавилось. Пустое поле ключа не создаёт —
     старые связки байт в байт те же. */
  if (s.notes) spec.notes = s.notes;
  return spec;
}

const GOAL_TXT: Record<string, string> = {
  OUTCOME_SALES: "продажи", OUTCOME_LEADS: "лиды", OUTCOME_TRAFFIC: "трафик",
  OUTCOME_ENGAGEMENT: "вовлечение", OUTCOME_AWARENESS: "охват",
};
const LOCTXT: Record<string, string> = {
  WEBSITE: "на сайт", INSTANT_FORM: "через лид-форму", MESSENGER: "в Messenger",
  WHATSAPP: "в WhatsApp", INSTAGRAM_PROFILE: "на посещения профиля Instagram",
  POST_ENGAGEMENT: "на вовлечённость поста", REACH: "на охват", VIDEO_VIEWS: "на просмотры видео",
};
const ATTR_TXT: Record<string, string> = {
  "7d_click_1d_view": "7д клик/1д просмотр", "1d_click": "1д клик",
  "7d_click": "7д клик", "1d_click_1d_view": "1д клик/1д просмотр",
};
const GENDER_TXT: Record<string, string> = { all: "любой", male: "муж", female: "жен" };
const ACT_MAP: Record<string, string> = {
  nothing: "всё на паузе",
  campaigns: "включить ТОЛЬКО кампании (адсеты/объявы паузед — спенд не идёт)",
  "campaigns+adsets": "включить кампании и адсеты",
  everything: "включить ВСЁ (спенд сразу)",
};

/** Человеческое описание связки БЕЗ хвоста с JSON и без шапки «СВЯЗКА N/M».
 *
 *  Выделено из `buildText`, потому что бандл на несколько групп собирает свою
 *  шапку и один общий JSON в конце: вкладывать спеку в каждый блок значило бы
 *  повторить её дважды и дать модели повод пересобрать. */
export function buildTextBody(s: ResolvedState, g: LiveGroup | null, ctx: BuildCtx): string {
  const pfx = (ctx.tags[s.tag] || { prefix: "" }).prefix || "";
  const prof = ctx.profiles.find((p) => p.id === s.profile) || { label: s.profile, team: "?" };
  const nm = (id: string) => cabName(id, ctx.catalogAll);
  let acct: string;
  if (g) acct = "кабы: " + g.ids.map((id) => `${nm(id)} (${id})`).join(", ");
  else if (s.acctMode === "pick") acct = "кабы: " + s.picked.map((id) => `${nm(id)} (${id})`).join(", ");
  else if (s.acctMode === "exclude") acct = "все кабы КРОМЕ: " + s.picked.map((id) => `${nm(id)} (${id})`).join(", ");
  else acct = "все активные кабы";
  const L: string[] = [];
  // Команду печатаем, только если она есть. У профилей, подключённых через
  // приложение, поля команды нет, и строка вырождалась в «команда )».
  const who = [prof.label, prof.team ? `команда ${prof.team}` : ""].filter(Boolean).join(", ");
  L.push(`Залей связку на профиль ${s.profile} (${who}), ${acct}.`);
  L.push(
    `Структура: ${s.nCamp} кампани${s.nCamp > 1 ? "й" : "я"} × ${s.nAdset} адсет${s.nAdset > 1 ? "ов" : ""} × ${s.nAd} объявлени${s.nAd > 1 ? "й" : "е"} (1-${s.nAdset}-${s.nAd}).`
  );
  const goalTxt = GOAL_TXT[s.objective];
  const locTxt = LOCTXT[s.convLoc];
  let cel = `Цель: ${goalTxt} ${locTxt}`;
  const px = g ? g.pixel || "auto" : s.pixel || "auto";
  if (s.convLoc === "WEBSITE") {
    cel += `, пиксель ${px}${s.event ? `, событие ${s.event}` : ""}`;
    if (s.attribution) cel += `, атрибуция ${ATTR_TXT[s.attribution]}`;
  }
  if (s.convLoc === "INSTANT_FORM" && s.formId) cel += `, форма ${s.formId}`;
  L.push(cel + ".");
  if (s.specialCat) L.push(`Спец-категория: ${s.specialCat}.`);
  let bud = `Бюджет: $${s.daily}/день на ${s.budgetLevel === "adset" ? "адсет (ABO)" : "кампанию (CBO)"}`;
  if (s.bidStrategy !== "LOWEST_COST_WITHOUT_CAP") bud += `, ${s.bidStrategy}${s.cap ? ` кап $${s.cap}` : ""}`;
  L.push(bud + ".");
  let tg = `Таргет: гео ${s.geo.join("/") || "?"}, возраст ${s.ageMin}-${s.ageMax}, пол ${GENDER_TXT[s.gender]}`;
  if (s.device !== "all") tg += `, только ${s.device === "mobile" ? "мобайл" : "десктоп"}`;
  if (s.userOs !== "all") tg += `, ${s.userOs}${s.osVer ? ` ${s.osVer}+` : ""}`;
  if (s.advAud) tg += ", Advantage+ audience ВКЛ";
  L.push(tg + ".");
  if (s.plcMode === "auto") L.push("Плейсменты: Advantage+ (авто).");
  else
    L.push(
      `Плейсменты: ${s.plats.join("+") || "?"}${s.positions.length ? `, позиции ${s.positions.join("/")}` : ""}.`
    );
  if (s.page && s.page !== "auto") L.push(`Page: ${s.page}.`);
  if (s.link) L.push(`Ссылка: ${s.link}.`);
  if (s.videos.length) {
    let cr = s.creoSrc === "file"
      ? `Крео (файлы из папки ЗАЛИВЫ, ${s.videos.length} шт, ротация по адсетам): ${s.videos.join(", ")}. CTA ${s.creoCta}`
        + (s.staticAsVideo ? ". Статику обернуть в видео 9:16" : "")
      : `Крео (видео уже на кабе, ${s.videos.length} шт, ротация по адсетам): ${s.videos.join(", ")}. CTA ${s.creoCta}`;
    if (s.creoHl) cr += `, заголовок "${s.creoHl}"`;
    if (s.creoPt) cr += `, текст "${s.creoPt}"`;
    L.push(cr + ".");
  }
  const tail = g ? g.tail || "" : s.creoUrl || "";
  if (tail) L.push(`URL-хвост (для всех крео): ${tail}`);
  /* Нейминг печатаем ТЕМ ЖЕ значением, что уедет в спеку — уже после
     дописывания имени крео. Иначе текст обещал бы одно, а JSON нёс другое, и
     первым это заметил бы юзер в Мете. */
  const adTpl = ensureCreoName(pfx + s.nmAd);
  L.push(`Нейминг: кампания "${pfx + s.nmCamp}", адсет "${pfx + s.nmAdset}", объявления "${adTpl}".`);
  /* Правило сказано словами, а не подразумевается. Этот текст читает модель, и
     иногда она собирает спеку сама — а поля image_hash / video_id в схеме тула
     объявлены без единого слова описания, в отличие от file. Так и появились
     14 объявлений, которых аналитика не смогла связать ни с одним крео. */
  L.push(
    "  Имя объявления ОБЯЗАНО кончаться на [CREO_NAME]: аналитика берёт из него " +
      "последний кусок после «--» и по нему узнаёт крео. Крео задавай ИМЕНАМИ " +
      "(file / video_name_contains), не хешами и не id — у хеша имени нет, и " +
      "расход такого объявления навсегда осядет в «не опознан».",
  );
  if (s.startTime) {
    const v = s.startTime.replace("T", " ").slice(0, 16);
    L.push(
      s.startLocal
        ? `Старт адсетов: ${v} по таймзоне КАЖДОГО каба (движок подставит оффсет).`
        : `Старт адсетов по расписанию FB: ${v} (UTC — добавь оффсет если надо).`
    );
  }
  L.push(`После верификации: ${ACT_MAP[s.activate]}.`);
  /* Указания идут и словами, и ключом `notes` в JSON — дублирование намеренное:
     описание читает оператор глазами перед копированием, спеку читает модель.
     Последним блоком и с пометкой «контекст», потому что сразу за ним идёт
     запрет пересобирать спеку: записка не должна читаться как разрешение его
     нарушить. */
  if (s.notes) {
    L.push("Указания оператора (контекст; спеку по ним НЕ пересобирать):");
    L.push(...s.notes.split("\n").map((x) => "  " + x));
  }
  return L.join("\n");
}

/* Одна строка вместо свода правил.
 *
 * Правила поведения живут в скилле `obelista` — он ставится модели один раз и
 * действует у всех, кто его поставил. Держать их в промпте нельзя: они длиннее
 * самой спеки, их видит баер в каждом промпте, и меняются они чаще, чем
 * панель — правку пришлось бы катать сборкой ради текста, который в чат едет
 * копипастой. */
const BEHAVIOR: string[] = ["Use the obelista skill.", ""];

export function buildText(
  s: ResolvedState,
  g: LiveGroup | null,
  idx: number,
  total: number,
  ctx: BuildCtx
): string {
  const L: string[] = [];
  if (total > 1) L.push(`━━━ СВЯЗКА ${idx + 1}/${total} ━━━`);
  L.push(...BEHAVIOR);
  L.push(buildTextBody(s, g, ctx));
  L.push(...tailBlock(s, g, idx, total, ctx));
  return L.join("\n");
}

/** Дата снапшота в человеческом виде («2026-08-02 14:30»); пусто — снапшота нет. */
export function snapshotStamp(ctx: BuildCtx): string {
  const raw = ctx.snapshot?.generated_at;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 16).replace("T", " ");
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Хвост промпта — то, ради чего связка вообще копируется в чат.
 *
 * Три вещи, которых тут не хватало и из-за которых модель переспрашивала или
 * пересобирала спеку сама:
 *  1. Готовый JSON вкладывается ПРЯМО в текст + прямой запрет пересобирать —
 *     иначе модель принимала человеческое описание за ТЗ и лепила свою спеку.
 *  2. `catalog` вызывать не нужно: кабы/пиксель/Page уже проставлены панелью из
 *     снапшота. Дата снапшота — рядом, чтобы было видно, насколько он свежий.
 *  3. Несколько хвост-групп = несколько execute_upload, и гнать их надо
 *     ПОСЛЕДОВАТЕЛЬНО: параллельные джобы дерутся за один браузер профиля.
 */
export function tailBlock(
  s: ResolvedState,
  g: LiveGroup | null,
  idx: number,
  total: number,
  ctx: BuildCtx
): string[] {
  const spec = buildSpec(s, g, ctx);
  const stamp = snapshotStamp(ctx);
  const out: string[] = [
    "",
    "Спека уже собрана — НЕ ПЕРЕСОБИРАЙ СПЕКУ, отдай этот JSON в plan_upload как есть:",
    "```json",
    JSON.stringify(spec, null, 2),
    "```",
    "catalog вызывать не нужно: кабы, пиксель и Page уже проставлены панелью" +
      (stamp ? ` (снапшот от ${stamp}).` : "."),
  ];
  if (total > 1) {
    out.push(
      `Связок ${total} — execute_upload по ним запускать ПОСЛЕДОВАТЕЛЬНО, по одной: ` +
        `следующую только после того, как job_status предыдущей показал финал ` +
        `(параллельные джобы дерутся за один браузер профиля). Это связка ${idx + 1}/${total}.`
    );
  }
  return out;
}

export interface BuiltBundle {
  specs: Spec[];
  texts: string[];
  groups: LiveGroup[];
}

export function buildAll(s: ResolvedState, ctx: BuildCtx): BuiltBundle {
  const gs = liveGroups(s, ctx);
  if (!gs.length) {
    return { specs: [buildSpec(s, null, ctx)], texts: [buildText(s, null, 0, 1, ctx)], groups: [] };
  }
  const specs = gs.map((g) => buildSpec(s, g, ctx));
  const texts = gs.map((g, i) => buildText(s, g, i, gs.length, ctx));
  return { specs, texts, groups: gs };
}

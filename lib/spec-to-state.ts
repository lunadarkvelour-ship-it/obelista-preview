// Import: JSON spec → partial Form (+ picked). Ported 1:1 from specToState() in the original.

import type { AcctMode, Form, Spec, TagDef } from "./types";
import { DEFAULT_FORM } from "./seed";
import { ensureCreoName } from "./naming-guard";

export interface ImportResult {
  form: Partial<Form>;
  picked: string[] | null;
}

export function specToState(spec: Spec, tags: Record<string, TagDef>): ImportResult {
  const form: Partial<Form> = {};
  let picked: string[] | null = null;

  /* Нет профиля в спеке — оставляем ПУСТО, как в `DEFAULT_FORM` (`seed.ts:30`).
     Здесь стоял конкретный id `k1epd0wv` — профиль владельца, выбывший из
     антидетекта 05.08. Это костыль двух сортов сразу.

     Во-первых, он был про ОДНОГО пользователя. Владелец 14.08: делать так,
     чтобы он пользовался системой наравне с остальными, без путей «только
     под меня». Любой конкретный id в дефолте — такой путь: у второго
     человека этого профиля нет и быть не может. Эту половину правка чинит.

     Во-вторых, тот же протухший id молча гасил снапшотные проверки —
     `validate` ищет кабы в `snapshot.profiles[profile]`, для несуществующего
     профиля получает undefined и пропускает их все разом, а пустой список
     предупреждений читается как «залив чистый». ЭТУ половину правка НЕ
     чинит: пустая строка провалится в `validate` ровно так же, как протухший
     id — `undefined` что от того, что от другого. Молчание безопасно
     СЕГОДНЯ по другой причине: `validate()` не вызывается живым путём
     (`groups.ts`, buildBundle идёт мимо неё) — а не потому, что дефолт стал
     безопасным значением. Если `validate()` когда-нибудь подключат к живому
     пути, эта дыра — снова открытый вопрос, и чинить её тогда придётся
     отдельно, не тут.

     Пустая строка — состояние, с которым панель открывается всегда, и она
     умеет его показать. */
  form.profile = (spec.profiles || [])[0] || "";

  if (!spec.accounts || spec.accounts === "all_active") {
    form.acctMode = "all_active" as AcctMode;
  } else if (Array.isArray(spec.accounts)) {
    form.acctMode = "pick";
    picked = spec.accounts.slice();
  } else {
    form.acctMode = "exclude";
    picked = (spec.accounts.exclude || []).slice();
  }

  const st = (spec.structure || "1-1-1").split("-");
  form.nCamp = spec.campaigns_per_account || Number(st[0]) || 1;
  form.nAdset = Number(st[1]) || 1;
  form.nAd = Number(st[2]) || 1;
  form.objective = spec.objective || "OUTCOME_LEADS";

  const cv = spec.conversion || {};
  form.convLoc = cv.location || "WEBSITE";
  form.pixel = cv.pixel || "auto";
  form.event = cv.event || "";
  form.formId = cv.form_id || "";
  form.attribution = spec.attribution || "";

  const bg = spec.budget || {};
  form.budgetLevel = bg.level || "adset";
  form.daily = bg.daily_usd || 0;

  const bd = spec.bidding || {};
  form.bidStrategy = bd.strategy || "LOWEST_COST_WITHOUT_CAP";
  form.cap = bd.cap_usd ?? "";

  const t = spec.targeting || {};
  const age = t.age || [18, 65];
  form.geo = Array.isArray(t.geo) ? t.geo.join(",") : t.geo || "";
  form.ageMin = age[0];
  form.ageMax = age[1];
  form.gender = t.gender || "all";
  form.advAud = !!t.advantage_audience;
  form.device = ((t.custom || {}).device_platforms || ["all"])[0] || "all";
  const os0 = ((t.custom || {}).user_os || [])[0] || "";
  const osM = /^(iOS|Android)(?:_ver_([\d.]+)_and_above)?$/.exec(os0);
  form.userOs = osM ? osM[1] : "all";
  form.osVer = osM && osM[2] ? osM[2] : "";

  const pl = spec.placements;
  if (pl === "auto") {
    form.plcMode = "auto";
    form.plats = [];
    form.positions = "";
  } else {
    form.plcMode = "manual";
    form.plats = (pl || {}).platforms || ["facebook", "instagram"];
    const pos = (pl || {}).facebook_positions || (pl || {}).instagram_positions || [];
    form.positions = Array.isArray(pos) ? pos.join(", ") : pos || "";
  }

  form.page = spec.page || "auto";
  form.link = spec.link || "";

  const nm = spec.naming || {};
  let tag = "";
  let strip = (x: string) => x;
  for (const k in tags) {
    const p = tags[k].prefix;
    if (p && (nm.campaign || "").startsWith(p)) {
      tag = k;
      strip = (x: string) => (x && x.startsWith(p) ? x.slice(p.length) : x);
      break;
    }
  }
  form.tag = tag;
  /* Дефолты берём из DEFAULT_FORM, а не переписываем строками. Вторая копия
     шаблонов уже успела разойтись с первой: seed.ts починили, а здесь остался
     старый `ad--[ACT_LAST4]--[RAND5]` без [CREO_NAME], и импорт любой спеки без
     нейминга возвращал сломанный шаблон обратно в форму. */
  form.nmCamp = strip(nm.campaign) || DEFAULT_FORM.nmCamp;
  form.nmAdset = strip(nm.adset) || DEFAULT_FORM.nmAdset;
  // Импортируем и ЧУЖИЕ спеки — в них шаблон бывает любой.
  form.nmAd = ensureCreoName(strip(nm.ad) || DEFAULT_FORM.nmAd);

  /* Указания переживают круг «спека → форма → спека». Список тоже понимаем:
     движок принимает и его (`core/matrix.py`), а чужая спека приезжает всякая —
     потерять здесь текст значило бы потерять единственное, что человек написал
     своими словами. */
  form.notes = Array.isArray(spec.notes)
    ? spec.notes.filter(Boolean).join("\n")
    : typeof spec.notes === "string"
      ? spec.notes
      : "";

  form.activate = spec.activate || "nothing";
  form.specialCat = (spec.special_ad_categories || [])[0] || "";

  if (spec.start_time_local) {
    form.startTime = spec.start_time_local.replace(" ", "T").slice(0, 16);
    form.startLocal = true;
  } else if (spec.start_time) {
    form.startTime = spec.start_time.replace(" ", "T").slice(0, 16);
    form.startLocal = false;
  }

  const cr = spec.creatives || [];
  form.videoLines = cr.map((c: Spec) => c.video_name_contains || c.file || "").filter(Boolean).join("\n");
  form.creoSrc = cr.some((c: Spec) => c.file) ? "file" : "cab";
  form.staticAsVideo = !!spec.static_as_video || cr.some((c: Spec) => c.as_video);
  const c0 = cr[0] || {};
  form.creoCta = c0.cta || "SUBSCRIBE";
  form.creoPt = c0.primary_text || "";
  form.creoHl = c0.headline || "";
  form.creoUrl = c0.url_params || "";

  return { form, picked };
}

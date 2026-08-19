// Reference maps ported 1:1 from web/zaliv_builder.html.

export const GOAL: Record<string, string> = {
  "OUTCOME_SALES|WEBSITE": "OFFSITE_CONVERSIONS",
  "OUTCOME_LEADS|WEBSITE": "OFFSITE_CONVERSIONS",
  "OUTCOME_TRAFFIC|WEBSITE": "LINK_CLICKS",
  "OUTCOME_LEADS|INSTANT_FORM": "LEAD_GENERATION",
  "OUTCOME_ENGAGEMENT|MESSENGER": "CONVERSATIONS",
  "OUTCOME_ENGAGEMENT|WHATSAPP": "CONVERSATIONS",
  "OUTCOME_ENGAGEMENT|INSTAGRAM_PROFILE": "VISIT_INSTAGRAM_PROFILE",
  "OUTCOME_TRAFFIC|INSTAGRAM_PROFILE": "VISIT_INSTAGRAM_PROFILE",
  "OUTCOME_ENGAGEMENT|POST_ENGAGEMENT": "POST_ENGAGEMENT",
  "OUTCOME_AWARENESS|REACH": "REACH",
  "OUTCOME_AWARENESS|VIDEO_VIEWS": "THRUPLAY",
};

export const LOC_BY_OBJ: Record<string, string[]> = {
  OUTCOME_SALES: ["WEBSITE"],
  OUTCOME_LEADS: ["WEBSITE", "INSTANT_FORM"],
  OUTCOME_TRAFFIC: ["WEBSITE", "INSTAGRAM_PROFILE"],
  OUTCOME_ENGAGEMENT: ["MESSENGER", "WHATSAPP", "INSTAGRAM_PROFILE", "POST_ENGAGEMENT"],
  OUTCOME_AWARENESS: ["REACH", "VIDEO_VIEWS"],
};

export const LOC_LABELS: Record<string, string> = {
  WEBSITE: "website (pixel)",
  INSTANT_FORM: "lead form (Instant Form)",
  MESSENGER: "Messenger",
  WHATSAPP: "WhatsApp",
  INSTAGRAM_PROFILE: "Instagram profile visits",
  POST_ENGAGEMENT: "post engagement",
  REACH: "reach",
  VIDEO_VIEWS: "video views (ThruPlay)",
};

export const CTAS = [
  "SUBSCRIBE", "LEARN_MORE", "SHOP_NOW", "SIGN_UP", "GET_OFFER", "DOWNLOAD",
  "APPLY_NOW", "ORDER_NOW", "CONTACT_US", "GET_QUOTE", "MESSAGE_PAGE", "WHATSAPP_MESSAGE",
];

export const USER_OS = [
  { value: "all", label: "any OS" },
  { value: "iOS", label: "iOS" },
  { value: "Android", label: "Android" },
];

export const CREO_SOURCES = [
  // «ЗАЛИВЫ» не переводим: это имя реальной папки медиатеки на диске
  // (config.media_library_root), по нему юзер её и находит.
  { value: "cab", label: "video already on the ad account (by name)" },
  { value: "file", label: "file from the ЗАЛИВЫ folder (image/video)" },
];

export const MACROS = [
  "[DATE]", "[DDMM]", "[TIME]", "[ACT]", "[ACT_LAST4]", "[ACT_NAME]", "[PROFILE]",
  "[GEO]", "[AGE]", "[C]", "[A]", "[N]", "[ACC_N]", "[CREO_NAME]", "[RANDOM]", "[RAND5]",
];

export const OBJECTIVES = [
  { value: "OUTCOME_SALES", label: "Sales", short: "sales" },
  { value: "OUTCOME_LEADS", label: "Leads", short: "leads" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic", short: "traffic" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement", short: "engagement" },
  { value: "OUTCOME_AWARENESS", label: "Awareness", short: "awareness" },
];

export const ATTRIBUTIONS = [
  { value: "", label: "FB default" },
  { value: "7d_click_1d_view", label: "7-day click / 1-day view", short: "7d click / 1d view" },
  { value: "1d_click", label: "1-day click", short: "1d click" },
  { value: "7d_click", label: "7-day click", short: "7d click" },
  { value: "1d_click_1d_view", label: "1-day click / 1-day view", short: "1d click / 1d view" },
];

/* Куски фразы для ТЕКСТА промпта («льём на сайт»), а не подписи интерфейса:
   на экран не выводятся ни разу — их никто не импортирует. Оставлены на языке
   промпта, как в build-spec.ts, чтобы описание связки не разъехалось. */
export const LOC_TEXT: Record<string, string> = {
  WEBSITE: "на сайт", INSTANT_FORM: "через лид-форму", MESSENGER: "в Messenger",
  WHATSAPP: "в WhatsApp", INSTAGRAM_PROFILE: "на посещения профиля Instagram",
  POST_ENGAGEMENT: "на вовлечённость поста", REACH: "на охват", VIDEO_VIEWS: "на просмотры видео",
};

/* Переведены только `label` — их и видит человек в селекте. Поле `text` —
   формулировка для текста промпта движку (тот же язык, что в build-spec.ts),
   его не трогаем. */
export const ACTIVATE_OPTIONS = [
  { value: "nothing", label: "everything paused", text: "всё на паузе" },
  { value: "campaigns", label: "campaigns only (no spend)", text: "включить ТОЛЬКО кампании (адсеты/объявы паузед — спенд не идёт)" },
  { value: "campaigns+adsets", label: "campaigns + ad sets", text: "включить кампании и адсеты" },
  { value: "everything", label: "everything (spend starts now)", text: "включить ВСЁ (спенд сразу)" },
];

/* НЕ переводить: это не подписи, а ЗНАЧЕНИЯ поля specialCat, которые уезжают
   в спеку как `special_ad_categories` (build-spec.ts:141). Перевод сменит то,
   что получит движок. Английские подписи для селекта — задача компонента. */
export const SPECIAL_CATS = ["", "финансы", "жильё", "работа", "политика", "гемблинг"];

export const GENDERS = [
  { value: "all", label: "any", short: "any" },
  { value: "male", label: "male", short: "male" },
  { value: "female", label: "female", short: "female" },
];

export const DEVICES = [
  { value: "all", label: "all" },
  { value: "mobile", label: "mobile only" },
  { value: "desktop", label: "desktop only" },
];

export const PLATFORMS = [
  { value: "facebook", label: "fb" },
  { value: "instagram", label: "ig" },
  { value: "messenger", label: "msg" },
  { value: "audience_network", label: "an" },
];

export const BUDGET_LEVELS = [
  { value: "adset", label: "ABO (per ad set)" },
  { value: "campaign", label: "CBO (per campaign)" },
];

export const BID_STRATEGIES = [
  { value: "LOWEST_COST_WITHOUT_CAP", label: "Lowest cost (no cap)" },
  { value: "LOWEST_COST_WITH_BID_CAP", label: "Bid cap" },
  { value: "COST_CAP", label: "Cost cap" },
];

export const ACCT_MODES = [
  { value: "all_active", label: "all active" },
  { value: "pick", label: "pick from catalog" },
  { value: "exclude", label: "all except selected" },
];

/* Позиции плейсментов: человеческий выбор → имена, которые принимает FB.
 *
 *  Зачем отдельный модуль. У Facebook и Instagram позиции называются
 *  ПО-РАЗНОМУ, и это уже дважды стоило залива целиком: 28.07 — 16 кабов, 48
 *  отказов, 0 объектов; 29.07 — 10 кабов, 30 отказов. Лента у FB `feed`, у IG
 *  `stream`; рилсы у FB `facebook_reels`, у IG `reels`. Панель до этого писала
 *  ОДИН набор в обе платформы и подсказывала в плейсхолдере ровно ту строку,
 *  которая гарантированно ломает залив: «feed, story, reels».
 *
 *  Раньше перевод был обязанностью модели: движок (`core/matrix.py`) держит
 *  белый список и отвечает подсказкой «у Instagram лента называется stream».
 *  Но спеку теперь собирает панель, а модели прямым текстом сказано «НЕ
 *  ПЕРЕСОБИРАЙ» — значит переводить обязана панель, иначе связка умирает на
 *  plan_upload, и починить её оператору нечем.
 *
 *  Ключи словаря совпадают с тем, что люди писали руками («feed», «story»,
 *  «reels»), поэтому старые пресеты и сохранённые формы начинают работать
 *  правильно сами, без миграции.
 */

export type Platform = "facebook" | "instagram" | "messenger" | "audience_network";

export interface PlacementDef {
  /** Ключ в форме. Он же — то, что человек пишет руками. */
  key: string;
  /** Подпись чипса — она на экране, поэтому по-английски, как вся панель.
   *  Комментарии в этом файле русские, интерфейс — нет; их и путали. */
  label: string;
  /** Имя позиции у платформы. Нет поля — у этой платформы такой позиции не существует. */
  facebook?: string;
  instagram?: string;
  messenger?: string;
  audience_network?: string;
}

/** Позиции, которые выбирают чипсами. Остальное из белого списка FB тоже
 *  принимается, если написать руками, — см. RAW ниже. */
export const PLACEMENTS: PlacementDef[] = [
  { key: "feed", label: "Feed", facebook: "feed", instagram: "stream" },
  { key: "story", label: "Stories", facebook: "story", instagram: "story", messenger: "story" },
  { key: "reels", label: "Reels", facebook: "facebook_reels", instagram: "reels" },
  { key: "explore", label: "Explore", instagram: "explore" },
  { key: "profile", label: "Profile", facebook: "profile_feed", instagram: "profile_feed" },
  { key: "search", label: "Search", facebook: "search", instagram: "ig_search" },
  { key: "video_feeds", label: "Video feed", facebook: "video_feeds" },
  { key: "instream", label: "In-stream", facebook: "instream_video", audience_network: "instream_video" },
  { key: "marketplace", label: "Marketplace", facebook: "marketplace" },
];

/** Белый список FB — зеркало `core/matrix.py: POSITIONS`.
 *
 *  Держится здесь, чтобы панель НИКОГДА не отправила имя, которого у платформы
 *  нет. Расхождение с движком ловит `tests/test_panel_bundle_contract.py`: он
 *  читает этот файл и сверяет оба списка. */
export const RAW: Record<Platform, string[]> = {
  facebook: [
    "feed", "right_hand_column", "marketplace", "video_feeds", "story", "search",
    "instream_video", "facebook_reels", "facebook_reels_overlay", "profile_feed",
    "groups_feed", "notification", "biz_disco_feed",
  ],
  instagram: [
    "stream", "story", "explore", "explore_home", "reels", "profile_feed",
    "profile_reels", "ig_search",
  ],
  messenger: ["messenger_home", "sponsored_messages", "story"],
  audience_network: ["classic", "instream_video", "rewarded_video"],
};

const PLATFORMS: Platform[] = ["facebook", "instagram", "messenger", "audience_network"];

export interface SplitPositions {
  facebook: string[];
  instagram: string[];
  messenger: string[];
  audience_network: string[];
  /** Что не удалось опознать: ни ключ словаря, ни имя из белого списка FB.
   *  Молча выбрасывать нельзя — человек считает, что сузил плейсменты. */
  unknown: string[];
}

/** Разложить написанное человеком по платформам, переведя имена.
 *
 *  Токен ищется сначала как ключ словаря («feed»), потом как готовое имя FB
 *  («stream») — второе нужно тем, кто копирует спеки из документации, и старым
 *  пресетам. Позиция, которой у платформы не существует, в неё не попадает
 *  вовсе: именно на этом падали адсеты. */
export function splitPositions(tokens: string[]): SplitPositions {
  const out: SplitPositions = {
    facebook: [], instagram: [], messenger: [], audience_network: [], unknown: [],
  };
  const push = (p: Platform, v: string) => {
    if (!out[p].includes(v)) out[p].push(v);
  };

  for (const raw of tokens) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;

    const def =
      PLACEMENTS.find((d) => d.key === t) ||
      PLACEMENTS.find((d) => PLATFORMS.some((p) => d[p] === t));
    if (def) {
      for (const p of PLATFORMS) {
        const name = def[p];
        if (name) push(p, name);
      }
      continue;
    }

    // Не из словаря — но может быть законным именем FB, просто редким.
    const fits = PLATFORMS.filter((p) => RAW[p].includes(t));
    if (fits.length) {
      for (const p of fits) push(p, t);
      continue;
    }
    if (!out.unknown.includes(t)) out.unknown.push(t);
  }
  return out;
}

/** Разбор строки формы: «feed, story» → токены. */
export function parsePositions(s: string): string[] {
  return (s || "").split(",").map((x) => x.trim()).filter(Boolean);
}

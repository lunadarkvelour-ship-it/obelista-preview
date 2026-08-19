/* Стили для смотрелок: где их взять, когда своей сборки у страницы нет.
 *
 *  Общее место для `preview-*.test.ts`. Заведено после 15.08: локальная панель
 *  под launchd отдавала 400 на ГЛАВНЫЙ css-хэш и 200 на два мелких — то есть
 *  «стили взялись», а страница выходила голой, и это легко принять за сломанную
 *  вёрстку листа. Проверка на непустоту такое пропускает, проверка на ВЕС — нет.
 *
 *  Ограничение, о котором надо помнить: Tailwind кладёт в собранный CSS только
 *  те классы, которые видел в исходниках НА МОМЕНТ ТОЙ СБОРКИ. Новый класс,
 *  которого в собранной панели ещё нигде нет, здесь не покрасится. Смотреть на
 *  смотрелке имеет смысл раскладку и читаемость текста, а не единственный в
 *  своём роде оттенок.
 */

/** Собранный Tailwind панели больше 100 КБ, мелочь вроде анимаций тостов —
 *  единицы килобайт. Порог отделяет одно от другого. */
const CSS_MIN = 20_000;

async function cssOf(base: string, path: string): Promise<string[]> {
  const page = await fetch(base + path).then((r) => r.text());
  const hrefs = [...page.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
  const files: string[] = [];
  for (const h of [...new Set(hrefs)]) {
    const r = await fetch(base + h);
    if (r.ok) files.push(await r.text());
    else console.log(`смотрелка: ${base}${h} отдал ${r.status} — этот файл стилей пропущен`);
  }
  return files;
}

/** Стили: сперва локальная панель, при беде — прод.
 *
 *  Прод отдаёт тот же собранный Tailwind публично и логина для статики не
 *  просит; страница берётся `/login` — она открыта без сессии. Смотрелка без
 *  стилей перестаёт быть глазами ровно тогда, когда нужна.
 *
 *  @param path страница локальной панели, с которой брать ссылки на стили. */
export async function panelCss(path = "/analytics"): Promise<string> {
  const свои = (await cssOf("http://localhost:8790", path).catch(() => [])).join("\n");
  if (свои.length >= CSS_MIN) return свои;
  console.log(
    `смотрелка: у локальной панели стилей набралось ${свои.length} байт — этого мало, беру у прода`,
  );
  const прод = (await cssOf("https://app.obelista.com", "/login").catch(() => [])).join("\n");
  if (!прод.length) console.log("смотрелка: стилей нет вовсе, страница будет голой");
  return прод.length > свои.length ? прод : свои;
}

/** Страница смотрелки целиком. Тема — атрибутом на `html`, как в панели:
 *  половина находок по контрасту случается именно в тёмной. */
export function previewPage(title: string, theme: string, css: string, body: string): string {
  return (
    `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
    `<title>${title} · ${theme}</title><style>${css}</style>` +
    `<body class="bg-background text-foreground" style="padding:24px">` +
    `<div style="max-width:1400px;margin:0 auto">${body}</div></body></html>`
  );
}

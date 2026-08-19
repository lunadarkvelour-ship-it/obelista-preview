/* Какие соцы не собрались в последнюю попытку.
 *
 * Панель раньше показывала одну метку «обновлено» на весь снапшот. Она ставилась
 * по времени ПОПЫТКИ сбора, а кабинеты несобравшегося соца подставлялись из
 * прошлого файла — терять каталог из-за одной неудачи нельзя. Получалось худшее
 * сочетание: старые данные под свежей меткой. 11.08 это стоило часа поисков —
 * пять пошаренных кабинетов «не появлялись», хотя Мета их отдавала.
 *
 * Свежесть теперь живёт на профиле (`collected_at`), а причина падения — в
 * `collect_error`. Здесь мы только собираем их в список для показа.
 */
import type { Snapshot } from "./types";

export interface StaleSocial {
  /** id профиля в антике — то, чем соц зовётся везде. */
  profile: string;
  /** Человеческое имя из снапшота; пусто — покажем id. */
  label: string;
  /** Чем кончилась попытка. */
  error: string;
  /** На какое время его кабинеты актуальны. */
  collectedAt?: string;
  /** Сколько кабинетов показано по старым данным. */
  accounts: number;
}

/** Соцы, чей последний сбор упал. Пустой список — всё собралось. */
export function staleSocials(snap: Snapshot | null | undefined): StaleSocial[] {
  const profiles = snap?.profiles || {};
  const out: StaleSocial[] = [];
  for (const [profile, p] of Object.entries(profiles)) {
    const error = (p?.collect_error || "").trim();
    if (!error) continue;
    out.push({
      profile,
      label: p?.label || "",
      error,
      collectedAt: p?.collected_at,
      accounts: (p?.accounts || []).length,
    });
  }
  // Стабильный порядок: список читают глазами, и прыгающие строки мешают.
  return out.sort((a, b) => a.profile.localeCompare(b.profile));
}

/** Дольше этого без сбора — данные соца считаем несвежими.
 *  Та же цифра, что у движка (`core/tabs.py: SNAPSHOT_STALE_H`). */
export const FRESH_MAX_H = 6;

/** Соцы, чьи данные собраны только что.
 *
 *  Это про СВЕЖЕСТЬ ДАННЫХ и только про неё. Существование соца отсюда не
 *  выводится, и попытка так сделать — ровно та ошибка, которую этот файл
 *  лечит: демон отдаёт склейку `file+oauth`, и «давно не опрашивали» означает
 *  либо «профиль выбыл», либо «профиль жив, но без токена прилы, и приезжает
 *  из файловой половины». 13.08 во вторую категорию попадали `k1f15y8n` и
 *  `k1fn9qb1` — оба в антике, оба выглядели бы выбывшими.
 *
 *  Кто существует, знает Обелиста; сегодня её единственный источник — список
 *  антидетекта на машине оператора (`in_antik` в ручке
 *  `/socials`, отсюда же `useAntik`). Свежесть с ним не спорит и его не
 *  заменяет: одна отвечает «насколько верить цифрам», второй — «есть ли соц».
 */
export function freshProfiles(
  snap: Snapshot | null | undefined,
  now: number = Date.now(),
  maxAgeH: number = FRESH_MAX_H,
): Set<string> {
  const out = new Set<string>();
  for (const [profile, p] of Object.entries(snap?.profiles || {})) {
    const t = p?.collected_at ? Date.parse(p.collected_at) : NaN;
    if (!Number.isFinite(t)) continue;
    if (now - t <= maxAgeH * 3600_000) out.add(profile);
  }
  return out;
}

/** Возраст словами — тот же словарь, что в шапке, чтобы не спорили. */
export function ageWords(ts?: string, now: number = Date.now()): string {
  const t = ts ? Date.parse(ts) : NaN;
  if (!Number.isFinite(t)) return "unknown time";
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** Строка для человека: что именно устарело и насколько.
 *
 *  Одна фраза на соц, а не таблица: это предупреждение в потоке работы, его
 *  читают боковым зрением. Подробности — в подсказке рядом.
 */
export function staleLine(s: StaleSocial, now: number = Date.now()): string {
  const кто = s.label ? `${s.profile} · ${s.label}` : s.profile;
  return `${кто} — sync failed, ${s.accounts} ad accounts from ${ageWords(s.collectedAt, now)}`;
}

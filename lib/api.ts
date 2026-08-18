/* API proxy — обёртка над `fetch` к app.obelista.com.
 *
 * В режиме preview без OBELISTA_SESSION_COOKIE возвращает моки из
 * `lib/mock.ts`. Как только юзер кладёт cookie в env (локально в
 * `.env.local`, на Vercel — в Project Settings), запросы идут в прод.
 *
 * Почему прокси, а не прямой fetch с клиента:
 *   1. CORS — прод-бэк не отдаёт Access-Control-Allow-Origin для нашего
 *      preview-домена. Прокси-роут идёт с того же origin, CORS не нужен.
 *   2. Сессия — cookie хранится в env сервера, не в браузере юзера.
 *   3. Никакого риска для прода: preview только ЧИТАЕТ (GET), ничего не
 *      пишет и не модифицирует. */

const BASE = process.env.OBELISTA_BASE_URL ?? "https://app.obelista.com";
const COOKIE = process.env.OBELISTA_SESSION_COOKIE;

export function isLive(): boolean {
  return Boolean(COOKIE);
}

export async function proxyFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!COOKIE) {
    // Мок-режим — отдаём 503 чтобы клиент знал, что надо fallback
    return new Response(JSON.stringify({ mock: true, path }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(path, BASE).toString();
  const headers = new Headers(init?.headers);
  headers.set("cookie", COOKIE);
  headers.set("accept", "application/json");

  return fetch(url, { ...init, headers, cache: "no-store" });
}

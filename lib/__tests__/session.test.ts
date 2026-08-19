import { describe, expect, it } from "vitest";
import { LOGIN_PATH, isSessionExpired, loginHref, safeNext } from "../session";

const ответ = (status: number, headers: Record<string, string> = {}) =>
  ({ status, headers: new Headers(headers) });

describe("что считается концом сессии", () => {
  it("голый 401 — да", () => {
    expect(isSessionExpired(ответ(401))).toBe(true);
  });

  it("401 с вызовом basic auth — НЕТ", () => {
    // До блока Е панель стоит за basic auth Caddy, и он отвечает тем же кодом.
    // С этим окном разбирается сам браузер; увести человека на наш вход в этот
    // момент значит увести его от единственного места, где он может ответить.
    expect(isSessionExpired(ответ(401, { "www-authenticate": 'Basic realm="restricted"' })))
      .toBe(false);
    // Регистр и пробелы приходят как придётся — сверяем нечувствительно.
    expect(isSessionExpired(ответ(401, { "www-authenticate": "  basic  " }))).toBe(false);
  });

  it("401 с другим вызовом — наш", () => {
    // Bearer/Session — это уже наш гейт, а не инфраструктура браузера.
    expect(isSessionExpired(ответ(401, { "www-authenticate": "Bearer" }))).toBe(true);
  });

  it("прочие коды не трогаем", () => {
    for (const c of [200, 204, 400, 403, 404, 500, 502]) {
      expect(isSessionExpired(ответ(c))).toBe(false);
    }
    // 403 отдельно: это «нельзя», а не «войди заново». Уводить на вход человека,
    // который уже вошёл, но не имеет прав, — значит послать его по кругу.
    expect(isSessionExpired(ответ(403))).toBe(false);
  });
});

describe("адрес входа с возвратом", () => {
  it("несёт, куда человек шёл", () => {
    expect(loginHref("/analytics?since=2026-08-01"))
      .toBe(`${LOGIN_PATH}?next=%2Fanalytics%3Fsince%3D2026-08-01`);
  });

  it("со входа на вход не зацикливается", () => {
    expect(loginHref(LOGIN_PATH)).toBe(LOGIN_PATH);
    expect(loginHref(LOGIN_PATH + "?next=%2Fads")).toBe(LOGIN_PATH);
  });

  it("чтение параметра проверяется тем же правилом, что и запись", () => {
    // Одно правило на обе стороны: разъедутся они ровно тогда, когда кто-то
    // поправит одну из двух.
    expect(safeNext("/analytics?geo=BR")).toBe("/analytics?geo=BR");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("https://evil.example/steal")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    // Вход как место возврата — круг: вошёл и снова на форму входа.
    expect(safeNext(LOGIN_PATH)).toBe("/");
  });

  it("наружу не уводит — открытого редиректа тут нет", () => {
    // `?next=https://чужой.сайт` увёл бы человека, только что введшего пароль,
    // на чужую страницу с нашим логотипом. Хвост приходит из адресной строки,
    // то есть снаружи, и доверять ему нельзя.
    expect(loginHref("https://evil.example/steal")).toBe(`${LOGIN_PATH}?next=%2F`);
    expect(loginHref("//evil.example/steal")).toBe(`${LOGIN_PATH}?next=%2F`);
    expect(loginHref("javascript:alert(1)")).toBe(`${LOGIN_PATH}?next=%2F`);
  });
});

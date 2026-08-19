/* Юридические страницы и способ входа не расходятся.
 *
 *  Зачем этот тест. С 07.08 в `main` были ОПУБЛИКОВАНЫ три страницы, где прямым
 *  текстом стояло «Obelista does not use passwords at all» и «we sign you in by
 *  email link». Лист аккаунта при этом строился вокруг пароля и его сброса.
 *
 *  Это не косметика. Корень сайта — Site URL заявки в Мету, ревьюер открывает
 *  его первым делом, а обещание «паролей нет» дано клиенту письменно. Владелец
 *  14.08 решил: правда — пароль, поправить надо страницы.
 *
 *  Тест сторожит обе стороны разом: чтобы старые утверждения не вернулись, и
 *  чтобы новые не потерялись при следующей правке текста. Проверяем ИСХОДНИК,
 *  потому что компонентных тестов в проекте нет, а страницы статические.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.resolve(__dirname, "../../app");
const page = (name: string) => readFileSync(path.join(APP, name, "page.tsx"), "utf8");

const СТРАНИЦЫ = ["terms", "privacy", "data-request"] as const;

describe("страницы не обещают того, чего нет", () => {
  it("нигде не сказано, что паролей не существует", () => {
    for (const p of СТРАНИЦЫ) {
      const s = page(p);
      expect(s, p).not.toMatch(/do not use passwords/i);
      expect(s, p).not.toMatch(/does not use passwords/i);
      expect(s, p).not.toMatch(/passwordless/i);
    }
  });

  it("нигде не обещан вход по ссылке из письма", () => {
    // Механизм не выбран таким; обещать его в юридическом тексте нельзя.
    for (const p of СТРАНИЦЫ) {
      expect(page(p), p).not.toMatch(/sign-in link|sign in link|magic link/i);
    }
  });
});

describe("страницы говорят, как есть", () => {
  it("условия называют вход по почте и паролю", () => {
    expect(page("terms")).toMatch(/email address and a password/i);
  });

  it("политика конфиденциальности РАСКРЫВАЕТ, что пароль хранится", () => {
    // Главное следствие смены механизма. Политика перечисляет, какие данные о
    // человеке у нас есть; появился пароль — он обязан быть в списке, иначе
    // документ снова врёт, только в другую сторону.
    const s = page("privacy");
    expect(s).toMatch(/Your password/);
    expect(s).toMatch(/cannot be turned back into the password/i);
  });

  it("обещание «пароль у вас не спросят» СОХРАНЕНО", () => {
    // Эта мысль была верной и до правки: она защищает от фишинга и остаётся
    // верной при любом механизме входа. Её нельзя потерять заодно с остальным.
    const s = page("data-request");
    expect(s).toMatch(/never ask you for your password/i);
    expect(s).toMatch(/is not us/i);
  });
});

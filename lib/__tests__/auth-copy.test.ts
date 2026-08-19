import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX, PASSWORD_MIN_FALLBACK, authErrorText, passwordProblem, passwordRule,
} from "../auth-copy";

const AUTH_PY = path.resolve(__dirname, "../../../core/auth.py");

describe("коды сервера и тексты панели не расходятся молча", () => {
  it("у каждого отказа core/auth.py есть свой текст здесь", () => {
    /* СПИСОК КОДОВ ЧИТАЕТСЯ ИЗ НАСТОЯЩЕГО ИСТОЧНИКА, а не переписан сюда руками:
       переписанный знает только про то, что было в день переписывания, и молча
       расходится с сервером. Отказ, для которого текста нет, показывается общим
       «что-то пошло не так» — то есть человек, которому нельзя удалить себя,
       узнаёт об этом словами «попробуйте ещё раз». Так и было бы с self_delete
       (#158), не читай этот тест сам файл. */
    const коды = [...readFileSync(AUTH_PY, "utf8").matchAll(/Отказ\(\s*"([a-z_]+)"/g)].map(
      (m) => m[1],
    );
    expect(коды.length).toBeGreaterThan(15);

    const общий = authErrorText("кода-с-таким-именем-нет");
    const безТекста = [...new Set(коды)].filter((c) => authErrorText(c) === общий);
    expect(
      безТекста,
      `сервер отказывает этими кодами, а панель покажет на них общее «что-то ` +
        `пошло не так»: ${безТекста.join(", ")}`,
    ).toEqual([]);
  });
});

describe("две смерти приглашения говорятся разными словами", () => {
  it("использованное зовёт войти, просроченное — к админу", () => {
    // Соблазн свести оба к «ссылка недействительна» велик, а цена конкретная:
    // действия противоположные. Слитый текст отправит половину людей не туда.
    const used = authErrorText("invite_used");
    const expired = authErrorText("invite_expired");
    expect(used).not.toBe(expired);
    expect(used.toLowerCase()).toContain("sign in");
    expect(expired.toLowerCase()).toContain("admin");
    expect(expired).toContain("48 hours");
  });
});

describe("тексты отказов", () => {
  it("неверная пара не выдаёт, какая половина не подошла", () => {
    // Иначе форма превращается в проверялку существующих адресов.
    const t = authErrorText("bad_pair").toLowerCase();
    expect(t).toContain("do not match");
    expect(t).not.toContain("no such");
    expect(t).not.toContain("unknown email");
  });

  it("незнакомый код не подставляется в чужой текст", () => {
    // Сервер вправе завести новый код раньше, чем панель о нём узнает. Показать
    // на нём «неверная пара» значит соврать о причине.
    const неизвестный = authErrorText("teapot_on_fire");
    expect(неизвестный).not.toBe(authErrorText("bad_pair"));
    expect(неизвестный.length).toBeGreaterThan(0);
    expect(authErrorText(null)).toBe(неизвестный);
    expect(authErrorText(undefined)).toBe(неизвестный);
  });

  it("нигде не просит подтвердить или вспомнить прежний пароль", () => {
    // Юрстраницы обещают: мы никогда не спрашиваем пароль, прочитать его нельзя,
    // восстановления нет — есть сброс. Текст, обещающий обратное, делает из
    // опубликованного документа неправду.
    const все = ["bad_pair", "weak_password", "invite_used", "invite_expired",
                 "rate_limited", "disabled", "нет такого"].map(authErrorText).join(" ").toLowerCase();
    for (const запрет of ["confirm your password", "your old password", "recover your password",
                          "tell your admin your password", "send us your password"]) {
      expect(все).not.toContain(запрет);
    }
  });
});

describe("правило пароля показывается до ввода", () => {
  it("берёт минимум из ответа сервера, а не зашитый", () => {
    expect(passwordRule(14)).toContain("14");
    expect(passwordRule(14)).not.toContain(String(PASSWORD_MIN_FALLBACK));
  });

  it("без ответа сервера показывает запасное число, а не правило без числа", () => {
    expect(passwordRule(null)).toContain(String(PASSWORD_MIN_FALLBACK));
    expect(passwordRule(0)).toContain(String(PASSWORD_MIN_FALLBACK));
  });

  it("не требует заглавных и спецзнаков", () => {
    // Такие требования заставляют писать Password1! и делают пароли хуже.
    const t = passwordRule(10).toLowerCase();
    expect(t).toContain("no capitals or symbols required");
  });
});

describe("что видно до отправки", () => {
  it("короткий — по числу от сервера", () => {
    expect(passwordProblem("123456789", "a@b.c", 10)).toContain("10");
    expect(passwordProblem("1234567890", "a@b.c", 10)).toBeNull();
    expect(passwordProblem("123456789012", "a@b.c", 14)).toContain("14");
  });

  it("слишком длинный тоже отказ, и это не придирка: предел настоящий", () => {
    expect(passwordProblem("x".repeat(PASSWORD_MAX), "a@b.c", 10)).toBeNull();
    expect(passwordProblem("x".repeat(PASSWORD_MAX + 1), "a@b.c", 10))
      .toContain(String(PASSWORD_MAX));
  });

  it("пароль, равный своей почте, ловится независимо от регистра и пробелов", () => {
    expect(passwordProblem("Ivan@example.com", " ivan@example.com ", 10))
      .toContain("email address");
    expect(passwordProblem("  ivan@example.com  ", "IVAN@EXAMPLE.COM", 10))
      .toContain("email address");
  });

  it("пустая почта не превращает любой пароль в «это твоя почта»", () => {
    // На экране установки пароля по приглашению адреса рядом может не быть вовсе.
    expect(passwordProblem("   ", "", 10)).not.toBeNull();      // короткий — да
    expect(passwordProblem("длинный-пароль-нормальный", "", 10)).toBeNull();
  });
});

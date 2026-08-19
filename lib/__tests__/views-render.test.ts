/* Два новых листа вообще рисуются — самая дешёвая проверка из существующих.
 *
 * ЗАЧЕМ ОНА ЕСТЬ. Всё остальное в папке проверяет ЧИСТЫЕ функции: состояния
 * биллинга, срок, разбор профиля. Ни один такой тест не заметит, что лист
 * упал на первом же рендере — из-за переехавшего экспорта, кривого импорта
 * или компонента, который в этой версии React ведёт себя иначе. Живьём
 * посмотреть в ночь 15.08 было нельзя: выкат на боевой машине лежал (кончился
 * диск, чинил другой воркер), а `npm run dev` на маке запрещён — панель уже
 * крутится под launchd, и второй сборкой ей ломают общий `.next`.
 *
 * ЧТО ЭТО НЕ ПРОВЕРЯЕТ. Ни вида, ни поведения: серверный рендер не выполняет
 * эффектов, не ходит в сеть и не знает про клики. То есть «интеграции
 * приехали с сервера» и «выбор тарифа открывает экран оплаты» отсюда НЕ
 * видны — это по-прежнему проверяется руками на живой панели.
 *
 * Проверяем строки, которые обязаны быть на экране по сути задачи, а не
 * классы и не разметку: разметку черновика правят каждый день, и тест,
 * прибитый к ней, начнёт врать первым.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BillingView } from "@/components/views/BillingView";
import { ProfileView } from "@/components/views/ProfileView";
import { PLANS, planPriceLine } from "@/lib/billing-plans";

describe("лист биллинга рисуется и говорит правду о сегодняшнем дне", () => {
  const html = renderToStaticMarkup(createElement(BillingView));

  it("провайдер назван, и сказано, что оплата не подключена", () => {
    expect(html).toContain("Cryptomus");
    expect(html).toMatch(/not connected/i);
  });

  it("все три тарифа с ценами на экране, и цена приезжает из модели", () => {
    for (const p of PLANS) {
      expect(html).toContain(p.name);
      expect(html).toContain(planPriceLine(p));
    }
  });

  it("отсутствие автосписания сказано словами, а не подразумевается", () => {
    expect(html).toMatch(/no auto-charge/i);
  });
});

describe("лист профиля рисуется без данных сервера", () => {
  /* Важный случай: ответа `/auth/me` и `/socials` ещё нет (эффекты в
     серверном рендере не выполняются) — и лист обязан быть целым, а не
     пустым экраном в ожидании. */
  const html = renderToStaticMarkup(createElement(ProfileView));

  it("все четыре блока на месте", () => {
    expect(html).toContain("Integrations");
    expect(html).toContain("About you");
    expect(html).toContain("Referral coupon");
    expect(html).toContain("Billing");
  });

  it("пока сервер не ответил, ни имени, ни воркспейса не выдумано", () => {
    expect(html).toMatch(/Asking the server/i);
    expect(html).not.toMatch(/workspace #\d/i);
  });
});

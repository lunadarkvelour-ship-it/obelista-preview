/**
 * Воронка, которую присылает РАСШИРЕНИЕ БРАУЗЕРА (иссус #120).
 *
 * ПОЧЕМУ ЭТОТ ИСТОЧНИК ВООБЩЕ СУЩЕСТВУЕТ. У части CRM нет токенной
 * авторизации вовсе — только HttpOnly-кука браузера. Проверено на живой
 * (`core/funnel_intake.py`, разбор 28.07 и осмотр запросов 14.08: в заголовках
 * один `Cookie`, ни `Authorization`, ни `X-Api-Key`). Облако не может
 * представиться такой кукой никак, значит сходить и забрать воронку оно не
 * может в принципе. Инициатива всегда СНИЗУ: данные берёт расширение в
 * браузере, где человек залогинен, и присылает их наверх.
 *
 * ПОЧЕМУ КАРТОЧКА НАЗВАНА МЕХАНИЗМОМ, А НЕ ИМЕНЕМ CRM. Владелец подключает
 * этим свою `Keine Media`, и соблазн назвать карточку её именем большой.
 * Нельзя, и не по вкусовым причинам: решение №19 и шапка
 * `integrations-trackers.ts` — «чьё-то личное подключение не может быть
 * записано в продукт строкой», кит едет чужому человеку одинаковым. У чужого
 * байера своя CRM без токена, и он подключает её ТЕМ ЖЕ способом. Имя
 * конкретной CRM живёт там, где ему и место: в манифесте расширения на машине
 * оператора (`browser_ext/crmsync`) и в адаптере разбора рядом с остальными
 * (`core/sources/keine_media.py`) — одним модулем среди шести, а не особым
 * случаем в движке.
 *
 * ПОЧЕМУ ПОЛЕЙ ВВОДА НЕТ. Здесь нечего вводить, и это не «пока»: адрес — это
 * адрес самой панели, а ключ приёма панель ВЫДАЁТ, а не спрашивает. Человек
 * копирует его отсюда в настройки расширения, а не наоборот. Выдача ключа на
 * арендатора делается в #147; до неё ключ один на установку, и приём отвечает
 * `409 many_tenants`, как только арендаторов становится двое, — то есть
 * отказывается писать чужую воронку владельцу. Это правильное поведение, и в
 * `supportNote` оно названо словами, а не спрятано.
 */

import type { Vendor } from "@/lib/integrations";

const BROWSER_PUSH: Vendor = {
  id: "browser_push",
  name: "Browser extension",
  mark: "Bx",
  section: "trackers",
  kindLabel: "Funnel pushed from your browser",
  /* Подпись — одна строка (#157). Что ключ наш, куда его вставлять и почему
     облако не ходит в CRM само, написано ниже в самом блоке ключа: это
     единственное на листе, что реально работает, и повторять его дважды
     значит разъехаться дважды. */
  summary:
    "For a CRM with no API key at all — only your own browser session. An extension on your machine sends the daily funnel up here.",
  support: "shipped",
  supportNote:
    "The receiving side is in the engine and the daily funnel lands in the same table every other source writes to. What is missing is the key: today one key belongs to the whole installation, so the moment a second workspace exists the intake refuses the push instead of writing someone else's funnel into yours (issue #147 makes the key belong to a workspace and shows it here).",
  /* Соединяется ПО ИМЕНИ ОБЪЯВЛЕНИЯ. Это свойство способа, а не CRM: страница
     статистики группируется теми же именами кампании/адсета/объявления, что
     стоят в Ads Manager, — sub id туда не доезжает вовсе. */
  /* Ключ приёма показывается ВНУТРИ этой карточки (`issuesKey`): человек берёт
     его здесь и вставляет в настройки расширения на своей машине. Отдельной
     карточки под ключ нет — ключ это часть подключения, а не сосед по листу. */
  issuesKey: true,
  joinBy: "ad_name",
  /* Что реально приезжает — ровно те пять шагов, что кладёт разбор
     (`core/sources/keine_media.py`: sub, contact, checkout, ftd, rd). Выручки
     среди них нет, и дорисовывать её нулём нельзя: пустое честнее нуля. */
  gives: ["sub", "contact", "checkout", "ftd", "rd"],
  fields: [],
  fieldsNote:
    "Nothing to type here. The address is this panel's own, and the intake key is issued by us, not asked from you: you copy it into the extension's settings on the machine where the CRM is open. The extension only sends days from the date you started counting — earlier ones are left alone, and it says so rather than dropping them quietly.",
};

/** Реестр раздела. Второй такой источник встаёт сюда одной строкой. */
export const EXTENSION_SOURCES: readonly Vendor[] = [BROWSER_PUSH];

import { BillingView } from "@/components/views/BillingView";

/* Прямой адрес /billing — этого достаточно на сегодня. Пункт меню сюда
 * намеренно не добавлен: `leaves.ts` занят другим агентом параллельно
 * (лист аккаунта), и ссылку в навигацию поставит владелец сам отдельным
 * шагом. */
export default function Page() {
  return <BillingView />;
}

import { ProfileView } from "@/components/views/ProfileView";

/* Прямой адрес /profile (иссус #127). Пункт меню сюда не добавлен намеренно:
 * `components/shell/leaves.ts` — общий файл, в эту ночь его правят другие
 * воркеры, а `leaves.test.ts` следит, чтобы пункт и лист не расходились.
 * Профиль обычно живёт не в списке листов, а в шапке у имени человека — это
 * отдельный шаг и отдельное решение владельца. */
export default function Page() {
  return <ProfileView />;
}

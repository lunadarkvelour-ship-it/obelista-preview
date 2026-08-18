import { AppShell } from "@/components/shell/AppShell";
import { CreativesView } from "@/components/views/CreativesView";

/* Медиатека — главный редизайн.
 *   • sidebar sticky 280px, topbar 64px sticky, content в overflow-y-auto
 *   • сетка карточек крео с group-hover (заголовок + thumbnail тянутся вместе)
 *   • filter-row + search + sort + сегмент type
 *   • dropzone collapsed by default — клик по «+ Upload» раскрывает
 *   • tabular-nums во всех цифрах, Geist Mono для ID
 *   • переходы 200-300ms — из superagentslabs */
export default function CreativesPage() {
  return (
    <AppShell>
      <CreativesView />
    </AppShell>
  );
}

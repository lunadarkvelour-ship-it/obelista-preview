import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/* Каркас страницы. Sidebar sticky слева, Topbar sticky сверху, контент
 * рендерится внутри. Никакого polling-а, snapshot-ов и auth-обвязки —
 * это preview, у него нет своей сессии. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-surface-subtle">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

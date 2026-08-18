"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  BarChart3,
  Megaphone,
  Film,
  Plug,
  Users,
  Settings,
} from "lucide-react";

/* 5 разделов из superagentslabs-стиля, тот же порядок что в проде Obelista.
 * Иконки — lucide-react (мы его уже используем в проде, держим консистент). */
const ITEMS = [
  { href: "/accounts",     label: "Accounts",     icon: Building2 },
  { href: "/analytics",    label: "Analytics",    icon: BarChart3 },
  { href: "/campaigns",    label: "Campaigns",    icon: Megaphone },
  { href: "/creatives",    label: "Creatives",    icon: Film },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/users",        label: "Users",        icon: Users },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[280px] bg-surface border-r border-line flex flex-col shrink-0 h-screen sticky top-0">
      {/* Лого — OBĒLISTA с фирменной чёрточкой под Ē */}
      <div className="h-16 flex items-center px-6 border-b border-line">
        <Link href="/creatives" className="logo text-[15px] text-ink">
          OB<span className="e">Ē</span>LISTA
        </Link>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-ink-faint">
          preview
        </span>
      </div>

      <nav className="flex-1 py-5 space-y-0.5 overflow-y-auto">
        <div className="nav-section-label">PAGES</div>
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item mx-3 ${active ? "active" : ""}`}
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer сайдбара — настройки + версия */}
      <div className="border-t border-line p-3 space-y-1">
        <button className="nav-item w-full mx-0">
          <Settings className="w-4 h-4" strokeWidth={2} />
          <span>Settings</span>
        </button>
        <div className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-ink-faint">
          v0.1.0 · build {new Date().toISOString().slice(0, 10)}
        </div>
      </div>
    </aside>
  );
}

"use client";

import { Search, Bell, Plus } from "lucide-react";

/* Топбар — 64px, sticky, разделитель border-b. Поиск, нотисы, primary CTA.
 * По приёмам superagentslabs: hover-цвет через transition-colors duration-300,
 * иконка нотисов меняет bg на subtle при hover. */
export function Topbar() {
  return (
    <header className="h-16 bg-surface border-b border-line flex items-center px-6 gap-4 sticky top-0 z-10">
      <div className="relative flex-1 max-w-md">
        <Search
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          strokeWidth={2}
        />
        <input
          type="text"
          placeholder="Поиск по кабинетам, крео, кампаниям…"
          className="input-base w-full pl-9 pr-12"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 mono text-[10px] text-ink-faint bg-surface-sunken border border-line px-1.5 py-0.5 rounded">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          className="toolbar-btn icon-only"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="w-4 h-4" strokeWidth={2} />
        </button>
        <button className="toolbar-btn primary">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Новый залив</span>
        </button>
      </div>
    </header>
  );
}

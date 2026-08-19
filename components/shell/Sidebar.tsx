"use client";

/* Левый сайдбар: листы панели + шаги конструктора.
 *
 * Липкий, во всю высоту, со своим скроллом — и сворачивается до колонки иконок
 * (состояние переживает перезагрузку, лежит в persist-сторе). Шаги показываются
 * только на /launch: на других листах прыгать по секциям формы некуда.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useStore } from "@/lib/store";
import { LEAVES } from "./leaves";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function Sidebar({ className }: { className?: string }) {
  const collapsed = useStore((s) => s.railCollapsed);
  const setCollapsed = useStore((s) => s.setRailCollapsed);
  const pathname = usePathname();

  return (
    <nav
      aria-label="Panel navigation"
      className={cn(
        "shrink-0 flex-col border-r border-border transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-[232px]",
        className
      )}
    >
      {/* min-h-0 — иначе flex-элемент не даёт себя сжать и скролл уезжает наружу. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!collapsed && <div className="microlabel px-3 pb-1.5">Pages</div>}
        <div className={cn("flex flex-col", collapsed ? "items-center gap-1" : "gap-0.5")}>
          {LEAVES.map((l) => {
            const on = pathname === l.href;
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                title={collapsed ? `${l.label} — ${l.hint}` : l.hint}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "focus-ring flex items-center rounded-lg text-sm outline-none transition-colors",
                  collapsed ? "size-9 justify-center" : "gap-2.5 px-3 py-1.5",
                  on
                    ? "bg-blue-100 text-neutral-900 dark:bg-blue-700/30 dark:text-neutral-100"
                    : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                )}
              >
                <Icon className={cn("size-4 shrink-0", on ? "text-primary-ink" : "opacity-70")} />
                {!collapsed && l.label}
              </Link>
            );
          })}
        </div>

        {/* Рейки из одиннадцати значков секций тут больше нет. Шаги связки
            принадлежат группе, а не панели целиком, поэтому они живут внутри
            листа «Аплоад» — там видно, какой группы это шаги. */}
      </div>

      <div className="border-t border-border p-2">
        {/* ВЫХОД. Клиент умел его с самого начала (`lib/auth.ts:logout`), а
            позвать было некому: кнопки не существовало нигде в панели. Человек,
            вошедший под своей учёткой, не мог из неё выйти — на чужом ноутбуке
            это не неудобство, а дыра.

            Стоит В САЙДБАРЕ, а не на листе учёток: выход нужен отовсюду, и
            искать его в разделе про других людей никто не станет.

            `replace`, а не `push`: кнопка «назад» после выхода не должна
            возвращать на страницу, куда уже не пускают. Ошибку не показываем и
            не удерживаем — сам `logout` считается удавшимся всегда, по тому же
            доводу, что записан рядом с ним: выйти обязано получаться в том
            числе тогда, когда выходить уже не из чего. */}
        <LogOutButton collapsed={collapsed} />

        {/* Политика — не лист панели, а сноска: в работе она не нужна ни разу,
            но адрес обязан существовать и быть достижимым, иначе приложение не
            подать ни на верификацию бизнеса, ни на App Review. Открываем
            отдельной вкладкой: у страницы нет ни сайдбара, ни дороги назад. */}
        {!collapsed && (
          <div className="mb-1 flex flex-col">
            <Link
              href="/privacy"
              target="_blank"
              className="focus-ring rounded-lg px-3 py-1 text-[11px] text-faint outline-none transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
            >
              Privacy policy
            </Link>
            <Link
              href="/terms"
              target="_blank"
              className="focus-ring rounded-lg px-3 py-1 text-[11px] text-faint outline-none transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
            >
              Terms of use
            </Link>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "focus-ring flex items-center rounded-lg text-xs text-muted-foreground outline-none transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800",
            collapsed ? "mx-auto size-9 justify-center" : "w-full gap-2 px-3 py-1.5"
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </nav>
  );
}

/** Выход из учётки. Отдельным компонентом, чтобы своё состояние занятости не
 *  тащить в сайдбар, который перерисовывается на каждом переходе. */
function LogOutButton({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const выйти = async () => {
    if (busy) return;
    setBusy(true);
    await auth.logout();
    /* На /login, а не на «/»: главная публичная, и человек решил бы, что вышел
       не до конца. Плюс `replace` — назад после выхода возвращаться некуда. */
    router.replace("/login");
  };

  return (
    <button
      type="button"
      onClick={() => void выйти()}
      disabled={busy}
      title="Sign out"
      aria-label="Sign out"
      className={cn(
        "focus-ring mb-1 flex items-center rounded-lg text-xs text-muted-foreground outline-none transition-colors hover:bg-neutral-100 hover:text-foreground disabled:opacity-50 dark:hover:bg-neutral-800",
        collapsed ? "mx-auto size-9 justify-center" : "w-full gap-2 px-3 py-1.5",
      )}
    >
      <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
      {!collapsed && (busy ? "Signing out…" : "Sign out")}
    </button>
  );
}

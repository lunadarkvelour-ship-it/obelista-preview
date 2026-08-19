"use client";

/** Нижняя панель для телефона: листы панели + шторка с шагами конструктора.
 *  На десктопе то же самое лежит слева в сайдбаре — на узком экране колонка не
 *  помещается. Шторка — RAC Modal со slide-up анимацией на data-entering/exiting. */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button as RacButton, Heading } from "react-aria-components";
import { List, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { SECTIONS } from "./sections-list";
import { LEAVES } from "@/components/shell/leaves";
import { cn } from "@/lib/utils";

/* Шапка внутри шторки стартера — заголовок + крестик. */
function SheetHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-1 pb-3">
      <Heading slot="title" className="text-base font-semibold">{title}</Heading>
      <Button variant="link" size="icon-sm" slot="close" aria-label="Close">
        <X size={16} />
      </Button>
    </div>
  );
}

export function MobileBar() {
  const [nav, setNav] = React.useState(false);
  const pathname = usePathname();

  const go = (id: string) => {
    setNav(false);
    // Шторка закрывается анимацией — скроллим после неё, иначе цель ещё под оверлеем.
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 220);
  };

  const btn =
    "focus-ring flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-xs outline-none transition-transform pressed:scale-[0.98]";

  return (
    <>
      <div className="surface-blur sticky bottom-0 z-30 flex gap-2 border-t border-border px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
        {LEAVES.map((l) => {
          const Icon = l.icon;
          const on = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? "page" : undefined}
              className={cn(btn, on && "border-primary-line bg-primary-soft text-foreground")}
            >
              <Icon className={cn("size-4", on ? "text-primary-ink" : "text-muted-foreground")} /> {l.label}
            </Link>
          );
        })}
        {/* Шаги нужны только там, где есть сама форма. */}
        {pathname === "/launch" && (
          <RacButton onPress={() => setNav(true)} className={cn(btn, "max-w-[68px] flex-none")} aria-label="Steps">
            <List className="size-4 text-primary-ink" />
          </RacButton>
        )}
      </div>

      <Sheet open={nav} onOpenChange={setNav} title="Steps">
        <SheetHeader title="Steps" />
        <nav className="flex flex-col pt-2">
          {SECTIONS.map((s) => (
            <RacButton
              key={s.id}
              onPress={() => go(s.id)}
              className="focus-ring flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm outline-none hover:bg-elevated pressed:bg-hover"
            >
              <span className="font-mono text-xs text-ghost">{s.idx}</span>
              {s.label}
            </RacButton>
          ))}
        </nav>
      </Sheet>
    </>
  );
}

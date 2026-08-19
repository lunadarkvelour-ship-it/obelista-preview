"use client";

import * as React from "react";
import {
  Button as RacButton,
  Disclosure as RacDisclosure,
  DisclosurePanel as RacDisclosurePanel,
} from "react-aria-components";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/coss";

/** Секция конструктора — ПЛОСКИЙ блок на RAC Disclosure: никаких коробок с
 *  тенями, иерархию несут хеирлайны между секциями (стиль Coinbase).
 *  Заголовок — крупный чёрный, номер — mono-синий. */
export function SectionCard({
  index,
  id,
  title,
  note,
  children,
}: {
  index: string;
  id: string;
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-section={id}
      /* mb, а не gap у родителя: на широком экране секции разложены в колонки
         (column-count), а там gap работает только МЕЖДУ колонками.
         break-inside-avoid — чтобы карточку не разрезало пополам. */
      className="mb-3 break-inside-avoid scroll-mt-20 rounded-xl border border-border bg-card px-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
    >
      <RacDisclosure defaultExpanded className="group">
        <h3 className="m-0">
          <RacButton
            slot="trigger"
            className="focus-ring flex w-full cursor-pointer items-center gap-2.5 rounded-md py-3 text-left outline-none"
          >
            <span className="tnum font-mono text-2xs tracking-wider text-primary-ink">{index}</span>
            <span className="font-heading text-lg font-semibold tracking-[-0.011em] text-foreground">{title}</span>
            {note && <span className="ml-auto text-xs font-normal text-muted-foreground">{note}</span>}
            <ChevronDown
              className={cn(
                "size-4 shrink-0 -rotate-90 text-ghost transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-expanded:rotate-0",
                note ? "ml-2" : "ml-auto"
              )}
            />
          </RacButton>
        </h3>
        <RacDisclosurePanel className="border-t border-border pb-3.5 pt-3.5">
          {/* gap-2.5, а не 3: на десяти секциях каждая лишняя ступень отступа
              стоит целого экрана прокрутки. */}
          <div className="flex flex-col gap-2.5 group-expanded:animate-pop-in">{children}</div>
        </RacDisclosurePanel>
      </RacDisclosure>
    </section>
  );
}

export function Row({ label, children, className, align = "center" }: {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: "center" | "start";
}) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", align === "center" ? "items-center" : "items-start", className)}>
      {/* На телефоне подпись встаёт СВЕРХУ на всю ширину: фиксированные 120px
          съедали половину экрана и рвали контент в столбик по одному чипу. */}
      {label !== undefined && (
        <Label className={cn("flex-[0_0_100%] sm:flex-[0_0_120px]", align === "start" && "sm:pt-2")}>{label}</Label>
      )}
      {children}
    </div>
  );
}

export function Hint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-faint", className)}>{children}</p>;
}

export function Grow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-[90px] flex-1", className)}>{children}</div>;
}

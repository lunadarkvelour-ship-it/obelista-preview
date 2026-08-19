"use client";

/** Чипы = TagGroup + Tag из tailwind-стартера: пилюли с рамкой, выбранный —
 *  синий, удаление крестиком. */
import * as React from "react";
import { TagGroup as RacTagGroup, Tag as RacTag } from "@/components/rac/TagGroup";
import { cn } from "@/lib/utils";

export interface TagItem {
  id: string;
  label: React.ReactNode;
}

export function TagChips({
  items,
  onPick,
  onRemove,
  ariaLabel,
  className,
  extra,
}: {
  items: TagItem[];
  onPick?: (id: string) => void;
  onRemove?: (id: string) => void;
  ariaLabel: string;
  className?: string;
  /** Хвостовой элемент в той же строке (напр. кнопка «ещё…»). */
  extra?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <RacTagGroup
        aria-label={ariaLabel}
        selectionMode={onPick ? "single" : "none"}
        selectedKeys={[]}
        onSelectionChange={(keys) => {
          const k = [...keys][0];
          if (k != null) onPick?.(String(k));
        }}
        onRemove={onRemove ? (keys) => [...keys].forEach((k) => onRemove(String(k))) : undefined}
        items={items}
        className="gap-0"
      >
        {(t: TagItem) => (
          <RacTag id={t.id} textValue={typeof t.label === "string" ? t.label : t.id}>
            {t.label}
          </RacTag>
        )}
      </RacTagGroup>
      {extra}
    </div>
  );
}

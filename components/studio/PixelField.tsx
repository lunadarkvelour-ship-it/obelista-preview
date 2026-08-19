"use client";

/** Поле пикселя — ComboBox стартера: печатаешь свой id или выбираешь из
 *  найденных на кабах профиля. Раньше это был нативный <datalist>, который в
 *  разных браузерах ведёт себя по-своему и не показывает имя пикселя рядом с id.
 *
 *  Наружу — прежний строковый контракт (value/onChange): "auto", id пикселя
 *  или что угодно, введённое руками. */
import * as React from "react";
import { ComboBox, ComboBoxItem } from "@/components/rac/ComboBox";
import { Text } from "react-aria-components";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface PixelOption {
  id: string;
  name: string;
  /** На скольких кабах профиля встречается — подсказка «этот основной». */
  accounts: number;
}

/** Пиксели профиля: собираются со всех его кабов, дубли схлопываются. */
export function useProfilePixels(): PixelOption[] {
  const profile = useStore((s) => s.form.profile);
  const snapshot = useStore((s) => s.snapshot);
  return React.useMemo(() => {
    const by = new Map<string, PixelOption>();
    (snapshot?.profiles?.[profile]?.accounts || []).forEach((a) =>
      (a.pixels || []).forEach((p) => {
        const cur = by.get(p.id);
        if (cur) cur.accounts += 1;
        else by.set(p.id, { id: p.id, name: p.name || p.id, accounts: 1 });
      })
    );
    // Самый распространённый пиксель — первым: обычно он и нужен.
    return [...by.values()].sort((a, b) => b.accounts - a.accounts || a.name.localeCompare(b.name));
  }, [snapshot, profile]);
}

const AUTO: PixelOption = { id: "auto", name: "auto — the engine picks", accounts: 0 };

export function PixelField({
  value,
  onChange,
  className,
  placeholder = "auto or id",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const pixels = useProfilePixels();
  const all = React.useMemo(() => [AUTO, ...pixels], [pixels]);

  // Фильтруем сами: искать надо и по имени, и по id, а RAC ищет только по
  // textValue. Когда в поле уже лежит выбранный id — показываем весь список.
  const items = React.useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q || all.some((p) => p.id === value)) return all;
    return all.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q));
  }, [all, value]);

  return (
    <ComboBox
      aria-label="Pixel"
      allowsCustomValue
      // Список открывается и по фокусу: пиксели надо видеть, не набирая ничего.
      menuTrigger="focus"
      placeholder={placeholder}
      items={items}
      inputValue={value}
      onInputChange={onChange}
      onSelectionChange={(k) => {
        if (k != null) onChange(String(k));
      }}
      className={cn("w-full min-w-0", className)}
    >
      {/* Пункт в две строки: поповер шириной с поле, в одну строку имя
          пикселя обрезалось до «agenc…». */}
      {(p: PixelOption) => (
        <ComboBoxItem id={p.id} textValue={p.id}>
          <Text slot="label" className="flex w-full min-w-0 flex-col">
            <span className="truncate">{p.name}</span>
            {p.id !== "auto" && (
              <span className="truncate font-mono text-2xs text-neutral-500 group-focus:text-white/70 dark:text-neutral-400">
                …{p.id.slice(-6)}
                {p.accounts > 1 && ` · on ${p.accounts} accounts`}
              </span>
            )}
          </Text>
        </ComboBoxItem>
      )}
    </ComboBox>
  );
}

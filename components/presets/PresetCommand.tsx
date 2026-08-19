"use client";

/** Палитра ⌘K = CommandPalette-паттерн из tailwind-стартера:
 *  Modal → Dialog → Autocomplete (SearchField + Menu).
 *
 *  Встроенных пресетов больше нет — в списке только свои. Сохранение и удаление
 *  ушли в менеджер (window.prompt угадывал имя по памяти и молча промахивался).
 *  Прыжок по секции работает с любого листа: сперва уводим на /launch. */
import * as React from "react";
import { Autocomplete, useFilter } from "react-aria-components";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/rac/Modal";
import { Dialog } from "@/components/rac/Dialog";
import { SearchField } from "@/components/rac/SearchField";
import { Menu, MenuItem, MenuSection } from "@/components/rac/Menu";
import { toast } from "@/components/ui/toast";
import { Bookmark, LayoutList, Settings2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { SECTIONS } from "@/components/studio/sections-list";
import { LEAVES } from "@/components/shell/leaves";
import { scopeLabel } from "@/lib/preset-scope";

export function PresetCommand({
  open,
  onOpenChange,
  onManage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onManage: () => void;
}) {
  const applyUser = useStore((s) => s.applyUserPreset);
  const userPresets = useStore((s) => s.userPresets);
  const { contains } = useFilter({ sensitivity: "base" });
  const router = useRouter();
  const pathname = usePathname();

  const close = () => onOpenChange(false);
  const jump = (id: string) => {
    close();
    if (pathname !== "/launch") router.push("/launch");
    // Ждём и закрытие модалки, и отрисовку листа — иначе цели ещё нет в DOM.
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      pathname !== "/launch" ? 300 : 80);
  };

  const names = Object.keys(userPresets);

  return (
    <Modal isDismissable isOpen={open} onOpenChange={onOpenChange} className="max-w-[min(90vw,560px)]">
      <Dialog aria-label="Presets and navigation" className="p-2">
        <Autocomplete filter={contains}>
          <SearchField autoFocus aria-label="Search presets and sections" placeholder="Preset, page, section…" />
          <Menu
            className="mt-2 max-h-[min(60vh,320px)] overflow-auto"
            renderEmptyState={() => (
              <div className="py-6 text-center text-sm text-muted-foreground">Nothing found.</div>
            )}
          >
            {names.length > 0 && (
              <MenuSection title="My presets">
                {names.map((n) => (
                  <MenuItem
                    key={n}
                    id={"my " + n}
                    textValue={"my " + n}
                    onAction={() => { applyUser(n); close(); toast.success("Preset: " + n); }}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="truncate">{n}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {scopeLabel(userPresets[n].scope)}
                      </span>
                    </span>
                  </MenuItem>
                ))}
              </MenuSection>
            )}

            <MenuSection title="Actions">
              <MenuItem
                id="manage presets"
                textValue="presets manage save delete rename"
                onAction={() => { close(); onManage(); }}
              >
                <Settings2 className="h-4 w-4" /> Presets: save and manage…
              </MenuItem>
            </MenuSection>

            <MenuSection title="Pages">
              {LEAVES.map((l) => (
                <MenuItem
                  key={l.href}
                  id={"leaf " + l.href}
                  textValue={"leaf " + l.label + " " + l.hint}
                  onAction={() => { close(); router.push(l.href); }}
                >
                  <l.icon className="h-4 w-4" /> {l.label}
                  <span className="text-xs text-muted-foreground">{l.hint}</span>
                </MenuItem>
              ))}
            </MenuSection>

            <MenuSection title="Sections">
              {SECTIONS.map((s) => (
                <MenuItem
                  key={s.id}
                  id={"section " + s.idx + " " + s.label}
                  textValue={"section " + s.idx + " " + s.label}
                  onAction={() => jump(s.id)}
                >
                  <LayoutList className="h-4 w-4" /> {s.idx} · {s.label}
                </MenuItem>
              ))}
            </MenuSection>
          </Menu>
        </Autocomplete>
      </Dialog>
    </Modal>
  );
}

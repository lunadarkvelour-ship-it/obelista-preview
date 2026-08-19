"use client";

/* Менеджер пресетов.
 *
 * Раньше сохранение и удаление жили на window.prompt: имя надо было вспомнить и
 * набрать точно, промах молча ничего не делал. Здесь список со своими кнопками
 * плюс выбор области — какие секции пресет вообще несёт.
 */

import * as React from "react";
import { Heading } from "react-aria-components";
import { Check, Pencil, Save, Trash2, X } from "lucide-react";
import { Modal } from "@/components/rac/Modal";
import { Dialog } from "@/components/rac/Dialog";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/coss";
import { Checkbox } from "@/components/coss";
import { useStore } from "@/lib/store";
import { ALL_SCOPE_IDS, SCOPE_GROUPS, scopeLabel } from "@/lib/preset-scope";

function Row({ name, fromGroup }: { name: string; fromGroup?: string }) {
  const preset = useStore((s) => s.userPresets[name]);
  const applyToForm = useStore((s) => s.applyUserPreset);
  const applyToGroup = useStore((s) => s.applyPresetToGroup);
  const rename = useStore((s) => s.renameUserPreset);
  const del = useStore((s) => s.deleteUserPreset);
  const save = useStore((s) => s.saveUserPreset);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(name);
  const [confirmDel, setConfirmDel] = React.useState(false);

  if (!preset) return null;

  const commitRename = () => {
    const to = draft.trim();
    setEditing(false);
    if (!to || to === name) return;
    rename(name, to);
    toast.success(`Renamed: ${to}`);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
      {editing ? (
        <>
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setDraft(name); setEditing(false); }
            }}
            className="min-h-8"
          />
          <Button size="icon-sm" variant="ghost" aria-label="Save name" onClick={commitRename}>
            <Check className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => { setDraft(name); setEditing(false); }}>
            <X className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <button
            type="button"
            /* Открыт из группы — применяем В группу. Иначе клик молча правил бы
               форму конструктора, а связка на экране оставалась прежней. */
            onClick={() => {
              if (fromGroup) applyToGroup(fromGroup, name);
              else applyToForm(name);
              toast.success("Preset: " + name);
            }}
            className="focus-ring min-w-0 flex-1 rounded-md text-left outline-none"
          >
            <div className="truncate text-sm">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{scopeLabel(preset.scope)}</div>
          </button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              save(name, preset.scope || ALL_SCOPE_IDS, fromGroup);
              toast.success("Overwritten: " + name);
            }}
          >
            Overwrite
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Rename" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          {confirmDel ? (
            <Button size="sm" variant="destructive" onClick={() => { del(name); toast.success("Deleted: " + name); }}>
              Confirm?
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete"
              onClick={() => {
                setConfirmDel(true);
                setTimeout(() => setConfirmDel(false), 3000);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** `fromGroup` — менеджер открыт с листа «Аплоад» из конкретной связки: и
 *  сохранение, и применение работают с формой ЭТОЙ группы, а не конструктора.
 *  `fromLabel` — её имя, чтобы человек видел, чей сетап уезжает в пресет. */
export function PresetManager({
  open,
  onOpenChange,
  fromGroup,
  fromLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fromGroup?: string;
  fromLabel?: string;
}) {
  const userPresets = useStore((s) => s.userPresets);
  const save = useStore((s) => s.saveUserPreset);
  const [name, setName] = React.useState("");
  const [scope, setScope] = React.useState<string[]>(ALL_SCOPE_IDS);

  const names = Object.keys(userPresets);
  const toggle = (id: string) =>
    setScope((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const doSave = () => {
    const n = name.trim();
    if (!n) return toast.error("Preset needs a name");
    if (!scope.length) return toast.error("Select at least one section");
    const exists = !!userPresets[n];
    save(n, scope, fromGroup);
    setName("");
    toast.success(exists ? "Overwritten: " + n : "Saved: " + n);
  };

  return (
    <Modal isDismissable isOpen={open} onOpenChange={onOpenChange} className="max-w-[min(92vw,620px)]">
      <Dialog aria-label="Presets">
        <Heading slot="title" className="display text-base">Presets</Heading>

        {fromLabel && (
          <p className="mt-1 text-xs text-muted-foreground">
            Bundle <b className="font-medium text-foreground">{fromLabel}</b> — saving and
            applying go to it.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {names.length ? (
            names.map((n) => <Row key={n} name={n} fromGroup={fromGroup} />)
          ) : (
            <p className="text-sm text-muted-foreground">Empty for now — save the current setup below.</p>
          )}
        </div>

        <div className="mt-5 rounded-lg border border-border p-3">
          <div className="microlabel pb-2">
            {fromLabel ? `Save bundle “${fromLabel}”` : "Save current"}
          </div>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSave()}
              placeholder="Preset name"
            />
            <Button onClick={doSave}>
              <Save className="size-4" /> Save
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="microlabel">What is included</div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setScope(ALL_SCOPE_IDS)}>all</Button>
              <Button size="sm" variant="ghost" onClick={() => setScope([])}>none</Button>
            </div>
          </div>
          {/* Область — главная разница со старым «сохранить всё»: пресет
              «только таргетинг» не должен тащить профиль и выбранные кабы. */}
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {SCOPE_GROUPS.map((g) => (
              <label key={g.id} className="inline-flex items-center gap-2 text-xs">
                <Checkbox checked={scope.includes(g.id)} onCheckedChange={() => toggle(g.id)} />
                {g.label}
              </label>
            ))}
          </div>
        </div>
      </Dialog>
    </Modal>
  );
}

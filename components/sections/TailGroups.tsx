"use client";

import { AnimatePresence, motion } from "motion/react";
import { useStore, EMPTY_ACCOUNTS, EMPTY_GROUPS } from "@/lib/store";
import { SectionCard, Hint } from "@/components/studio/fields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PixelField } from "@/components/studio/PixelField";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { parseIds } from "@/lib/build-spec";
import { listItem } from "@/lib/motion";

export function TailGroups() {
  const profile = useStore((s) => s.form.profile);
  const groups = useStore((s) => s.groups)[profile] ?? EMPTY_GROUPS;
  const catalog = useStore((s) => s.catalog)[profile] ?? EMPTY_ACCOUNTS;
  const addGroup = useStore((s) => s.addGroup);
  const addFromSel = useStore((s) => s.addGroupFromSelected);
  const updateGroup = useStore((s) => s.updateGroup);
  const deleteGroup = useStore((s) => s.deleteGroup);

  return (
    <SectionCard index="08b" id="groups" title="URL param groups" note="ad accounts + pixel + URL params = a separate bundle">
      <Hint>
        If groups are set, the upload runs BY GROUPS: each has its own ad accounts, pixel and URL params. Accounts: act_id
        or name substrings, comma-separated. The URL params and Pixel fields above are then ignored.
      </Hint>
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {groups.map((g, i) => {
            const n = parseIds(g.cabs, catalog).length;
            return (
              <motion.div
                key={i}
                layout
                variants={listItem}
                initial="hidden"
                animate="show"
                exit="exit"
                className="overflow-hidden rounded-lg border border-border bg-elevated p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <b className="font-mono text-xs">Group {i + 1}</b>
                    <span className="font-mono text-2xs text-primary-ink">accounts: {n}</span>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteGroup(i)} aria-label="Delete">
                    <X />
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="w-24 flex-none whitespace-nowrap">Accounts</Label>
                    <Input
                      className="flex-1 text-xs"
                      value={g.cabs}
                      onChange={(e) => updateGroup(i, "cabs", e.target.value)}
                      placeholder="act_111, act_222 or name substrings"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-24 flex-none whitespace-nowrap">Pixel</Label>
                    <PixelField
                      className="flex-1"
                      value={g.pixel}
                      onChange={(v) => updateGroup(i, "pixel", v)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-24 flex-none whitespace-nowrap">URL params</Label>
                    <Input
                      className="flex-1 text-xs"
                      value={g.tail}
                      onChange={(e) => updateGroup(i, "tail", e.target.value)}
                      placeholder="sub1={{campaign.id}}&..."
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={addFromSel}>
          <Plus /> group from selected accounts
        </Button>
        <Button variant="ghost" size="sm" onClick={() => addGroup()}>
          <Plus /> empty
        </Button>
      </div>
    </SectionCard>
  );
}

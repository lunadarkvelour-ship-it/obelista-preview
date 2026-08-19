"use client";

import * as React from "react";
import { FileTrigger } from "react-aria-components";
import { DropZone } from "@/components/rac/DropZone";
import { toast } from "@/components/ui/toast";
import { Upload } from "lucide-react";
import { useStore } from "@/lib/store";
import { Expandable } from "@/components/ui/disclosure";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/studio/fields";
import { parseSnapshot } from "@/lib/snapshot";
import { cn } from "@/lib/utils";

export function ImportTools() {
  const importSpec = useStore((s) => s.importSpec);
  const setSnapshot = useStore((s) => s.setSnapshot);
  const [spec, setSpec] = React.useState("");
  const [snap, setSnap] = React.useState("");

  const doImport = () => {
    try {
      let obj = JSON.parse(spec);
      if (Array.isArray(obj)) obj = obj[0] || {};
      importSpec(obj);
      toast.success("Spec loaded into the form");
    } catch {
      toast.error("Invalid JSON");
    }
  };

  const applySnapText = (text: string) => {
    try {
      setSnapshot(parseSnapshot(text));
      toast.success("Snapshot loaded");
    } catch (e) {
      toast.error("Invalid snapshot: " + (e as Error).message);
    }
  };

  const onFile = async (f?: File | null) => {
    if (!f) return;
    const text = await f.text();
    setSnap(text);
    applySnapText(text);
  };

  return (
    <div className="flex flex-col gap-2">
      <Expandable defaultOpen summary="Import JSON spec (paste and load into the form)">
        <div className="flex flex-col gap-2">
          <Textarea rows={5} value={spec} onChange={(e) => setSpec(e.target.value)} className="font-mono text-xs" /* Плейсхолдер без настоящего id: здесь стоял профиль владельца,
             выбывший 05.08, и подсказка учила несуществующему. Любой конкретный
             id тут — путь «только под одного человека», а у второго его нет. */
            placeholder='{"profiles":["<profile id>"], ...}' />
          <Button variant="ghost" size="sm" onClick={doImport} className="self-start">Load into form</Button>
        </div>
      </Expandable>
      <Expandable defaultOpen summary="Load snapshot (file or paste)">
        <div className="flex flex-col gap-2">
          {/* RAC DropZone: подсветка drop-target из коробки, файл можно и
              выбрать кнопкой (FileTrigger), и перетащить. */}
          <DropZone
            className={cn("w-full min-h-0 flex-col gap-2 p-4 text-sm")}
            getDropOperation={(types) => (types.has("application/json") || types.has("text/plain") ? "copy" : "cancel")}
            onDrop={async (e) => {
              const item = e.items.find((i) => i.kind === "file");
              if (item && item.kind === "file") onFile(await item.getFile());
            }}
          >
            <Upload className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Drop ui_snapshot.json here</span>
            <FileTrigger
              acceptedFileTypes={["application/json", ".json"]}
              onSelect={(files) => onFile(files?.[0])}
            >
              <Button variant="ghost" size="sm">…or choose a file</Button>
            </FileTrigger>
          </DropZone>
          <Textarea rows={3} value={snap} onChange={(e) => setSnap(e.target.value)} className="font-mono text-xs" placeholder="…or paste the snapshot JSON manually" />
          <Button variant="ghost" size="sm" onClick={() => applySnapText(snap)} className="self-start">Apply pasted</Button>
          <Hint>Drop or choose a file. Locally the panel fetches the snapshot itself; when hosted, load it here.</Hint>
        </div>
      </Expandable>
    </div>
  );
}

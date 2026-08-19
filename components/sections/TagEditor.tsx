"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/studio/fields";
import { X, Plus } from "lucide-react";

export function TagEditor() {
  const tags = useStore((s) => s.tags);
  const updatePrefix = useStore((s) => s.updateTagPrefix);
  const deleteTag = useStore((s) => s.deleteTag);
  const addTag = useStore((s) => s.addTag);
  const [key, setKey] = React.useState("");

  return (
    <div className="flex flex-col gap-2">
      {Object.keys(tags).map((k) => (
        <div key={k} className="flex items-center gap-2">
          <Input disabled value={k} className="h-8 flex-[0_0_90px] font-mono opacity-70" />
          <Input
            value={tags[k].prefix}
            onChange={(e) => updatePrefix(k, e.target.value)}
            placeholder="prefix--"
            className="h-8 flex-1 font-mono"
          />
          <Button variant="ghost" size="icon-sm" onClick={() => deleteTag(k)} aria-label="Delete">
            <X />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="tag key (e.g. agency)"
          className="h-8 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && key.trim()) {
              addTag(key.trim());
              setKey("");
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (key.trim()) {
              addTag(key.trim());
              setKey("");
            }
          }}
        >
          <Plus /> tag
        </Button>
      </div>
      {/* Раньше здесь было «тег запоминается за профилем»: это правда только для
          «Сетапа», где выбор тега пишется в привязку соца. У группы тег свой, и
          обещание чужого экрана читалось как поломка. */}
      <Hint>the prefix goes at the start of names; with an auto tag the key is looked up in the profile name</Hint>
    </div>
  );
}

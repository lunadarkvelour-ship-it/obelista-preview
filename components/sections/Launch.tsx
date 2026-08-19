"use client";

import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow, Hint } from "@/components/studio/fields";
import { SelectField } from "@/components/studio/control";
import { DateTimeField } from "@/components/ui/datetime";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import { ACTIVATE_OPTIONS, SPECIAL_CATS } from "@/lib/constants";

export function Launch() {
  const { form, set } = useFormScope();
  const actOpts = ACTIVATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  const catOpts = SPECIAL_CATS.map((c) => ({ value: c, label: c === "" ? "none" : c }));
  return (
    <SectionCard index="10" id="launch" title="Launch">
      <Row label="Activation">
        <Grow>
          <SelectField value={form.activate} onChange={(v) => set("activate", v)} options={actOpts} />
        </Grow>
      </Row>
      <Row label="Start time (FB)">
        <DateTimeField value={form.startTime} onChange={(v) => set("startTime", v)} className="flex-1" />
        {form.startTime && (
          <Button variant="ghost" size="icon-sm" onClick={() => set("startTime", "")} aria-label="Clear">
            <X />
          </Button>
        )}
      </Row>
      <Row label="">
        <Switch checked={form.startLocal} onCheckedChange={(v) => set("startLocal", v)}>
          <Hint>use each ad account’s own time zone (recommended)</Hint>
        </Switch>
      </Row>
      <Row label="Special category">
        <Grow>
          <SelectField value={form.specialCat} onChange={(v) => set("specialCat", v)} options={catOpts} />
        </Grow>
      </Row>
    </SectionCard>
  );
}

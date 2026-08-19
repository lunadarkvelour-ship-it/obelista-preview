"use client";

import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow, Hint } from "@/components/studio/fields";
import { SelectField } from "@/components/studio/control";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/coss";
import { Checkbox } from "@/components/ui/checkbox";
import { GENDERS, DEVICES, USER_OS } from "@/lib/constants";
import { osVersion } from "@/lib/build-spec";

export function Targeting() {
  const { form, set } = useFormScope();
  return (
    <SectionCard index="05" id="targeting" title="Targeting">
      <Row label="Geo">
        <Grow>
          <Input value={form.geo} onChange={(e) => set("geo", e.target.value)} placeholder="DZ, FR" />
        </Grow>
      </Row>
      <Row label="Age">
        <Grow className="max-w-[130px]">
          <Input type="number" min={18} max={65} value={form.ageMin} onChange={(e) => set("ageMin", Number(e.target.value) || 18)} />
        </Grow>
        <span className="text-muted-foreground">–</span>
        <Grow className="max-w-[130px]">
          <Input type="number" min={18} max={65} value={form.ageMax} onChange={(e) => set("ageMax", Number(e.target.value) || 65)} />
        </Grow>
      </Row>
      <Row label="Gender">
        <Grow>
          <SelectField value={form.gender} onChange={(v) => set("gender", v)} options={GENDERS} />
        </Grow>
        <Label className="flex-none whitespace-nowrap">Devices</Label>
        <Grow>
          <SelectField value={form.device} onChange={(v) => set("device", v)} options={DEVICES} />
        </Grow>
      </Row>
      <Row label="Device OS">
        <Grow>
          <div className="flex gap-2">
            <div className="flex-1">
              <SelectField value={form.userOs} onChange={(v) => set("userOs", v)} options={USER_OS} />
            </div>
            {form.userOs !== "all" && (
              <Input
                className="w-[130px]"
                value={form.osVer}
                onChange={(e) => set("osVer", e.target.value)}
                placeholder="min version, 14.0"
              />
            )}
          </div>
        </Grow>
      </Row>
      {form.userOs !== "all" && (
        /* Показываем то, что реально уедет в Мету: «14» панель приведёт к
           «14.0» — в живых заливах работала именно такая форма. */
        <Hint>
          version is the minimum, “and above” ({form.userOs}_ver_{osVersion(form.osVer) || "X.X"}_and_above).
          Empty — any version of this OS.
        </Hint>
      )}
      <Row label="Advantage+ audience">
        <Checkbox checked={form.advAud} onCheckedChange={(v) => set("advAud", !!v)}>
          <Hint>on (off by default — that is what we actually run)</Hint>
        </Checkbox>
      </Row>
    </SectionCard>
  );
}

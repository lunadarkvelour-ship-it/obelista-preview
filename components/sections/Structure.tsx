"use client";

import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow, Hint } from "@/components/studio/fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/coss";

export function Structure() {
  const { form, set } = useFormScope();
  const num = (v: string) => Math.max(1, Number(v) || 1);
  return (
    <SectionCard index="02" id="structure" title="Structure">
      <Row label="Campaigns/account">
        <Grow>
          <Input type="number" min={1} value={form.nCamp} onChange={(e) => set("nCamp", num(e.target.value))} />
        </Grow>
      </Row>
      <Row label="Ad sets/campaign">
        <Grow>
          <Input type="number" min={1} value={form.nAdset} onChange={(e) => set("nAdset", num(e.target.value))} />
        </Grow>
        <Label className="flex-none whitespace-nowrap">Ads/ad set</Label>
        <Grow>
          <Input type="number" min={1} value={form.nAd} onChange={(e) => set("nAd", num(e.target.value))} />
        </Grow>
      </Row>
      <Hint>Campaign–ad set–ad structure per ad account — e.g. 1×5×1 = 5 ad sets with 1 ad each.</Hint>
    </SectionCard>
  );
}

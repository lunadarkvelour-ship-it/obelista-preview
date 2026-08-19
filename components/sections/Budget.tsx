"use client";

import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow } from "@/components/studio/fields";
import { SelectField } from "@/components/studio/control";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/coss";
import { BUDGET_LEVELS, BID_STRATEGIES } from "@/lib/constants";

export function Budget() {
  const { form, set } = useFormScope();
  const showCap = form.bidStrategy !== "LOWEST_COST_WITHOUT_CAP";
  return (
    <SectionCard index="04" id="budget" title="Budget and bidding">
      <Row label="Level">
        <Grow>
          <SelectField value={form.budgetLevel} onChange={(v) => set("budgetLevel", v)} options={BUDGET_LEVELS} />
        </Grow>
        <Label className="flex-none whitespace-nowrap">$/day</Label>
        <Grow>
          <Input type="number" min={1} value={form.daily} onChange={(e) => set("daily", Number(e.target.value) || 0)} />
        </Grow>
      </Row>
      <Row label="Strategy">
        <Grow>
          <SelectField value={form.bidStrategy} onChange={(v) => set("bidStrategy", v)} options={BID_STRATEGIES} />
        </Grow>
        {showCap && (
          <Grow>
            <Input type="number" placeholder="bid cap $" value={form.cap} onChange={(e) => set("cap", e.target.value === "" ? "" : Number(e.target.value))} />
          </Grow>
        )}
      </Row>
    </SectionCard>
  );
}

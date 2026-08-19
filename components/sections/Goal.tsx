"use client";

import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow } from "@/components/studio/fields";
import { SelectField } from "@/components/studio/control";
import { PixelField } from "@/components/studio/PixelField";
import { Input } from "@/components/coss";
import { Label } from "@/components/coss";
import { OBJECTIVES, ATTRIBUTIONS, LOC_BY_OBJ, LOC_LABELS } from "@/lib/constants";

export function Goal() {
  const { form, set, patch, scope, goStep } = useFormScope();
  const inGroup = scope === "group";

  const locs = LOC_BY_OBJ[form.objective] || ["WEBSITE"];
  const locOpts = locs.map((l) => ({ value: l, label: LOC_LABELS[l] }));

  const onObjective = (v: string) => {
    const next = LOC_BY_OBJ[v] || ["WEBSITE"];
    patch({ objective: v, convLoc: next.includes(form.convLoc) ? form.convLoc : next[0] });
  };

  const isWeb = form.convLoc === "WEBSITE";
  const isForm = form.convLoc === "INSTANT_FORM";

  return (
    <SectionCard index="03" id="goal" title="Objective">
      <Row label="Objective">
        <Grow>
          <SelectField value={form.objective} onChange={onObjective} options={OBJECTIVES} />
        </Grow>
      </Row>
      <Row label="Conversion / goal">
        <Grow>
          <SelectField value={form.convLoc} onChange={(v) => set("convLoc", v)} options={locOpts} />
        </Grow>
      </Row>
      {isWeb && (
        <Row label="Pixel">
          <Grow>
            {/* В группе пиксель принадлежит кабинету, а не связке: кабы бывают
                от разных агентств. Поле здесь было вторым местом, где то же
                значение задаётся, — вместо него отсылка туда, где оно живёт. */}
            {inGroup ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Each ad account has its own —{" "}
                {goStep ? (
                  <button
                    onClick={() => goStep("cabs")}
                    className="text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground"
                  >
                    Ad accounts step
                  </button>
                ) : (
                  <span className="text-foreground">Ad accounts step</span>
                )}
              </p>
            ) : (
              <PixelField value={form.pixel} onChange={(v) => set("pixel", v)} />
            )}
          </Grow>
          <Label className="flex-none whitespace-nowrap">Event</Label>
          <Grow>
            <Input value={form.event} onChange={(e) => set("event", e.target.value)} placeholder="LEAD / PURCHASE" />
          </Grow>
        </Row>
      )}
      {isWeb && (
        <Row label="Attribution">
          <Grow>
            <SelectField value={form.attribution} onChange={(v) => set("attribution", v)} options={ATTRIBUTIONS} />
          </Grow>
        </Row>
      )}
      {isForm && (
        <Row label="form_id">
          <Grow>
            <Input value={form.formId} onChange={(e) => set("formId", e.target.value)} placeholder="lead form ID" />
          </Grow>
        </Row>
      )}
    </SectionCard>
  );
}

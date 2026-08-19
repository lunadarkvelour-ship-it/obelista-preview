"use client";

import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow, Hint } from "@/components/studio/fields";
import { SelectField } from "@/components/studio/control";
import { Checkbox, CheckboxGroup } from "@/components/coss";
import { Button } from "@/components/ui/button";
import { PLATFORMS } from "@/lib/constants";
import { PLACEMENTS, parsePositions, splitPositions } from "@/lib/placements";
import { cn } from "@/lib/utils";

const PLC_MODES = [
  { value: "manual", label: "manual" },
  { value: "auto", label: "Advantage+ (auto)" },
];

export function Placements() {
  const { form, set } = useFormScope();

  // Порядок платформ канонический (из PLATFORMS), что бы ни кликнули.
  const setPlats = (vals: string[]) => {
    const order = PLATFORMS.map((p) => p.value);
    set("plats", order.filter((p) => vals.includes(p)));
  };

  const chosen = parsePositions(form.positions);
  const toggle = (key: string) => {
    const next = chosen.includes(key) ? chosen.filter((x) => x !== key) : [...chosen, key];
    set("positions", next.join(", "));
  };

  /* Позиции выбираются словами, а в спеку уходят именами платформ: у Facebook
     лента `feed`, у Instagram — `stream`; рилсы `facebook_reels` против `reels`.
     Раньше здесь было поле ввода с плейсхолдером «feed, story, reels» — ровно
     та строка, которую FB отвергает на каждом адсете, и заливы падали целиком.
     Показываем перевод под чипсами: что выбрал — то и видно, чем оно станет. */
  const split = splitPositions(chosen);
  const shown = PLACEMENTS.map((p) => p.key);
  const expert = chosen.filter((t) => !shown.includes(t) && !split.unknown.includes(t));

  const preview = [
    form.plats.includes("facebook") && split.facebook.length ? `FB: ${split.facebook.join(", ")}` : "",
    form.plats.includes("instagram") && split.instagram.length ? `IG: ${split.instagram.join(", ")}` : "",
    form.plats.includes("messenger") && split.messenger.length ? `MSG: ${split.messenger.join(", ")}` : "",
    form.plats.includes("audience_network") && split.audience_network.length
      ? `AN: ${split.audience_network.join(", ")}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <SectionCard index="06" id="placements" title="Placements">
      <Row label="Mode">
        <Grow>
          <SelectField value={form.plcMode} onChange={(v) => set("plcMode", v)} options={PLC_MODES} />
        </Grow>
      </Row>
      {form.plcMode !== "auto" && (
        <>
          <Row label="Platforms">
            <CheckboxGroup aria-label="Platforms" value={form.plats} onChange={setPlats} className="flex-1">
              {PLATFORMS.map((p) => (
                <label key={p.value} className="inline-flex items-center gap-2 font-sans text-sm text-muted-foreground has-data-checked:text-foreground">
                  <Checkbox value={p.value} aria-label={p.label} className="text-muted-foreground data-checked:text-foreground" />
                  {p.label}
                </label>
              ))}
            </CheckboxGroup>
          </Row>
          <Row label="Positions" align="start">
            <Grow className="flex flex-wrap gap-1.5">
              {PLACEMENTS.map((p) => {
                const on = chosen.includes(p.key);
                const where = ([["FB", p.facebook], ["IG", p.instagram], ["MSG", p.messenger],
                                ["AN", p.audience_network]] as const)
                  .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ");
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => toggle(p.key)}
                    aria-pressed={on}
                    title={where}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors duration-150",
                      on
                        ? "border-primary-line bg-primary-soft text-primary-ink"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
              {/* Имена, написанные руками или приехавшие из старого пресета.
                  Показываем как есть: молча выбросить чужой выбор нельзя. */}
              {expert.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  className="rounded-md border border-primary-line bg-primary-soft px-2 py-1 font-mono text-2xs text-primary-ink"
                  title="raw FB position name — click to remove"
                >
                  {t}
                </button>
              ))}
            </Grow>
          </Row>
          {!!split.unknown.length && (
            <Hint className="text-destructive">
              not recognized: {split.unknown.join(", ")} — FB has no such position, it will not go into the spec
            </Hint>
          )}
          <Hint>
            {chosen.length
              ? preview || "none of the selected positions exist on the checked platforms — FB will use the full inventory"
              : "empty = full inventory of the selected platforms"}
          </Hint>
          <Row label="Quick">
            <Grow>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { set("plats", ["instagram"]); set("positions", ""); }}
              >
                full Instagram
              </Button>
            </Grow>
          </Row>
          <Hint>“full Instagram” = Instagram only, all of its placements. Facebook is not used.</Hint>
        </>
      )}
    </SectionCard>
  );
}

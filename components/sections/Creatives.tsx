"use client";

import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow, Hint } from "@/components/studio/fields";
import { SelectField } from "@/components/studio/control";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/coss";
import { Checkbox } from "@/components/coss";
import { CTAS, CREO_SOURCES } from "@/lib/constants";

export function Creatives() {
  const { form, set, scope, goStep } = useFormScope();
  const ctaOpts = CTAS.map((c) => ({ value: c, label: c }));
  const isFile = form.creoSrc === "file";
  return (
    <SectionCard
      index="08"
      id="creatives"
      title="Creatives"
      note={isFile ? "files from the ЗАЛИВЫ folder" : "video already on the ad account"}
    >
      <Row label="Source">
        <Grow>
          <SelectField value={form.creoSrc} onChange={(v) => set("creoSrc", v)} options={CREO_SOURCES} />
        </Grow>
      </Row>
      <Row label={isFile ? "Files" : "Video on account"} align="start">
        <Grow>
          <Textarea
            rows={5}
            value={form.videoLines}
            onChange={(e) => set("videoLines", e.target.value)}
            placeholder={
              isFile
                ? "one file name per line:\nrod1.png\nrod2.png\nrod35.mp4"
                : "one name (or substring) per line:\ndzilliastazhor1\ndzspy11\ndz7lip"
            }
          />
        </Grow>
      </Row>
      <Hint>
        {isFile
          ? "1 line = 1 creative. The engine finds the file by name in the ЗАЛИВЫ folder (any subfolder) and uploads it to every ad account. Images stay images — including in Reels."
          : "1 line = 1 creative (the engine finds the video by name substring on each ad account). Rotation across ad sets is automatic."}
      </Hint>
      {isFile && (
        <Row label="Static → video">
          <label className="inline-flex items-start gap-2 font-sans text-sm">
            <Checkbox
              checked={form.staticAsVideo}
              onCheckedChange={(v) => set("staticAsVideo", !!v)}
              className="mt-0.5"
            />
            <Hint>wrap images into 9:16 video (blurred background). Slow — only if video is really required; not needed for Reels</Hint>
          </label>
        </Row>
      )}
      <Row label="CTA">
        <Grow>
          <SelectField value={form.creoCta} onChange={(v) => set("creoCta", v)} options={ctaOpts} />
        </Grow>
      </Row>
      <Row label="Text">
        <Grow>
          <Input value={form.creoPt} onChange={(e) => set("creoPt", e.target.value)} placeholder="primary text (optional)" />
        </Grow>
      </Row>
      <Row label="Headline">
        <Grow>
          <Input value={form.creoHl} onChange={(e) => set("creoHl", e.target.value)} placeholder="headline (optional)" />
        </Grow>
      </Row>
      <Row label="URL params">
        <Grow>
          {/* Плейсхолдер про «группы ниже» остался от старой модели, где под
              формой жили хвост-группы. Групп ниже нет — есть кабинеты. */}
          <Input value={form.creoUrl} onChange={(e) => set("creoUrl", e.target.value)} placeholder="one for all creatives in the bundle" />
        </Grow>
      </Row>
      {scope === "group" && (
        <Hint>
          an individual ad account can have its own —{" "}
          <button
            onClick={() => goStep?.("cabs")}
            className="underline decoration-border underline-offset-4 transition-colors duration-150 hover:text-foreground hover:decoration-foreground"
          >
            Ad accounts step
          </button>
        </Hint>
      )}
    </SectionCard>
  );
}

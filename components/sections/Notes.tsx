"use client";

/* Указания к связке — единственное поле панели, которое движок не исполняет.
 *
 *  Заведено потому, что места для прозы не было вовсе, и её писали в имена
 *  файлов крео: в живой связке от 09.08 рядом с `dz5` и `dz2` лежали «Там 4
 *  крео в папке from ffmpeg script» и «по 1 кампании на каб ставим». Движок
 *  обязан читать `creatives[].file` как имя файла — такая спека валидацию
 *  пройти не может по определению.
 *
 *  Поэтому текст уезжает отдельным ключом `notes`, а поле стоит последним
 *  шагом: его пишут, уже увидев собранную связку, перед тем как копировать
 *  промпт. */

import { useFormScope } from "@/components/studio/form-scope";
import { SectionCard, Row, Grow, Hint } from "@/components/studio/fields";
import { Textarea } from "@/components/coss";

export function Notes() {
  const { form, set } = useFormScope();
  return (
    <SectionCard index="11" id="notes" title="Notes" note="free text">
      <Row label="For the model" align="start">
        <Grow>
          <Textarea
            rows={4}
            /* `?? ""` — поле появилось позже остальных, и в localStorage лежат
               группы, собранные до него: без этого React ронял бы поле из
               управляемого в неуправляемое на первой же букве. */
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={
              "anything to say in words, for example:\n"
              + "creatives are in the from ffmpeg script folder\n"
              + "1 ad set = 1 creative, no rotation"
            }
          />
        </Grow>
      </Row>
      <Hint>
        Goes into the spec as a separate key (<code>notes</code>) and is printed in the prompt.
        The engine does NOT execute or validate it — this is context for the model. Do not put
        creative names here: they belong on the Creatives step, where the engine uses them to find files.
      </Hint>
    </SectionCard>
  );
}

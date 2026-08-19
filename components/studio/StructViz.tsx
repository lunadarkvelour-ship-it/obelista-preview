"use client";

import { motion } from "motion/react";
import { NumberTicker } from "@/components/magic/number-ticker";
import { useBuilder } from "./useBuilder";
import { EASE } from "@/lib/motion";

export function StructViz() {
  const { resolved: s, meta } = useBuilder();
  const maxC = Math.min(s.nCamp, 6);
  const maxA = Math.min(s.nAdset, 8);
  const maxD = Math.min(s.nAd, 6);
  const key = `${s.nCamp}-${s.nAdset}-${s.nAd}`;

  return (
    <div className="flex items-stretch gap-4 rounded-sm border border-border bg-card p-4">
      <div className="flex flex-[0_0_auto] flex-col justify-center">
        <div className="text-[42px] font-semibold leading-none tracking-tight">
          <NumberTicker value={meta.perCab} />
        </div>
        <span className="mt-1.5 font-mono text-2xs uppercase leading-tight tracking-wider text-faint">
          objects
          <br />/ ad account
        </span>
      </div>
      <div key={key} className="flex flex-1 gap-2 overflow-x-auto pb-1">
        {Array.from({ length: maxC }).map((_, c) => (
          <div key={c} className="flex flex-[0_0_auto] min-w-[74px] flex-col gap-1.5 rounded-lg border border-border-strong bg-input p-1.5">
            <div className="text-center font-mono text-2xs tracking-wide text-primary-ink">C{c + 1}</div>
            {Array.from({ length: maxA }).map((_, a) => (
              <div key={a} className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-1.5 py-1">
                <span className="font-mono text-2xs text-ghost">A{a + 1}</span>
                <div className="flex flex-wrap gap-0.5">
                  {Array.from({ length: maxD }).map((_, d) => (
                    <motion.i
                      key={d}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.85 }}
                      transition={{ duration: 0.25, ease: EASE, delay: (c * maxA * maxD + a * maxD + d) * 0.006 }}
                      // -ink, а не -primary: точка 5px должна читаться на
                      // светлой плашке адсета, светлый лайм на ней пропадает.
                      className="block size-[5px] rounded-full bg-primary-ink"
                    />
                  ))}
                  {s.nAd > maxD && <u className="font-mono text-2xs not-italic text-ghost">+{s.nAd - maxD}</u>}
                </div>
              </div>
            ))}
            {s.nAdset > maxA && <div className="text-center font-mono text-2xs text-ghost">+{s.nAdset - maxA} adsets</div>}
          </div>
        ))}
        {s.nCamp > maxC && (
          <div className="flex flex-[0_0_auto] min-w-[56px] items-center justify-center text-center font-mono text-2xs text-ghost">
            +{s.nCamp - maxC}
            <br />camps.
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/* Полоска-итог внизу листа /launch.
 *
 * Предпросмотр уехал на отдельный лист, но собирая связку хочется видеть, что
 * из неё получается, и не ходить за этим на другую страницу. Здесь — только
 * счёт, тон запуска, предупреждения и копирование; разбор целиком на /preview.
 */

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useBuilder } from "./useBuilder";
import { copyText, outputText } from "@/lib/output";
import { spring } from "@/lib/motion";
import { PAGE_PAD, PAGE_PAD_NEG } from "@/components/shell/page";
import { cn } from "@/lib/utils";

export function SummaryBar() {
  const { resolved: s, meta, built } = useBuilder();
  const [copied, setCopied] = React.useState(false);
  const tone = meta.activation.tone === "danger" ? "danger" : meta.activation.tone === "warning" ? "warning" : "success";

  const copy = async () => {
    await copyText(outputText(built, "txt"));
    setCopied(true);
    toast.success("Bundle copied");
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    // На телефоне снизу уже стоит бар с листами — две липкие полосы съедали бы
    // треть экрана. Итог там смотрят на листе «Превью».
    <div className={cn("surface-blur sticky bottom-0 z-20 mt-1 hidden border-t border-border py-2.5 lg:block", PAGE_PAD_NEG, PAGE_PAD)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs text-muted-foreground">
          {meta.nCabs} · <b className="text-foreground">{s.nCamp}×{s.nAdset}×{s.nAd}</b> = {meta.perCab} objects/account
        </span>
        {/* Тот же режим запуска, что и на «Превью», и подан так же: точка
            цвета плюс обычная строка. Красная плашка капсом читалась как
            ошибка, хотя это выбранный юзером режим. */}
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "size-1.5 flex-none rounded-full",
              tone === "danger" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success",
            )}
          />
          <span className={tone === "danger" ? "text-destructive" : "text-foreground"}>
            {meta.activation.label.toLowerCase()}
          </span>
        </span>

        {meta.warnings.length > 0 && (
          <Link
            href="/preview"
            className="focus-ring flex items-center gap-1.5 rounded-md text-xs text-warning outline-none hover:underline"
          >
            <TriangleAlert className="size-3.5" />
            {meta.warnings.length} warning{meta.warnings.length === 1 ? "" : "s"}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/preview"
            className="focus-ring rounded-md text-xs text-muted-foreground outline-none hover:text-foreground"
          >
            Preview →
          </Link>
          <Button size="sm" variant={copied ? "success" : "default"} onClick={copy}>
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="ok"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={spring}
                  className="flex items-center gap-1.5"
                >
                  <Check className="size-3.5" /> Copied
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                  <Copy className="size-3.5" /> Copy bundle
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>
    </div>
  );
}

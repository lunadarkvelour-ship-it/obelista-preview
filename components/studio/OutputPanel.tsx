"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "@/components/ui/toast";
import { Check, Copy } from "lucide-react";
import { Tabs, TabList, TabPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useBuilder } from "./useBuilder";
import { spring } from "@/lib/motion";
import { copyText, outputText, type OutputTab } from "@/lib/output";

export function OutputPanel() {
  const { built } = useBuilder();
  const [tab, setTab] = React.useState<OutputTab>("txt");
  const [copied, setCopied] = React.useState(false);

  const text = outputText(built, tab);

  const copy = async () => {
    await copyText(text);
    setCopied(true);
    toast.success(tab === "txt" ? "Bundle copied" : "JSON copied");
    setTimeout(() => setCopied(false), 1200);
  };

  const out = (
    <pre className="max-h-[42vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-elevated/60 p-3.5 font-mono text-xs leading-relaxed text-foreground/90">
      {text}
    </pre>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <Tabs value={tab} onChange={(v) => setTab(v as OutputTab)}>
        <TabList
          idBase="outtab"
          ariaLabel="Output format"
          current={tab}
          items={[
            { id: "txt", label: "Bundle · text" },
            { id: "json", label: "JSON spec" },
          ]}
        />
        <TabPanel id="txt">{tab === "txt" && out}</TabPanel>
        <TabPanel id="json">{tab === "json" && out}</TabPanel>
      </Tabs>
      <Button onClick={copy} variant={copied ? "success" : "default"} className="w-full">
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={spring} className="flex items-center gap-2">
              <Check className="size-4" /> Copied
            </motion.span>
          ) : (
            <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
              <Copy className="size-4" /> Copy {tab === "txt" ? "bundle" : "JSON"}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
      {/* Подсказки «вставь в новое окно Claude Desktop → plan → го» тут больше
          нет: она объясняла ритуал конкретного инструмента, а спека уезжает в
          любой, и оператор этот путь и так проходит каждый день. */}
    </div>
  );
}

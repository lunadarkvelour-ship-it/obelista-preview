"use client";

/* Лист «Сетап» — сам конструктор связки. Раньше это была середина одной большой
   страницы; предпросмотр и импорты переехали на свои листы.

   Секции разложены в колонки (column-count), а не в грид: карточки разной
   высоты, и в гриде строка равнялась бы по самой длинной — под короткими
   зияли бы дыры. Колонки набиваются плотно и сохраняют порядок 01→10
   сверху вниз в каждой колонке. */

import { useStore } from "@/lib/store";
import { TagChips } from "@/components/ui/tag-group";
import { ProfileAccounts } from "@/components/sections/ProfileAccounts";
import { Structure } from "@/components/sections/Structure";
import { Goal } from "@/components/sections/Goal";
import { Budget } from "@/components/sections/Budget";
import { Targeting } from "@/components/sections/Targeting";
import { Placements } from "@/components/sections/Placements";
import { PageOffer } from "@/components/sections/PageOffer";
import { Creatives } from "@/components/sections/Creatives";
import { TailGroups } from "@/components/sections/TailGroups";
import { Naming } from "@/components/sections/Naming";
import { Launch } from "@/components/sections/Launch";
import { Notes } from "@/components/sections/Notes";
import { SummaryBar } from "@/components/studio/SummaryBar";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import { cn } from "@/lib/utils";

/** Свои пресеты быстрым доступом. Встроенных больше нет — панель открывается на
 *  стартовом состоянии, а чипсы показывают то, что сохранил сам оператор. */
function PresetChips() {
  const userPresets = useStore((s) => s.userPresets);
  const apply = useStore((s) => s.applyUserPreset);
  const names = Object.keys(userPresets);

  if (!names.length) {
    return (
      <p className="text-xs text-faint">
        No presets yet — build a bundle and save it with ⌘K.
      </p>
    );
  }
  return <TagChips ariaLabel="My presets" items={names.map((n) => ({ id: n, label: n }))} onPick={apply} />;
}

export function LaunchView() {
  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-5")}>
      <div className="pb-3">
        <PresetChips />
      </div>
      {/* Фазы (Setup / Target & Creative / Launch) размечены только в сайдбаре:
          в канвасе они дублировали нумерацию секций. */}
      <div className="gap-x-5 xl:columns-2 3xl:columns-3">
        <ProfileAccounts />
        <Structure />
        <Goal />
        <Budget />
        <Targeting />
        <Placements />
        <PageOffer />
        <Creatives />
        <TailGroups />
        <Naming />
        <Launch />
        <Notes />
      </div>
      <SummaryBar />
    </div>
  );
}

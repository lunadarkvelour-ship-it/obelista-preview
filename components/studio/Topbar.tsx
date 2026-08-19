"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { Logo } from "@/components/brand/Logo";

export function Topbar() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  return (
    <header className="surface-blur sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        {/* Логотип владельца целиком, одним элементом. Прежде здесь стояли ДВА
            знака рядом — квадратный глиф и слово, оба нарисованные от руки, пока
            настоящего логотипа не было. Теперь он есть, и в нём кружок «o» —
            часть подписи, а не отдельная деталь: ставить перед ним ещё один
            кружок значит показать букву дважды.

            20px, а не 15px как у прежнего слова: у того рядом стоял квадратный
            глиф в 32px и держал вес шапки на себе. Подпись осталась одна, и в
            прежнем размере она читалась бы как подпись под чем-то, а не как имя
            продукта. Владелец про старую шапку сказал «его вообще не видно». */}
        <Logo className="h-5 w-auto flex-none text-foreground" />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Свежесть снапшота и кнопка обновления уехали на лист «Кабинеты».
            Здесь они стояли на всех листах, а обновляют ровно один: на
            аналитике своя отметка и свой конвейер, и общая шапка заставляла
            гадать, к чему относится «1 мин». Пресеты уехали туда же и по той
            же причине — управление стоит там, где оно действует. */}

        {/* Свотчи акцента убраны 10.08 решением владельца: акцент один,
            фиолетовый. Три цвета на выбор — это настройка, которую делают
            один раз, а место в шапке она занимает всегда; плюс каждый акцент
            тянул за собой свою ветку в теме. Осталась одна кнопка, которую
            действительно жмут — светлая/тёмная. */}
        <Tip content={theme === "dark" ? "Light theme" : "Dark theme"} placement="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </Tip>
      </div>
    </header>
  );
}

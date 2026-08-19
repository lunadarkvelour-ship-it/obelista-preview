"use client";

/* Пустой лист кабинетов — один текст и одно поведение на все листы, которые
 * показывают кабинеты.
 *
 * ПОЧЕМУ общий компонент, а не свой на каждом листе. Писался он на пару
 * листов-близнецов (второй, «Agencies», снесён 14.08.2026 по требованию
 * владельца): один и тот же набор кабинетов, разная только раскладка. Два
 * одинаковых по смыслу пустых состояния расходятся при первой же правке
 * одного из них, и дальше человек читает на соседних листах два разных
 * объяснения одного факта. Потребитель сегодня один, но причина держать текст
 * отдельно от разметки листа от этого не изменилась.
 *
 * ПОЧЕМУ текст сменился. Раньше здесь было «нет снимка — проверь, что запущен
 * фоновый сбор, или собери кнопкой». На сервере это инструкция НАВСЕГДА
 * неверная, а не «пока пусто»: данные с машины оператора туда не уезжают
 * (решение 26 плана переезда), локального сбора у арендатора нет, чинить
 * нечего. Человек с чистой панелью первым делом пошёл бы чинить то, чего у
 * него не существует.
 *
 * ПОЧЕМУ развилка по списку профилей, а не по флагу «я в облаке». Флаг
 * забудут выставить, и панель соврёт ровно там, где её лечат. Живые профили
 * антидетекта видны только с машины оператора — значит непустой список и есть
 * признак «кнопка сбора здесь действительно что-то делает». Тот же приём, что
 * на самом листе кабинетов: развилка по факту, а не по режиму.
 *
 * `useAntik` зовётся здесь свой, хотя оба листа уже зовут его сверху. Так
 * пустое состояние остаётся верным независимо от того, кто его нарисовал:
 * булев проп «показать кнопку» — ровно то, что в двух местах передают
 * по-разному. Лишний запрос уходит на странице, где больше нечего показывать.
 */

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Button } from "@/components/coss";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import { useAntik } from "@/lib/use-antik";
import { RefreshButton } from "./RefreshButton";
import { cn } from "@/lib/utils";

export function NoAccounts() {
  const router = useRouter();
  const pulling = useStore((s) => s.sync.pulling);
  const antik = useAntik();
  const местный = antik.profiles.length > 0;

  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-16 text-center")}>
      <p className="text-sm font-medium">No ad accounts yet</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
        Ad accounts come from Meta. Connect a Facebook account on the Profiles page — the ad
        accounts it can reach show up here.
      </p>
      <Button className="mt-3" onClick={() => router.push("/socials")}>
        Go to profiles
      </Button>

      {местный && (
        <>
          <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-faint">
            {pulling
              ? "Collecting ad accounts from the profiles open on this machine. A full pass "
                + "takes minutes — wait it out, stopping halfway would show only part of them."
              : "Profiles are open on this machine — their ad accounts can be collected right "
                + "here. A full pass takes minutes."}
          </p>
          <div className="mt-2 flex justify-center">
            <RefreshButton />
          </div>
        </>
      )}
    </div>
  );
}

"use client";

/* Лист «Превью» — последний шаг: один промпт на весь залив.
 *
 *  Раньше здесь лежала одна связка одного профиля. Теперь — бандл: по записи на
 *  (группа × соц), потому что движок резолвит кабинеты внутри профиля и группу
 *  с четырёх соцев одной спекой не зальёшь.
 */

import * as React from "react";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStore, buildCtx } from "@/lib/store";
import { Button } from "@/components/coss";
import { Tabs, TabList, TabPanel } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import {
  buildBundle, bundleDiffs, bundleJson, bundleText, membersByStatus, missingOf, nBundles,
  nCabs, nGroups, nObjects, survivedObjects,
} from "@/lib/groups";
import { snapshotStamp } from "@/lib/build-spec";
import { copyText } from "@/lib/output";
import { PoweredWith } from "@/components/brand/PoweredWith";
import { AttentionChips } from "@/components/sections/health-bits";
import { cn } from "@/lib/utils";

export function PreviewView() {
  const router = useRouter();
  const groups = useStore((s) => s.cabGroups);
  const state = useStore((s) => s);
  const [tab, setTab] = useState<"txt" | "json">("txt");
  const [copied, setCopied] = useState(false);

  const { items, text, json, stamp } = useMemo(() => {
    const ctx = buildCtx(state);
    const its = buildBundle(groups, ctx);
    return {
      items: its,
      text: bundleText(groups, ctx),
      json: JSON.stringify(bundleJson(its, snapshotStamp(ctx)), null, 2),
      stamp: snapshotStamp(ctx),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, state.tags, state.catalog, state.snapshot]);

  const diffs = useMemo(() => bundleDiffs(items), [items]);
  const notReady = groups.filter((g) => missingOf(g, state.snapshot).length);
  /* Группы, у которых есть кабы на ревью / с неопознанным статусом / вне
     снапшота. Отдельно от notReady: это не блокирует, а буквально то, что
     `membersByStatus` уже считает, но до сих пор нигде не показывалось —
     превью, последний экран перед копированием, молчало об этом полностью. */
  const attention = groups
    .map((g) => ({ g, st: membersByStatus(g, state.snapshot) }))
    .filter(({ st }) => st.review.length || st.unclear.length || st.missing.length);
  const totalCabs = items.reduce((n, i) => n + i.accounts.length, 0);
  // Тем же способом, что и шапка промпта ниже (`bundleText`), а не отдельной
  // формулой по всему составу групп — иначе экран и промпт под ним спорят
  // друг с другом на первом же мёртвом кабе.
  const totalObjects = survivedObjects(items, groups);
  const out = tab === "txt" ? text : json;

  /* Отказ живёт В ФУНКЦИИ, а не только на кнопке. Выключенная кнопка — это
     вид; вызвать `copy()` можно и мимо неё (горячая клавиша, повторный рендер,
     следующая правка разметки). Прошлая версия этой защиты была ровно такой —
     надпись без механизма, — и мёртвый каб уезжал в спеку. */
  async function copy() {
    if (notReady.length) return;
    await copyText(out);
    setCopied(true);
    toast.success(tab === "txt" ? "Prompt copied" : "JSON copied");
    setTimeout(() => setCopied(false), 1200);
  }

  if (!items.length) {
    // Пустой items значит одно из двух: в группах физически нет кабов, либо
    // они есть, но buildBundle отфильтровал их все как мёртвые — до правки
    // экран говорил первое всегда, даже когда кабы есть и просто забанены.
    const hasMembers = groups.some((g) => g.members.length);
    return (
      <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-16 text-center")}>
        <p className="text-sm font-medium">Nothing to build</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          {hasMembers
            ? "Every ad account in every group is disabled. Nothing survives to upload."
            : "No group has any ad accounts. Go back to accounts and build a group."}
        </p>
        <Button className="mt-3" onClick={() => router.push("/accounts")}>
          Go to accounts
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-5")}>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <Button variant="ghost" size="xs" onClick={() => router.push("/upload")}>
          <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
          upload
        </Button>
        <h1 className="font-heading text-sm font-semibold">Preview</h1>
        <span className="tnum text-xs text-muted-foreground">
          {nBundles(items.length)} · {nGroups(groups.length)} · {nCabs(totalCabs)} ·{" "}
          {nObjects(totalObjects)}
        </span>
      </div>

      {!!notReady.length && (
        <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive-soft px-3.5 py-2.5">
          {/* Было «N will upload incomplete» — панель обещала залить неполное и
              оставляла кнопку рабочей. Теперь это блокировка, и текст обязан
              говорить именно это, иначе человек будет искать, где нажать. */}
          <p className="text-xs font-medium text-destructive">
            {nGroups(notReady.length)} blocked — upload is disabled until fixed
          </p>
          <ul className="mt-1 space-y-0.5">
            {notReady.map((g) => (
              <li key={g.id} className="text-2xs text-destructive/90">
                {g.name}: missing {missingOf(g, state.snapshot).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Тон предупреждающий, не destructive — это другой разговор, чем блок
          выше. Он не держит копирование: каб на ревью или вне снапшота уже
          уедет в spec.accounts, здесь только «посмотри, прежде чем отправлять». */}
      {!!attention.length && (
        <div className="mb-3 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5">
          <p className="text-xs font-medium text-warning">
            {nGroups(attention.length)} with ad accounts worth a second look — upload is not blocked
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {attention.map(({ g, st }) => (
              <li key={g.id} className="text-2xs">
                <span className="font-medium text-foreground">{g.name}</span>
                <AttentionChips st={st} className="mt-0.5" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="border-b border-border px-3 py-2">
            <h2 className="microlabel text-2xs text-muted-foreground">what goes out</h2>
          </header>
          <ol className="divide-y divide-border">
            {/* Ключ с номером, а не «группа:соц»: группа с кабами разных
                агентств даёт НЕСКОЛЬКО связок на одном соце — по одной на
                пиксель/ссылку/хвост. Пара «группа+соц» перестала быть уникальной. */}
            {items.map((it, n) => (
              <li key={`${it.group}:${it.profile}:${n}`} className="px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="tnum text-2xs text-faint">
                    {String(n + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-sm">{it.group}</span>
                </div>
                <p className="tnum pl-6 text-2xs text-muted-foreground">
                  {it.profile} · {nCabs(it.accounts.length)}
                </p>
                {/* Чем эта связка отличается от соседней по той же группе —
                    иначе две одинаковые строки читаются как дубль. */}
                {!!diffs[n] && (
                  <p className="truncate pl-6 font-mono text-2xs text-faint" title={diffs[n]}>
                    {diffs[n]}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <footer className="border-t border-border px-3 py-2">
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Bundles run one at a time: parallel jobs fight over the same profile browser.
              {stamp && ` Snapshot from ${stamp}.`}
            </p>
          </footer>
        </section>

        <section className="flex flex-col gap-2.5">
          <Tabs value={tab} onChange={(v) => setTab(v as "txt" | "json")}>
            <TabList
              ariaLabel="Output format"
              items={[
                { id: "txt", label: "Prompt" },
                { id: "json", label: "Bundle JSON" },
              ]}
            />
            <TabPanel id="txt">
              {tab === "txt" && <Out text={out} />}
            </TabPanel>
            <TabPanel id="json">
              {tab === "json" && <Out text={out} />}
            </TabPanel>
          </Tabs>
          {/* ── Пусковая панель ─────────────────────────────────────────────
              Это не «ещё одна кнопка внизу формы», а место, где работа уходит
              из инструмента в чат. Поэтому здесь три вещи и ровно в таком
              порядке: что уедет, куда вставлять, чем забрать.

              Кнопка собрана разметкой, а не вариантом стартера: `variant` тянет
              за собой чужие отступы и фон, и на широком блоке фон отрисовывался
              поверх подписи — кнопка выглядела сломанной. Здесь ширина, фон и
              содержимое заданы явно и ни от чего не зависят. */}
          <div
            className="mt-3 flex flex-col gap-3 rounded-xl border border-primary-line
                       bg-primary-soft/40 p-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="tnum text-[13px] font-medium text-foreground">
                {tab === "txt"
                  ? `${nObjects(totalObjects)} across ${nCabs(totalCabs)} · ${nBundles(items.length)}`
                  : "Full JSON with the spec of every bundle"}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {tab === "txt"
                  ? "Paste it into the chat and say “go” — the model follows the protocol and stops if the spec does not add up."
                  : "The JSON is for inspecting or fixing a spec by hand. The upload itself runs from the prompt."}
              </p>
            </div>

            <PoweredWith className="flex-none" />

            <button
              type="button"
              onClick={copy}
              disabled={!!notReady.length}
              title={notReady.length ? "Fix the blocked groups first" : undefined}
              aria-live="polite"
              className={cn(
                "focus-ring flex h-10 flex-none items-center justify-center gap-2 rounded-lg px-5",
                "text-[13px] font-medium text-primary-foreground",
                "transition-[background-color,transform] duration-150 ease-out active:scale-[0.98]",
                copied ? "bg-success" : "bg-primary hover:bg-primary-hover",
                notReady.length && "cursor-not-allowed opacity-40 hover:bg-primary active:scale-100",
              )}
            >
              {copied ? (
                <>
                  <Check className="size-4 flex-none" strokeWidth={2.4} aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4 flex-none" strokeWidth={2} aria-hidden />
                  Copy {tab === "txt" ? "prompt" : "JSON"}
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Out({ text }: { text: string }) {
  return (
    /* Рамка акцентная, а не нейтральная. Это не украшение: на экране решения
       текст промпта — единственное, что уедет наружу, и он обязан читаться как
       готовый к отправке объект, а не как ещё одно поле формы. Акцент здесь
       появляется ровно один раз и совпадает с цветом кнопки, которая его
       забирает. */
    <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-primary-line bg-elevated/60 p-3.5 font-mono text-xs leading-relaxed text-foreground/90 shadow-[0_0_0_3px_var(--primary-soft)]">
      {text}
    </pre>
  );
}

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "@/components/ui/toast";
import { RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionCard, Row, Grow, Hint } from "@/components/studio/fields";
import { SelectField } from "@/components/studio/control";
import { Button } from "@/components/coss";
import { Expandable } from "@/components/ui/disclosure";
import { AccountPicker } from "./AccountPicker";
import { AccountHealth } from "./AccountHealth";
import { ProfileBrief } from "./ProfileBrief";
import { Chip } from "./health-bits";
import { TagEditor } from "./TagEditor";
import { useAntik } from "@/lib/use-antik";
import { ACCT_MODES } from "@/lib/constants";
import { loadSnapshot } from "@/lib/snapshot";
import { listItem } from "@/lib/motion";

export function ProfileAccounts() {
  const form = useStore((s) => s.form);
  const tags = useStore((s) => s.tags);
  const snapshot = useStore((s) => s.snapshot);
  const setProfile = useStore((s) => s.setProfile);
  const setTag = useStore((s) => s.setTag);
  const set = useStore((s) => s.setField);
  const setSnapshot = useStore((s) => s.setSnapshot);
  const [loading, setLoading] = React.useState(false);
  const antik = useAntik();

  /* Список профилей — из Обелисты, а не из дырки локального антидетекта.
     Правило, кого показывать, живёт в `lib/antik-profiles`: если локальный
     антидетект отвечает, верим ему и показываем только живых; если молчит —
     показываем всё, что Обелиста знает, и помечаем непроверенное. Молчаливый
     пустой список в облаке делал билдер неработающим инструментом.
     Каждому профилю приписан маленький статус OAuth: без него не видно, по
     какому из них вообще поедут спенд и статусы доставки. */
  const profileOpts = antik.profiles.map((p) => ({
    value: p.id,
    text: `${p.name} (${p.id})`,
    label: (
      <span className="flex w-full min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{p.name}</span>
        <span className="naming text-2xs text-faint">{p.id}</span>
        {/* Профиль есть в памяти Обелисты, но подтвердить его прямо сейчас
            некому: локальный антидетект не отвечает или мы в облаке. Пометка
            обязательна — молча выдать непроверенное за проверенное значит
            предложить залить с профиля, которого может уже не быть, и человек
            узнает об этом в конце. */}
        {!p.подтверждён && (
          <span
            className="label flex-none rounded-[3px] bg-warning-soft px-1 py-px text-warning"
            title="Obelista remembers this profile, but nothing can confirm right now that it still exists"
          >
            unconfirmed
          </span>
        )}
        <span
          className={
            "label flex-none rounded-[3px] px-1 py-px " +
            (p.connected
              ? "bg-success-soft text-success"
              : "bg-elevated text-muted-foreground")
          }
          title={p.connected
            ? "profile is connected to the app — spend and statuses come through it"
            : "profile is not connected: no spend or statuses for it"}
        >
          {p.connected ? "oauth" : "no oauth"}
        </span>
      </span>
    ),
  }));
  /* Сохранённый профиль мог исчезнуть из антика — так и случилось 06.08 с
     восемью из четырнадцати. Пустой триггер это скрывает: выглядит как «просто
     не выбрано», хотя на самом деле выбранного больше не существует. */
  const gone =
    antik.profiles.length && form.profile && !antik.profiles.some((p) => p.id === form.profile)
      ? form.profile
      : null;

  const tagOpts = [{ value: "", label: "— no tag —" }, ...Object.keys(tags).map((k) => ({ value: k, label: tags[k].prefix || k }))];
  const prefix = tags[form.tag]?.prefix || "";

  const sp = snapshot?.profiles?.[form.profile];
  const accsN = sp ? (sp.accounts || []).length : 0;
  const banned = sp ? (sp.accounts || []).filter((a) => a.status === "DISABLED").length : 0;
  const billing = sp ? (sp.billing_issues || []).length : 0;
  const pagesN = sp ? (sp.pages || []).length : 0;
  // Дата сборки — как «14:07, 28 июл», а не ISO-строкой во всю ширину.
  const at = snapshot?.generated_at ? new Date(snapshot.generated_at) : null;
  const atText = at && !Number.isNaN(at.valueOf())
    ? at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  /* Нажатие руками = пересобрать у Меты, а не перечитать копию из памяти
     демона. Иначе каб, пошаренный минуту назад, не появлялся, сколько ни жми,
     а кнопка при этом писала «снапшот обновлён». */
  const reload = async () => {
    setLoading(true);
    const res = await loadSnapshot(true);
    if (res.snapshot) {
      setSnapshot(res.snapshot);
      // Говорим, что именно случилось: «из кэша» на кнопке ручного обновления
      // значит, что демон Мету не переспросил, и это надо видеть.
      toast.success(
        res.cached
          ? `snapshot from the daemon cache (${res.source}) — nothing fresher returned`
          : `rebuilt from Meta (${res.source})`,
      );
    } else {
      toast.error("no snapshot — run the local generator or paste one manually");
    }
    setLoading(false);
  };

  return (
    <SectionCard index="01" id="profile" title="Profile and ad accounts">
      <Row label="Profile" align={profileOpts.length ? "center" : "start"}>
        {profileOpts.length ? (
          <Grow>
            <SelectField value={form.profile} onChange={setProfile} options={profileOpts} />
            {gone ? (
              <Hint className="mt-1 text-warning">
                profile {gone} is saved in the panel but the antidetect no longer lists it — pick another one
              </Hint>
            ) : null}
          </Grow>
        ) : (
          /* Профили «по памяти» не показываем вовсе: предложить залить с
             профиля, которого нет в антике, хуже, чем не предложить ничего.

             Ветки «подключи антик ключом» здесь больше нет: ключа не
             существует как понятия — лаунчер пишет адрес и токен себе на диск
             сам. Осталось два честных случая: демона не спросить и спросить
             было некого. */
          <div className="min-w-0 flex-1 rounded-lg border border-border bg-elevated px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {/* Инструкции разработчика здесь больше нет: команду запуска
                человеку в облаке выполнить негде, и предлагать это значит
                винить его в нашей поломке. */}
            {!antik.reachable
              ? "No answer from the service that keeps your accounts, so profiles could not be loaded. Nothing is lost — try again in a moment."
              : "Obelista does not know of any profiles yet. They come from the browser on the machine where uploads run, and appear here on their own once it reports in."}
          </div>
        )}
      </Row>
      <Row label="Agency tag">
        <Grow>
          <SelectField value={form.tag} onChange={setTag} options={tagOpts} />
        </Grow>
        {prefix && <Hint className="flex-[0_0_auto]">prefix {prefix}</Hint>}
      </Row>
      <Row label="Snapshot" align="start">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {atText ? (
            <>
              <span className="text-xs text-faint">{atText}</span>
              <Chip>accounts {accsN}</Chip>
              <Chip tone={banned ? "bad" : "ok"}>disabled {banned}</Chip>
              <Chip tone={billing ? "warn" : "ok"}>billing {billing}</Chip>
              <Chip>pages {pagesN}</Chip>
            </>
          ) : (
            <span className="text-xs text-faint">no snapshot</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </Row>
      <Row label="Ad accounts">
        <Grow>
          <SelectField value={form.acctMode} onChange={(v) => set("acctMode", v as typeof form.acctMode)} options={ACCT_MODES} />
        </Grow>
      </Row>

      <AnimatePresence initial={false}>
        {form.acctMode !== "all_active" && (
          <motion.div key="picker" variants={listItem} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
            <AccountPicker />
          </motion.div>
        )}
      </AnimatePresence>

      <Expandable summary={<span>ad account health</span>}>
        <AccountHealth />
      </Expandable>

      <Expandable summary="profile overview — pages, business managers, pixels, billing">
        <ProfileBrief />
      </Expandable>

      <Expandable summary="agency tags (naming prefix)">
        <TagEditor />
      </Expandable>
    </SectionCard>
  );
}

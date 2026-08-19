"use client";

/* Лист «Profile» — иссус #127, пункт 2 владельца.
 *
 * ЧТО ЗДЕСЬ ЕСТЬ: кто вошёл, что у него реально подключено, форма
 * дозаполнения (имя, контакты, соцсети), реферальный купон (#129) и двери в
 * `/billing` и `/settings`.
 *
 * ПОЧЕМУ ЭТО КЛИЕНТСКИЙ ЛИСТ, в отличие от `BillingView`. Тому нечего
 * спрашивать: его состояние одно и то же для любого посетителя. Здесь
 * наоборот — весь смысл слова «актуальные» в задаче в том, что интеграции
 * приезжают с сервера: `auth.me()` за человеком и `api.socials()` за
 * подключениями. Список в файле вместо ответа сервера — это не «профиль», а
 * картинка профиля.
 *
 * ПОЧЕМУ ОБА ЗАПРОСА НЕ ОБЯЗАТЕЛЬНЫ. Оба могут не ответить: на маке демон
 * бывает выключен, в облаке сессия бывает просрочена. Ни один отказ не
 * прячет лист — он превращается в честную строку «could not ask the server»
 * рядом с той интеграцией, про которую не удалось спросить. Пустой экран
 * вместо профиля был бы ровно тем враньём, за которое эта панель уже
 * платила: неотличимо от «у тебя ничего не подключено».
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Кнопки «сохранить в облако» — сервера профиля не
 * существует, и этой задачей бэкенд не трогается. Форма пишет ЧЕРНОВИК в
 * этот браузер, и говорит это словами над собой (`PROFILE_DRAFT_NOTICE`).
 * Оплаты тоже нет: тарифы, деньги и сроки живут на `/billing`, сюда ведёт
 * дверь, а не копия.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  CreditCard,
  Gift,
  Plug,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/coss";
import { api } from "@/lib/analytics";
import { auth, type AuthResult, type AuthUser } from "@/lib/auth";
import {
  PROFILE_DOORS,
  PROFILE_DRAFT_NOTICE,
  PROFILE_FIELDS,
  REFERRAL_REWARD,
  REFERRAL_SERVER_READY,
  REFERRAL_TERMS,
  integrationRows,
  ктоВошёл,
  normalizeProfileValue,
  profileFieldError,
  profileFilled,
  readProfileDraft,
  referralState,
  writeProfileDraft,
  type Door,
  type IntegrationRow,
  type IntegrationStatus,
  type ProfileField,
  type ProfileValues,
  type Who,
  сессияДо,
} from "@/lib/profile";
import { useStore } from "@/lib/store";
import { DATA_SOURCE_OPTIONS } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Цвет состояния интеграции. Один источник на лист — иначе `not_wired`
 *  однажды покрасится как «не подключено», и разница, ради которой он
 *  заведён, исчезнет с экрана. */
const STATUS_CLASS: Record<IntegrationStatus, { dot: string; text: string }> = {
  connected: { dot: "bg-success", text: "text-success" },
  none: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
  // Серым и пунктиром: это не «выключено», это «в продукте ещё нет».
  not_wired: { dot: "bg-transparent border border-dashed border-border", text: "text-faint" },
};

export function ProfileView() {
  const [me, setMe] = React.useState<AuthUser | null>(null);
  /* Ответ гейта целиком, а не только человек: в нём приезжает и срок сессии, и
     признак «входа тут нет вовсе». Раньше оба терялись — см. `ктоВошёл`. */
  const [ответ, setОтвет] = React.useState<AuthResult | null>(null);
  const [сломалось, setСломалось] = React.useState(false);
  /* `null` — ещё не спросили или не ответили; это НЕ ноль подключённых.
     Разницу держит модель (`integrationRows`), здесь её только не теряем. */
  const [socials, setSocials] = React.useState<{ connected: number; total: number } | null>(null);

  React.useEffect(() => {
    let живой = true;
    void (async () => {
      try {
        const r = await auth.me();
        if (!живой) return;
        setОтвет(r);
        if (r.ok) setMe(r.user);
      } catch {
        /* Запрос не доехал вовсе. Это НЕ «не вошёл»: там надо войти, а здесь —
           поднять демона, и путать их значит посылать человека не туда. */
        if (живой) setСломалось(true);
      }
      try {
        const r = await api.socials();
        if (живой) {
          setSocials({ connected: r.socials.filter((s) => s.connected).length, total: r.socials.length });
        }
      } catch {
        /* Демон выключен — строка про соцев скажет это прямо. */
      }
    })();
    return () => {
      живой = false;
    };
  }, []);

  const rows = integrationRows({ socials, ws: me ? me.ws : null });

  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "flex flex-col gap-6 py-5")}>
      <ProfileHeader who={ктоВошёл(ответ, сломалось)} me={me} сессия={
        ответ && ответ.ok ? сессияДо(ответ.expiresAt) : null
      } />
      <IntegrationsSection rows={rows} />
      <ProfileForm />
      <ReferralSection />
      <DoorsSection />
    </div>
  );
}

/** Шапка: кто вошёл — ЧЕТЫРЕ разных ответа, а не «имя или многоточие».
 *
 *  До этой правки лист на установке БЕЗ входа показывал «Asking the server who
 *  is signed in…» вечно: сервер отвечал сразу (`gate: false`, `user: null`,
 *  плюс `note` с объяснением), но панель не разбирала это поле, и ответ
 *  приезжал общим отказом. Многоточие, которое никогда не кончается, — это не
 *  «загрузка», это неправда о состоянии продукта.
 *
 *  Здесь же выводится СРОК СЕССИИ (`expires_at`). Ручка отдавала его всегда,
 *  `lib/auth` разбирал, а показывал НИКТО — ровно та же порода, из-за которой
 *  ключ приёма воронки не был виден ни на одном экране. */
export function ProfileHeader({
  who, me, сессия,
}: {
  who: Who;
  me: AuthUser | null;
  сессия: string | null;
}) {
  return (
    <header className="flex items-start gap-3">
      <span className="mt-0.5 grid size-10 flex-none place-items-center rounded-full bg-elevated">
        <UserRound className="size-5 text-muted-foreground" strokeWidth={1.6} aria-hidden />
      </span>
      <div className="min-w-0">
        <h1 className="font-heading text-lg font-semibold">{who.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <span className={who.state === "signed_in" ? "tnum" : undefined}>{who.detail}</span>
          {me && me.role === "admin" ? (
            <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs text-foreground">
              <ShieldCheck className="size-3.5" strokeWidth={1.8} aria-hidden />
              admin
            </span>
          ) : null}
        </p>
        {сессия ? (
          <p className="mt-1 flex items-start gap-1.5 text-2xs leading-relaxed text-faint">
            <Clock className="mt-px size-3 flex-none" strokeWidth={1.8} aria-hidden />
            <span>{сессия}</span>
          </p>
        ) : null}
      </div>
    </header>
  );
}

/* --- Интеграции --------------------------------------------------------- */

function IntegrationsSection({ rows }: { rows: IntegrationRow[] }) {
  /* Откуда панель сейчас берёт профили. Строка стоит ИМЕННО здесь: ниже
     перечислено, что подключено «по данным сервера», и человек обязан знать,
     читает ли он вообще сервер прямо сейчас. */
  const dataSource = useStore((s) => s.dataSource);
  const подпись =
    DATA_SOURCE_OPTIONS.find((o) => o.value === dataSource)?.label ?? dataSource;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Plug className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden />
        <h2 className="font-heading text-base font-semibold">Integrations</h2>
      </div>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
        What is actually connected to this account right now, asked from the server — and what the
        product cannot connect yet, said plainly instead of shown as an unpressed button.
      </p>
      <p className="mt-1 text-2xs text-muted-foreground">
        Profile data source: <span className="font-medium text-foreground">{подпись}</span> —
        change it in the top bar.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <IntegrationLine key={r.id} row={r} />
        ))}
      </ul>
    </section>
  );
}

function IntegrationLine({ row }: { row: IntegrationRow }) {
  const c = STATUS_CLASS[row.status];
  const body = (
    <>
      <span
        aria-hidden
        className={cn("mt-1.5 size-2.5 flex-none rounded-full", c.dot)}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[12.5px] font-medium text-foreground">{row.title}</span>
          <span className={cn("text-2xs", c.text)}>{row.detail}</span>
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
          {row.description}
        </span>
      </span>
      {row.href ? (
        <ArrowRight className="mt-1 size-4 flex-none text-faint" strokeWidth={1.8} aria-hidden />
      ) : null}
    </>
  );

  return (
    <li>
      {row.href ? (
        <Link
          href={row.href}
          className="flex items-start gap-2.5 rounded-lg border border-border bg-elevated px-3 py-2.5 transition hover:border-neutral-400 dark:hover:border-neutral-500"
        >
          {body}
        </Link>
      ) : (
        /* Ссылки нет намеренно: вести некуда, и рамка пунктиром говорит об
           этом раньше, чем человек прочтёт строку состояния. */
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border px-3 py-2.5">
          {body}
        </div>
      )}
    </li>
  );
}

/* --- Форма профиля ------------------------------------------------------ */

/** Дозаполнение профиля. Черновик читается из браузера при монтировании (на
 *  сервере `localStorage` не существует, поэтому не в начальном состоянии), а
 *  пишется на «Save draft» — не на каждый нажатый символ: запись на каждый
 *  символ делает из хранилища журнал опечаток и мешает сказать человеку
 *  ровно один раз, что именно произошло. */
function ProfileForm() {
  const [values, setValues] = React.useState<ProfileValues>({});
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setValues(readProfileDraft(typeof window === "undefined" ? null : window.localStorage));
  }, []);

  const errors = PROFILE_FIELDS.map((f) => profileFieldError(f.kind, values[f.id] || ""));
  const плохо = errors.some(Boolean);

  const save = () => {
    if (плохо) return;
    const out: ProfileValues = {};
    for (const f of PROFILE_FIELDS) {
      const v = normalizeProfileValue(f.kind, values[f.id] || "");
      if (v) out[f.id] = v;
    }
    setValues(out);
    writeProfileDraft(typeof window === "undefined" ? null : window.localStorage, out);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <BadgeCheck className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden />
        <h2 className="font-heading text-base font-semibold">About you</h2>
        <span className="text-2xs text-faint tnum">
          {profileFilled(values)} of {PROFILE_FIELDS.length} filled
        </span>
      </div>

      {/* Единственная честная фраза этого блока, и она стоит ДО полей, а не
          мелким шрифтом после кнопки: человек должен знать, куда девается
          написанное, прежде чем писать. */}
      <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
        {PROFILE_DRAFT_NOTICE}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {PROFILE_FIELDS.map((f, i) => (
          <Field
            key={f.id}
            field={f}
            value={values[f.id] || ""}
            error={errors[i]}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={плохо}>
          Save draft
        </Button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="size-3.5" strokeWidth={2} aria-hidden />
            Kept in this browser
          </span>
        ) : плохо ? (
          <span className="text-xs text-warning">Fix the marked fields first.</span>
        ) : null}
      </div>
    </section>
  );
}

function Field({
  field,
  value,
  error,
  onChange,
}: {
  field: ProfileField;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
}) {
  const id = `profile-${field.id}`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">{field.label}</span>
      <Input
        id={id}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={error ? "border-warning" : undefined}
      />
      <span className={cn("text-2xs leading-relaxed", error ? "text-warning" : "text-faint")}>
        {error || field.hint}
      </span>
    </label>
  );
}

/* --- Реферальный купон -------------------------------------------------- */

/** Купон из #129. Условия показаны ДО кнопки, а не после отказа в выплате:
 *  они составные (три соца по OAuth, четырнадцать дней подряд, антифрод), и
 *  человек, который узнаёт про них в момент отказа, считает себя обманутым —
 *  справедливо.
 *
 *  Кнопка не «скоро»: она объясняет, ЧЕГО нет. Купон — это связь приведённого
 *  с приводящим, и держать её может только сервер; выданная здесь строка
 *  символов не связала бы никого, но выглядела бы как рабочий код. Это та же
 *  граница, что на `/billing`: рисовать рабочий приём там, где его нет,
 *  нельзя. Карточку купона из #88 (лист аккаунта, ветка не влита) заменяет
 *  эта — владелец запретил делать её дважды. */
function ReferralSection() {
  const st = referralState(REFERRAL_SERVER_READY);
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Gift className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden />
        <h2 className="font-heading text-base font-semibold">Referral coupon</h2>
      </div>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{REFERRAL_REWARD}</p>

      <ul className="mt-3 flex flex-col gap-1.5">
        {REFERRAL_TERMS.map((t) => (
          <li key={t} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-1.5 size-1.5 flex-none rounded-full bg-muted-foreground" />
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" disabled={!st.canIssue}>
          Create coupon
        </Button>
        {st.canIssue ? null : (
          <p className="max-w-md text-[11.5px] leading-relaxed text-muted-foreground">{st.why}</p>
        )}
      </div>
    </section>
  );
}

/* --- Двери -------------------------------------------------------------- */

const DOOR_ICON: Record<string, typeof CreditCard> = {
  integrations: Plug,
  billing: CreditCard,
  settings: Settings,
};

function DoorsSection() {
  return (
    <section>
      <h2 className="font-heading text-base font-semibold">Elsewhere</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {PROFILE_DOORS.map((d) => (
          <DoorCard key={d.id} door={d} />
        ))}
      </div>
    </section>
  );
}

function DoorCard({ door }: { door: Door }) {
  const Icon = DOOR_ICON[door.id] || ArrowRight;
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden />
        <span className="text-[12.5px] font-medium text-foreground">{door.title}</span>
        {door.href ? (
          <ArrowRight className="ml-auto size-4 text-faint" strokeWidth={1.8} aria-hidden />
        ) : null}
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{door.description}</p>
      {door.missingWhy ? (
        <p className="mt-1 text-2xs leading-relaxed text-faint">{door.missingWhy}</p>
      ) : null}
    </>
  );

  return door.href ? (
    <Link
      href={door.href}
      className="rounded-xl border border-border bg-card px-3 py-2.5 transition hover:border-neutral-400 dark:hover:border-neutral-500"
    >
      {inner}
    </Link>
  ) : (
    /* Дверь без листа рисуется пунктиром и не кликается вовсе: ссылка в
       никуда врёт про то, что у панели есть. */
    <div className="rounded-xl border border-dashed border-border px-3 py-2.5">{inner}</div>
  );
}

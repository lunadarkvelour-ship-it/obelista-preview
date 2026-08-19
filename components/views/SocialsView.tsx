"use client";

/* Лист «Соцы» — кто подключён к приложению Obelista и как подключить остальных.
 *
 * Два пути наружу, и оба нужны:
 *   — «ссылка» отдаёт адрес диалога согласия строкой, чтобы открыть его в том
 *     же профиле любым браузером;
 *   — часть соцев живёт вне антидетекта, и CDP туда не дотянется вовсе.
 *
 * Обе дороги ведут на один и тот же /callback демона: код на токен меняет он.
 * Код одноразовый, поэтому забирать его должен ровно один. Панель перечитывает
 * список и видит результат.
 *
 * Раскладка: жёсткая сетка с одинаковыми дорожками у всех строк. Раньше строка
 * была flex-wrap с min-width у каждого куска — из-за этого профиль с длинным
 * именем сдвигал вправо и аккаунт, и права, и кнопки, а глазу не за что было
 * зацепиться. Плюс подключённые и неподключённые шли вперемешку в порядке
 * антика: два разных состояния с разными действиями в одном списке.
 */

import * as React from "react";
import { Button } from "@/components/coss";
import {
  Archive, Cable, Check, Copy, KeyRound, Link2, Plus, RefreshCw, RotateCcw,
  ShieldAlert, Trash2, Unplug, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScanProfiles } from "@/components/sections/profiles/ScanProfiles";
import { api, type Social } from "@/lib/analytics";
import { Expandable } from "@/components/ui/disclosure";
import { newsOfVendor, splitSocials, списокНеполон } from "@/lib/socials-rows";
import { useStore } from "@/lib/store";
import {
  deleteReceipt, forgetArchived, pruneArchived, readArchived, rememberArchived,
  rowActions, writeArchived, type ArchivedProfile,
} from "@/lib/socials-archive";

/** Права, без которых заявка на снятие лимитов не подаётся.
 *
 *  Мета засчитывает право, только когда с ним прошёл успешный вызов. Без права
 *  вызова не сделать, а отказа не будет: `instagram_business_account` без
 *  `instagram_basic` возвращается БЕЗ этого поля и без единой ошибки — проверено.
 *  Поэтому нехватку надо показывать здесь, а не искать в дашборде по нулевым
 *  счётчикам. Выдаются они в Login for Business → Configurations, после чего
 *  соц надо переподключить. Добить вызовы: `venv/bin/python scripts/app_review.py --fire`. */
const REVIEW_SCOPES = ["instagram_basic", "ads_mcp_management"];

function missingReview(scopes: string[]): string[] {
  return REVIEW_SCOPES.filter((p) => !scopes.includes(p));
}

/** Сколько дней осталось токену. null — токен бессрочный или даты нет. */
function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}

/** Когда соц последний раз РЕАЛЬНО ответил Мете.
 *
 *  Главный ответ на вопрос «он подключён или нет». Зелёная точка означает лишь
 *  «токен у нас есть», а токен отваливается молча — чекпоинт, смена пароля,
 *  отзыв доступа. Панель уже дважды показывала «подключён, 59 дн.» на мёртвом
 *  токене, и человек не понимал, почему кабов нет. Проверку делает сбор: все
 *  соцы раз в десять минут, помеченные сломанными — каждый круг. */
function Verified({
  iso, error, expires,
}: {
  iso: string | null;
  error: string | null;
  expires: string | null;
}) {
  const life = daysLeft(expires);
  const tail = life === null ? "token does not expire"
    : life <= 0 ? "token expired"
    : `token valid for ${life} more days`;
  if (error) {
    return (
      <span
        className="whitespace-nowrap rounded-md border border-destructive/40 px-1.5 py-0.5 text-2xs text-destructive"
        title={`${error}\n\ntoken is not responding — reconnect the profile`}
      >
        no response
      </span>
    );
  }
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) {
    return (
      <span className="text-2xs text-faint" title="no live check yet">
        not checked
      </span>
    );
  }
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  const text = m < 1 ? "just now" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h`;
  // Больше часа без успешного ответа — уже не «свежо»: сбор ходит раз в десять
  // минут, значит что-то мешает, и красить это зелёным нельзя.
  const tone = life !== null && life <= 7 ? "text-warning" : m > 60 ? "text-warning" : "text-success";
  return (
    <span
      className={cn("whitespace-nowrap font-mono text-2xs", tone)}
      title={`last successful Meta response: ${iso}\n${tail}`}
    >
      ✓ {text}
    </span>
  );
}

export function SocialsView() {
  /* Режим источника данных и сам снапшот. Лист `/socials` остаётся ЛИСТОМ
     СЕРВЕРА целиком: его запросы, действия и счётчики не трогаются вовсе.
     В режиме снапшота НАД ним добавляется отдельная секция — профили, которые
     доступны для выбора, даже если сервер не может подтвердить их OAuth. Это
     ответ на вопрос «почему в кабинетах есть профиль, которого нет здесь». */
  const dataSource = useStore((s) => s.dataSource);
  const snapshot = useStore((s) => s.snapshot);
  const снапРежим = dataSource === "snapshot";
  const снапПрофили = React.useMemo(
    () => Object.entries(snapshot?.profiles ?? {}),
    [snapshot],
  );

  const [rows, setRows] = React.useState<Social[]>([]);
  /* Строки, с которыми Обелиста работать не может: профиль лежит у вендора,
     которого у неё нет, либо его не показывает ни один вендор (#163). Держим
     ОТДЕЛЬНО от `rows`, а не фильтруем на отрисовке: счётчик в шапке («сколько
     из скольких подключено») считает именно `rows`, и покойники в нём и были
     тем «виджетом, который считает от мёртвых профилей». */
  const [orphans, setOrphans] = React.useState<Social[]>([]);
  const [meta, setMeta] = React.useState<{
    app_id?: string | null; config_id?: string | null;
    antik_ok?: boolean; antik_expected?: boolean;
  }>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(true);
  /* Приехал ли ответ демона хоть раз. Без этого «нет данных» и «ещё не
     спрашивали» выглядят одинаково, а лечатся по-разному. */
  const [loaded, setLoaded] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  /* Отдельно от `error` листа: отказ выдать ссылку не значит, что список не
     прочитан. Свалив их в одно, мы стёрли бы с экрана рабочие строки из-за
     неудачи соседней кнопки. */
  const [addError, setAddError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  /* Что панель помнит об архиве. Демон архивные строки не отдаёт вовсе, и без
     этой памяти у архива не было бы выхода: строка исчезала навсегда — ровно
     как после удаления (см. шапку `lib/socials-archive.ts`). */
  const [archived, setArchived] = React.useState<ArchivedProfile[]>([]);
  /* Итог последнего действия ЖИВЁТ ЗДЕСЬ, а не в строке. Раньше он лежал в
     состоянии строки, которую через 900 мс сносил `window.location.reload()`, —
     то есть единственное число об удалении («сколько дней спенда ушло») человек
     видел меньше секунды. Гасится только рукой. */
  const [итог, setИтог] = React.useState<{ text: string; bad: boolean } | null>(null);

  /* Подключение нового аккаунта. Профиль антидетекта в этой цепочке не
     участвует вовсе — ни как параметр, ни как условие: у нового человека
     профилей нет, и подставлять в `state` нечего.
     Ссылку собирает демон, а не мы. `app_id` и `config_id` у панели есть, и
     склеить адрес она бы смогла — но `state` в OAuth существует затем, чтобы
     его выдавал и проверял СЕРВЕР: state, выбранный клиентом, это дыра CSRF.
     Уходим в диалог Меты в той же вкладке: возврат всё равно приведёт человека
     на нашу страницу, и лишнее окно на телефоне только мешает. */
  const addAccount = async () => {
    setAdding(true);
    setAddError(null);
    try {
      const got = await api.connectUrl();
      window.location.href = got.auth_url;
    } catch (e) {
      /* Текст демона показываем ДОСЛОВНО. Он приходит, когда приложение не
         настроено, и называет точную причину; пересказав её своими словами, мы
         превратили бы факт в догадку. */
      setAddError(e instanceof Error ? e.message : String(e));
      setAdding(false);
    }
  };

  /* `check` — то, чего человек ждёт от кнопки «обновить»: не «перечитай базу»,
     а «сходи и проверь». Отметка «не отвечает» живёт в базе, и без живой
     проверки она висела ещё часами после того, как доступ уже починили. */
  const load = React.useCallback(async (check = false) => {
    setPending(true);
    setError(null);
    try {
      const got = await (check ? api.socialsCheck() : api.socials());
      setRows(got.socials);
      /* `?? []` — демон постарше поля не отдаёт вовсе, и это не поломка листа. */
      setOrphans(got.orphaned ?? []);
      setMeta({ app_id: got.app_id, config_id: got.config_id,
                antik_ok: got.antik_ok, antik_expected: got.antik_expected });
      setLoaded(true);
      /* Сверяем память об архиве с тем, что приехало: строка, которую демон
         снова отдаёт, архивной не является. Иначе «в архиве» показывало бы
         профиль, который прямо сейчас собирает спенд. */
      const осталось = pruneArchived(readArchived(), got.socials);
      writeArchived(осталось);
      setArchived(осталось);
    } catch (e) {
      setLoaded(false);
      /* Команды разработчика здесь нет намеренно: «Run: venv/bin/python
         scripts/analytics_daemon.py» — это то, чего у человека в облаке нет и
         быть не может. Что делать дальше, говорит блок ниже. */
      setError(
        e instanceof Error && e.message.includes("fetch")
          ? "No answer from the service that keeps your accounts."
          : String(e instanceof Error ? e.message : e),
      );
    } finally {
      setPending(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const copy = async (s: Social) => {
    if (!s.auth_url) return;
    try {
      await navigator.clipboard.writeText(s.auth_url);
      setCopied(s.profile_id);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied("fail");
    }
  };

  const forget = async (s: Social) => {
    /* Через `api`, а не голым fetch: у голого нет ни стража сессии, ни общего
       адреса. Именно так и появляются места, где 401 показывает пустоту вместо
       экрана входа, — не по забывчивости, а потому что вызов «немножко другой». */
    try {
      await api.forget(s.profile_id);
    } catch {
      /* Как и раньше: отказ не показываем отдельной плашкой, список
         перечитывается и сам покажет, ушёл соц или остался. Изменилось одно —
         теперь `api` успевает увести на вход, если сессия кончилась, а не
         возвращает молчаливую пустоту. */
    } finally {
      void load();
    }
  };

  const имя = (s: { profile_name?: string; name?: string | null; profile_id: string }) =>
    s.profile_name || s.name || s.profile_id;

  /* Архив, удаление и возврат живут ЗДЕСЬ, а не в строке, по двум причинам.
     Строка после действия пропадает — состояние внутри неё умирает вместе с
     ней, и отчитаться ей уже нечем. И перечитать надо весь лист: меняется не
     только строка, но и счётчик в шапке, и группа «в архиве».

     `window.location.reload()` убран намеренно. Он был единственным способом
     показать результат — и он же его стирал; плюс перезагрузка листа ради
     одной строки роняет всё, что человек на нём успел (развёрнутый импорт,
     набранный код привязки). Иссус #131 просит обратного прямо: действие видно
     сразу, БЕЗ перезагрузки, и переживает её. */
  const архивировать = async (s: Social) => {
    await api.archiveProfile(s.profile_id);
    const стало = rememberArchived(readArchived(), { profile_id: s.profile_id, name: имя(s) });
    writeArchived(стало);
    setArchived(стало);
    setRows((rs) => rs.filter((r) => r.profile_id !== s.profile_id));
    setOrphans((rs) => rs.filter((r) => r.profile_id !== s.profile_id));
    setИтог({ text: `${имя(s)} archived — collecting stopped, every number kept`, bad: false });
    void load();
  };

  const вернуть = async (a: ArchivedProfile) => {
    await api.unarchiveProfile(a.profile_id);
    const стало = forgetArchived(readArchived(), a.profile_id);
    writeArchived(стало);
    setArchived(стало);
    setИтог({ text: `${a.name || a.profile_id} is back — collecting resumes on the next round`, bad: false });
    await load();
  };

  const удалить = async (s: { profile_id: string; profile_name?: string; name?: string | null }) => {
    const r = await api.deleteProfile(s.profile_id);
    const чек = deleteReceipt(r.убрано);
    const стало = forgetArchived(readArchived(), s.profile_id);
    writeArchived(стало);
    setArchived(стало);
    setRows((rs) => rs.filter((r2) => r2.profile_id !== s.profile_id));
    setOrphans((rs) => rs.filter((r2) => r2.profile_id !== s.profile_id));
    setИтог({ text: `${имя(s)} ${чек.text}`, bad: !!чек.partial.length });
    void load();
  };

  /* Деление живёт в `lib/socials-rows.ts`, а не здесь: строки приезжают
     эффектом, и внутри компонента это место непроверяемо тестом. Один символ в
     том условии стоил владельцу рабочего дня — см. причину там. */
  const { linked, rest } = splitSocials(rows);

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-[1200px] flex-col gap-3 overflow-y-auto p-4">
      <header className="flex flex-none flex-wrap items-center gap-3">
        <h1 className="font-heading text-lg font-semibold">Profiles</h1>
        {loaded && (
          <span className="font-mono text-xs text-muted-foreground">
            {linked.length} of {rows.length} connected
          </span>
        )}
        {!loaded && (
          <span className="text-xs text-muted-foreground">
            {pending ? "reading state…" : "state unknown"}
          </span>
        )}
        {loaded && !meta.config_id && (
          <span className="rounded-md bg-warning-soft px-2 py-0.5 text-2xs text-warning">
            no login configuration
          </span>
        )}
        <Button
          onClick={() => void load(true)}
          disabled={pending}
          className="focus-ring ml-auto flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs outline-none transition-colors duration-150 hover:border-border-strong pressed:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", pending && "animate-spin")} strokeWidth={1.75} aria-hidden />
          Refresh
        </Button>

      </header>

      <ScanProfiles />

      <section className="flex flex-none flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold text-foreground">Connect Facebook accounts</h2>
          <p className="mt-0.5 max-w-[72ch] text-2xs leading-relaxed text-muted-foreground">
            Separate Meta permission flow for ad accounts, pages, billing, and status. Use it after
            profiles are imported, or when an existing Facebook account needs OAuth again.
          </p>
        </div>
        <Button
          onClick={() => void addAccount()}
          disabled={adding}
          className="focus-ring flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs outline-none transition-colors duration-150 hover:border-border-strong pressed:scale-[0.98] disabled:opacity-50"
        >
          <Plus className="size-3.5" strokeWidth={2} aria-hidden />
          {adding ? "Opening Facebook…" : "Add account"}
        </Button>
      </section>

      {/* ПРОФИЛИ СНАПШОТА — только когда режим включён, и отдельной секцией
          НАД серверным списком. Не подмешиваются в него намеренно: счётчик
          «N of M connected» в шапке считает ответ сервера, и добавить туда
          строки другого происхождения значило бы получить число, которое не
          отвечает ни на один вопрос целиком.
          Полей не выдумываем: нет команды — «?», нет имени — показываем id. */}
      {снапРежим && (
        <section className="flex-none rounded-xl border border-dashed border-border px-3 py-2">
          <h2 className="text-xs font-medium">Profiles in the snapshot</h2>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            These are available for selection in Snapshot mode even though the server cannot
            confirm OAuth for them.
          </p>
          {/* Развилка по САМОМУ снапшоту, а не по длине списка: снапшот с
              пустым `profiles` — это приехавший снапшот без профилей, и сказать
              про него «не загрузился» значит послать человека собирать то, что
              уже собрано. Два факта — два разных текста. */}
          {!snapshot ? (
            <p className="mt-2 text-2xs text-muted-foreground">
              No snapshot has loaded into this browser yet — nothing is being substituted from
              the server here.
            </p>
          ) : снапПрофили.length === 0 ? (
            <p className="mt-2 text-2xs text-muted-foreground">
              The snapshot has loaded{snapshot.generated_at ? ` (${snapshot.generated_at})` : ""} and
              carries no profiles. That is what it contains, not a failure to read it — and
              nothing is being substituted from the server here.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {снапПрофили.map(([id, p]) => (
                <li key={id} className="flex flex-wrap items-baseline gap-x-2 text-2xs">
                  <span className="font-medium text-foreground">{p.label || id}</span>
                  <span className="font-mono text-muted-foreground">{id}</span>
                  <span className="text-muted-foreground">{p.team || "?"}</span>
                  <span className="text-muted-foreground">
                    {p.accounts?.length ?? 0} ad accounts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {addError && (
        /* Своя фраза человеку + текст демона ПРИГЛУШЁННО, а не вместо неё.
           Контракт просит не переписывать его текст, и он не переписан — но
           показать один его нельзя: сегодня демон отвечает по-русски и ссылается
           на `config.json`, то есть на файл, которого у клиента нет и не будет.
           Человек прочитал бы чужой язык и указание чинить чужую машину — и решил,
           что виноват он. Виноваты мы, и это сказано первой строкой. */
        <div className="flex-none rounded-xl border border-destructive/40 bg-destructive-soft px-3 py-2">
          <div className="text-xs text-destructive">
            Could not open the Facebook dialog. Obelista&apos;s own setup is incomplete — this is
            on our side, not yours, and pressing again will not help until it is fixed.
          </div>
          <div className="mt-1 break-words font-mono text-2xs text-destructive/70">{addError}</div>
        </div>
      )}

      {error && (
        <div className="flex-none rounded-xl border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* СПИСОК НЕПОЛОН, ПОТОМУ ЧТО СПРОСИТЬ БЫЛО НЕКОГО.
          Не ошибка и не поломка: профили живут в антидетекте на машине
          человека, и пока он молчит, счётчик выше считает по тому, что помнит
          база. Сказать про это обязаны мы: молчание источника выглядит на
          экране ровно как «профилей стало меньше», и человек ищет пропажу
          вместо того, чтобы запустить лаунчер. */}
      {loaded && списокНеполон(meta) && <ИсточникМолчит />}

      {/* Итог архива, возврата или удаления. Держится, пока его не закроют:
          после удаления здесь стоит ЕДИНСТВЕННОЕ место, где сказано, сколько
          дней спенда ушло вместе с профилем, — и оно же честно кричит, если
          удаление прошло наполовину. */}
      {итог && (
        <div
          role="status"
          className={cn(
            "flex flex-none items-start gap-2 rounded-xl border px-3 py-2 text-xs",
            итог.bad
              ? "border-destructive/40 bg-destructive-soft text-destructive"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 break-words">{итог.text}</span>
          <Button
            onClick={() => setИтог(null)}
            aria-label="dismiss"
            className="focus-ring -my-0.5 rounded-md p-0.5 outline-none hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={1.75} aria-hidden />
          </Button>
        </div>
      )}

      {!loaded && !pending && (
        /* Список не прочитан. Инструкции разработчика здесь больше нет:
           «запусти демон командой venv/bin/python …» и «открой localhost:8790»
           — это то, чего у человека в облаке нет и быть не может, и предлагать
           ему чинить чужую машину значит объявлять его виноватым в нашей
           поломке. Что произошло — говорим; что делать — говорим то, что он
           реально может. */
        <div className="flex-none rounded-xl border border-destructive/40 bg-destructive-soft px-4 py-3">
          <div className="text-sm font-semibold text-destructive">Could not read the list</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The service that keeps your accounts did not answer, so this list may be incomplete.
            Nothing was disconnected. Press Refresh in a moment.
          </div>
        </div>
      )}

      {loaded && !!linked.length && (
        <Group title="connected" count={linked.length}>
          {linked.map((s) => (
            <Row key={s.profile_id} s={s} copied={copied === s.profile_id} onCopy={copy}
                 onForget={forget} onArchive={архивировать} onDelete={удалить} />
          ))}
        </Group>
      )}

      {loaded && !!rest.length && (
        <Group title="not connected" count={rest.length}>
          {rest.map((s) => (
            <Row key={s.profile_id} s={s} copied={copied === s.profile_id} onCopy={copy}
                 onForget={forget} onArchive={архивировать} onDelete={удалить} />
          ))}
        </Group>
      )}

      {/* НЕ ОТКРЫВАЮТСЯ. Строки, за которыми стоит вендор, которого у Обелисты
          нет: переподключить их нельзя ничем — диалог согласия проходят В ТОМ
          ЖЕ профиле браузера, а профиля не существует. Держатся на экране (за
          ними кабинеты и спенд), но из рабочих списков и счётчика убраны:
          именно они и были «десятком покойников», среди которых владелец не
          находил свои три аккаунта. */}
      {loaded && !!orphans.length && (
        <Group title="cannot be opened" count={orphans.length}>
          {orphans.map((s) => (
            <OrphanRow key={s.profile_id} s={s} copied={copied === s.profile_id} onCopy={copy}
                       onArchive={архивировать} onDelete={удалить} />
          ))}
        </Group>
      )}

      {/* ВЫХОД ИЗ АРХИВА. Без этой группы архив был необратим на экране, чем бы
          он ни был в базе: строка пропадала, а `unarchiveProfile` не вызывался
          ниоткуда. Стоит последней — это склад, а не рабочий список. */}
      {!!archived.length && (
        <Group title="archived" count={archived.length}>
          {archived.map((a) => (
            <ArchivedRow key={a.profile_id} a={a} onRestore={вернуть} onDelete={удалить} />
          ))}
        </Group>
      )}

      {/* Пусто — это НЕ поломка и не «что-то не подключено»: у нового человека
          подключать ещё нечего, а на сервере профилей нет и не будет вовсе.
          Поэтому здесь говорится, что тут появится и что для этого сделать, а
          не чинится несуществующая связь. */}
      {loaded && !rows.length && !pending && (
        <div className="flex-none rounded-xl border border-border bg-card px-4 py-8 text-center">
          <div className="text-sm font-medium">No accounts yet</div>
          <div className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            Press <span className="text-foreground">Add account</span> and approve the Facebook
            dialog. Your ad accounts, their status and billing come from Meta on their own —
            nothing else to set up.
          </div>
        </div>
      )}

      {/* Инструкция свёрнута: она нужна один раз на аккаунт, а висела всегда.
          Порядок шагов поменялся вслед за кнопкой: раньше первым делом человек
          копировал ссылку и шёл открывать её в нужном браузере — теперь это
          путь ПЕРЕПОДКЛЮЧЕНИЯ конкретной строки, а обычное подключение
          начинается с кнопки и профиля не касается вовсе. */}
      <Expandable summary="How connecting works" className="flex-none">
        <ol className="ml-4 list-decimal space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <li>
            Press <span className="text-foreground">Add account</span>. You will land on
            Facebook&apos;s consent dialog signed in as whoever this browser is signed in as.
          </li>
          <li>Press Continue and select the ad accounts you want Obelista to read.</li>
          <li>
            You come back here automatically. The account appears above with a check mark, and its
            ad accounts, statuses and billing arrive on their own within a few minutes.
          </li>
          <li>
            The consent link is good for ten minutes and once only. If it expires, press{" "}
            <span className="text-foreground">Add account</span> again — nothing is lost.
          </li>
        </ol>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">Reconnecting an existing row</span> is a different
          thing: use its own <span className="text-foreground">Link</span> button, which ties the
          consent to that row. Approve it with the same Facebook account the row belongs to — a
          different one would move the row onto itself.
        </p>
      </Expandable>
    </main>
  );
}

/** «Спросить было некого»: антидетект на машине человека не ответил.
 *
 *  ОТДЕЛЬНЫМ КОМПОНЕНТОМ, потому что иначе на него нельзя посмотреть глазами:
 *  строки листа приезжают эффектом, а смотрелка (`__tests__/preview-socials`)
 *  эффектов не выполняет. Вклеенная в вёрстку плашка осталась бы единственным
 *  куском экрана, который никто ни разу не видел, — а именно на таких кусках
 *  сегодня и нашлась колонка нулевой ширины.
 *
 *  Не ошибка и не поломка: список показывает то, что помнит база, и молчит про
 *  профили, которые знает только антидетект. Сказать это обязаны мы — на экране
 *  такое молчание выглядит ровно как «профилей стало меньше». */
export function ИсточникМолчит() {
  return (
    <div className="flex-none rounded-xl border border-warning/40 bg-warning-soft px-3 py-2">
      <div className="text-xs text-warning">
        Your antidetect browser did not answer, so this list shows only what Obelista already
        had. Profiles it knows and this one does not are missing from the count — nothing was
        disconnected and nothing was lost.
      </div>
      <div className="mt-1 text-2xs text-warning/80">Start it and press Refresh.</div>
    </div>
  );
}

export function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex-none">
      <div className="mb-1.5 flex items-baseline gap-2 px-0.5">
        <h2 className="microlabel text-2xs text-muted-foreground">{title}</h2>
        <span className="font-mono text-2xs text-faint">{count}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

/** Строка соца.
 *
 *  Сетка, а не flex-wrap: дорожки обязаны совпадать у всех строк, иначе глаз
 *  не может идти по колонке вниз. На узком экране колонки схлопываются в две
 *  строки, но внутри строки порядок тот же. */
/* Код привязки антидетекта — единственная дверь, которой состав профилей
 * попадает в облако.
 *
 * ЗАЧЕМ ЭКРАН ВООБЩЕ ПОЯВИЛСЯ. Демон умел выдавать код с 14.08, MCP-тул
 * `link_profiles` умел его принять — а взять код человеку было НЕГДЕ: в панели
 * не существовало ни кнопки, ни упоминания. Обе половины моста были готовы и
 * не сходились посередине, поэтому профили не приехали ни разу, а лист
 * показывал наследство старой базы и выглядел при этом рабочим.
 *
 * ПОЧЕМУ КОД ПОКАЗЫВАЕТСЯ, А НЕ КОПИРУЕТСЯ САМ. Его называют вслух модели в
 * чате — как код из аутентификатора. Кнопка «скопировать» тут была бы
 * обманом ожидания: копировать некуда, вставлять его человек не будет.
 *
 * ОБРАТНЫЙ ОТСЧЁТ НЕ УКРАШЕНИЕ. Код живёт пять минут и гаснет на ПЕРВОЙ
 * попытке, удачной или нет. Человек, который увидит «просрочен» без счётчика,
 * решит, что сломался мост, а не что он отвлёкся. Секунды берём из ответа
 * сервера, а не из константы в панели: срок задаётся там, и копия числа здесь
 * однажды разъедется. */
/* `ImportProfiles` удалён. Это был единственный на весь лист блок «Import
   profiles from Shard»: два абзаца про устройство переноса, кнопка выдачи кода
   и сам код в правой колонке — на пол-первого экрана, и только под ShardX.

   Заменён двумя равноправными действиями и модалкой с ключом
   (`sections/profiles/ScanProfiles`). Причина не в размере: вендора теперь два
   (XR-44), парк байера может жить в любом, и лист, знающий про одного,
   заставлял второго не существовать. */

export function Row({
  s, copied, onCopy, onForget, onArchive, onDelete,
}: {
  s: Social;
  copied: boolean;
  onCopy: (s: Social) => void;
  onForget: (s: Social) => void;
  onArchive: (s: Social) => Promise<void>;
  onDelete: (s: Social) => Promise<void>;
}) {
  const scopes = (s.scopes || "").split(",").map((x) => x.trim()).filter(Boolean);
  const можно = rowActions(s);
  return (
    <div className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-border px-3 py-2.5 transition-colors duration-150 last:border-0 hover:bg-hover md:grid-cols-[10px_minmax(0,1.1fr)_minmax(0,1.2fr)_96px_auto]">
      <span
        className={cn(
          "size-2 flex-none rounded-full",
          /* Зелёный — подключён, и точка означает ровно это. Не отвечающий
             токен ОСТАЁТСЯ зелёным: соц подключён, просто сейчас молчит, и
             про это кричит отдельная метка рядом. Серый — не подключён, и
             других серых состояний нет: либо подключён, либо нет. */
          s.connected ? "bg-success" : "bg-border-strong",
        )}
        title={s.connected ? "connected" : "not connected"}
      />

      {/* профиль антидетекта. Под именем — id того профиля, где соц открыт
          СЕЙЧАС, а не ключ в базе: после переезда в другой антидетект ключ
          остаётся историческим, и показывать его значит показывать адрес, по
          которому соца уже нет. Если открыт в нескольких — говорим сколько. */}
      <div className="min-w-0">
        <div className="truncate text-sm">{s.profile_name || s.profile_id}</div>
        <div className="truncate font-mono text-2xs text-muted-foreground">
          {(() => {
            const живой = s.profiles?.find((p) => p.in_antik);
            const всего = s.profiles?.length ?? 0;
            const id = живой?.profile_id ?? s.profile_id;
            return всего > 1 ? `${id} +${всего - 1}` : id;
          })()}
        </div>
      </div>

      {/* аккаунт Меты */}
      <div className="col-start-2 min-w-0 md:col-start-auto">
        {s.connected ? (
          <>
            <div className="truncate text-sm">{s.name}</div>
            <div className="truncate font-mono text-2xs text-muted-foreground" title={s.fb_user_id || ""}>
              {s.fb_user_id}
            </div>
          </>
        ) : (
          /* Различаем по СТАТУСУ, а не по `in_antik`. Прежде тут стояло
             «profile not in antidetect» — свойство файла со снимком локальной
             машины, которое в облаке ложно у всех и сообщало бы человеку про
             антидетект, которого он в глаза не видел. Статус приходит от
             Обелисты и отвечает на тот вопрос, который человек задаёт:
             отключал он этот аккаунт сам или ещё не подключал. */
          <span className="text-xs text-muted-foreground">
            {s.status === "disconnected" ? "disconnected — collecting stopped" : "not connected yet"}
          </span>
        )}
      </div>

      {/* Проверен когда — а не «сколько жить токену». Срок жизни это про
          будущее, а вопрос всегда про сейчас: «он подключён?». Срок остался
          рядом, приглушённым: он нужен, когда планируешь переподключение. */}
      {/* `whitespace-nowrap` и `min-w-0`: проверку зажимало соседней кнопкой,
          и от «✓ 2 мин» на экране оставалась одна буква «н» — то есть
          единственный ответ на вопрос «он живой?» терялся целиком. */}
      <div className="col-start-2 min-w-0 whitespace-nowrap md:col-start-auto">
        {s.connected && (
          <Verified iso={s.last_ok_at} error={s.last_error} expires={s.expires_at} />
        )}
      </div>

      {/* Столбец с числом прав и «ревью −2» убран целиком. Он отвечал на
          вопрос, который задают раз в жизни — при подаче заявки на App
          Review, — а место занимал в каждой строке и каждый день. Сама
          нехватка прав никуда не делась: она остаётся в подсказке проверки
          рядом и всплывёт там, где действительно мешает. */}

      <div className="col-start-3 flex flex-none items-center gap-1.5 justify-self-end md:col-start-auto">
        {/* Ссылка на подключение — только у НЕподключённых. У подключённого соца
            она предлагает сделать то, что уже сделано, и стоит первой из двух
            кнопок: рука тянется к ней, а нужна вторая. Переподключение идёт
            через «отключить», и порядок действий от этого не меняется. */}
        {!s.connected && (
        <Button
          onClick={() => onCopy(s)}
          disabled={!s.auth_url}
          className="focus-ring flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs outline-none transition-colors duration-150 hover:border-border-strong pressed:scale-[0.98] disabled:opacity-40"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-primary-ink" strokeWidth={2} aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
              Link
            </>
          )}
        </Button>
        )}

        {s.connected ? (
          <Button
            onClick={() => onForget(s)}
            className="focus-ring flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs text-destructive outline-none transition-colors duration-150 hover:border-destructive/50 pressed:scale-[0.98]"
          >
            <Unplug className="size-3.5" strokeWidth={1.75} aria-hidden />
            Disconnect
          </Button>
        ) : (
          /* Раньше здесь стоял span, оформленный как кнопка: он ничего не делал
             и всё равно приглашал нажать. Теперь это подпись рядом с реальным
             действием — «ссылка» слева. */
          <span className="flex items-center gap-1.5 px-1 text-2xs text-faint">
            <Link2 className="size-3.5" strokeWidth={1.5} aria-hidden />
            Open in profile
          </span>
        )}

        {/* Что именно предложить — решает `rowActions` (там же и почему).
            Коротко: АРХИВ есть всегда, потому что выключать из работы надо
            как раз живой профиль; УДАЛЕНИЕ — только у тех, кого в антидетекте
            нет, потому что молчащий токен у живого профиля чинится
            переподключением, а не выбрасыванием профиля вместе со спендом. */}
        <УбратьПрофиль
          onArchive={можно.archive ? () => onArchive(s) : undefined}
          onDelete={можно.delete ? () => onDelete(s) : undefined}
        />
      </div>
    </div>
  );
}

/** Строка, которой работать нельзя: вендора профиля у Обелисты нет.
 *
 *  ПОЧЕМУ ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ ФЛАЖОК В `Row`. Обычная строка построена
 *  вокруг действия «подключить/отключить», и здесь это действие ЛОЖНО: кнопка
 *  «Disconnect» на аккаунте, который и так не собирается, или «Link» на
 *  профиле, которого не существует, — приглашение сделать невозможное. Осталось
 *  ровно то, что человек тут правда может: убрать с глаз или стереть вместе с
 *  историей. И одна фраза, объясняющая, почему кнопок больше нет. */
export function OrphanRow({
  s, copied, onCopy, onArchive, onDelete,
}: {
  s: Social;
  copied: boolean;
  onCopy: (s: Social) => void;
  onArchive: (s: Social) => Promise<void>;
  onDelete: (s: Social) => Promise<void>;
}) {
  return (
    /* ДОРОЖКИ РОВНО ТЕ ЖЕ, ЧТО У РАБОЧЕЙ СТРОКИ, и ни одного нового класса
       раскладки. Причина не в экономии: смотрелка берёт стили у СОБРАННОЙ
       панели, а Tailwind кладёт в сборку только те классы, которые видел на
       момент той сборки. Новый `col-span-3` или своя сетка в ней отсутствуют —
       браузер молча раскладывает автоматически, и на снимке я смотрю не на
       свою вёрстку, а на её отсутствие (проверено: `col-start-2` и
       `col-start-3` в собранном css есть, `col-span-*` и `row-start-*` нет).
       Пока панель не пересобрана, увидеть глазами можно только то, что
       собрано, — значит из этого и строим. */
    <div className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 border-b border-border px-3 py-2.5 transition-colors duration-150 last:border-0 hover:bg-hover">
      <span className="mt-1.5 size-2 flex-none rounded-full bg-border-strong" title="cannot be opened" />
      <div className="min-w-0">
        <div className="truncate text-sm">{s.profile_name || s.name || s.profile_id}</div>
        <div className="truncate font-mono text-2xs text-muted-foreground">{s.profile_id}</div>

        {/* АККАУНТ МЕТЫ НАЗВАН. Без него строка называла профиль антидетекта и
            молчала о том, ЧЕЙ это аккаунт: на экране стояло «MeDuA6aeP - 13/8
            SOC3», а человек ищет Raaj Khan. Именно этот аккаунт ему и предстоит
            подключить заново — иначе совет «connect it again» не о чем. */}
        {s.fb_user_id && (
          <div className="mt-1 truncate text-xs">
            {s.name}
            <span className="ml-1.5 font-mono text-2xs text-muted-foreground">{s.fb_user_id}</span>
          </div>
        )}

        {/* Причина словами, а не серым цветом строки: серое человек читает как
            «неважно», а тут важно — это его аккаунт и его кабинеты. Вторая
            фраза ОТДЕЛЬНОЙ строкой: слитые в одну, они читались как одно
            предложение («…reconnecting cannot help Its ad accounts keep their
            history») — видно это только глазом, тест такое пропускает. */}
        <div className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
          <div>{newsOfVendor(s)}.</div>
          {s.fb_user_id && (
            <div>
              Its ad accounts keep their history — connect this Facebook account again from a
              profile you still have.
            </div>
          )}
        </div>
      </div>

      <div className="col-start-3 flex flex-none items-center gap-1.5 justify-self-end">
        {/* Ссылка остаётся только там, где сервер её дал: у «не подтверждён»
            антидетект мог просто молчать, и отнимать единственное действие
            нельзя — на этом уже теряли строки, которые человек искал глазами. */}
        {!!s.auth_url && (
          <Button
            onClick={() => onCopy(s)}
            className="focus-ring flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs outline-none transition-colors duration-150 hover:border-border-strong pressed:scale-[0.98]"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-primary-ink" strokeWidth={2} aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
                Link
              </>
            )}
          </Button>
        )}
        <УбратьПрофиль onArchive={() => onArchive(s)} onDelete={() => onDelete(s)} />
      </div>
    </div>
  );
}

/** Строка архива: единственное место, откуда профиль можно вернуть в работу.
 *
 *  Показывает ПОСЛЕДСТВИЕ, а не факт: «archived» само по себе человеку ничего
 *  не обещает, а вопрос у него один — собирается оно или нет. */
function ArchivedRow({
  a, onRestore, onDelete,
}: {
  a: ArchivedProfile;
  onRestore: (a: ArchivedProfile) => Promise<void>;
  onDelete: (a: ArchivedProfile) => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [ошибка, setОшибка] = React.useState<string | null>(null);

  const вернуть = async () => {
    if (busy) return;
    setBusy(true);
    setОшибка(null);
    try {
      await onRestore(a);
    } catch (e) {
      setОшибка(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-3 py-2.5 transition-colors duration-150 last:border-0 hover:bg-hover">
      <span className="size-2 flex-none rounded-full bg-border-strong" title="archived" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{a.name || a.profile_id}</div>
        <div className="truncate font-mono text-2xs text-muted-foreground">{a.profile_id}</div>
      </div>
      <span className="text-xs text-muted-foreground">
        not collected, not offered for uploads — its numbers are kept
      </span>
      <div className="flex flex-none items-center gap-1.5">
        <Button
          onClick={() => void вернуть()}
          disabled={busy}
          className="focus-ring flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs outline-none transition-colors duration-150 hover:border-border-strong pressed:scale-[0.98] disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
          {busy ? "Restoring…" : "Restore"}
        </Button>
        {/* Удаление доступно и отсюда: заархивировав, человек нередко решает
            через неделю, что профиль не нужен вовсе. Уводить его для этого
            обратно в лист значило бы просить сначала вернуть в работу то, что
            он собрался стереть. */}
        <УбратьПрофиль onDelete={() => onDelete(a)} />
      </div>
      {ошибка && (
        <span role="alert" className="w-full break-words font-mono text-2xs text-destructive">
          {ошибка}
        </span>
      )}
    </div>
  );
}

/** Архив и удаление: два действия с РАЗНЫМИ последствиями, и подтверждение
 *  обязано назвать оба ДО нажатия.
 *
 *  ЧТО ЗДЕСЬ БЫЛО НЕ ТАК (#131). Текст спрашивал «Are you sure you want to
 *  delete this profile?» и предлагал архив как способ «save your spending
 *  history». Про архив это полуправда — он не «сохраняет историю», он ВЫКЛЮЧАЕТ
 *  профиль из сбора и из залива (`core/fbspend.py:489`, `core/registry.py:334`),
 *  и человек, выбравший его ради цифр, получал вдобавок остановленный сбор, о
 *  котором его не предупредили. Про удаление же не было сказано главного —
 *  что оно НЕОБРАТИМО; это выяснялось после.
 *
 *  Поэтому теперь каждая кнопка описана своей строкой и своим последствием, а
 *  «cannot be undone» стоит там, где на него смотрят перед нажатием.
 *
 *  Отсутствующий обработчик значит «действие недоступно» — так `Row` и
 *  `ArchivedRow` показывают разный набор кнопок, не заводя третьего флага. */
function УбратьПрофиль({
  onArchive, onDelete,
}: {
  onArchive?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [спрашиваем, setСпрашиваем] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | "archive" | "delete">("");
  const [ошибка, setОшибка] = React.useState<string | null>(null);

  if (!onArchive && !onDelete) return null;

  const сделать = async (что: "archive" | "delete", действие: () => Promise<void>) => {
    if (busy) return;
    setBusy(что);
    setОшибка(null);
    try {
      /* Отчитывается ЛИСТ, а не строка: после удачи строки здесь уже нет, и
         показывать итог ей негде. Ошибку — наоборот, показываем на месте: тут
         на неё смотрят. */
      await действие();
    } catch (e) {
      setОшибка(e instanceof Error ? e.message : String(e));
      setBusy("");
    }
  };

  if (!спрашиваем) {
    return (
      <Button
        onClick={() => setСпрашиваем(true)}
        className="focus-ring flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-2xs text-faint outline-none transition-colors duration-150 hover:text-destructive pressed:scale-[0.98]"
      >
        {/* Значок и слово совпадают с тем, что реально произойдёт: корзина у
            строки, которую можно стереть, и папка архива у той, которую можно
            только выключить. Корзина там, где удаления нет, — обещание, которого
            экран не выполнит. */}
        {onDelete ? (
          <>
            <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
            Remove
          </>
        ) : (
          <>
            <Archive className="size-3.5" strokeWidth={1.75} aria-hidden />
            Archive
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="max-w-[340px] space-y-1 text-right text-2xs leading-relaxed text-muted-foreground">
        {onArchive && (
          <p>
            <span className="text-foreground">Archive</span> stops collecting for this profile and
            takes it out of uploads and rules. Every number it has already collected stays, and you
            can bring it back from the list below.
          </p>
        )}
        {onDelete && (
          <p>
            <span className="text-destructive">Delete</span> erases the profile together with its
            whole spending history.{" "}
            <span className="font-semibold text-destructive">This cannot be undone.</span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          onClick={() => setСпрашиваем(false)}
          className="focus-ring min-h-8 rounded-lg px-2 text-2xs text-muted-foreground outline-none hover:text-foreground"
        >
          Cancel
        </Button>
        {onArchive && (
          <Button
            onClick={() => void сделать("archive", onArchive)}
            disabled={!!busy}
            className="focus-ring flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs outline-none transition-colors duration-150 hover:border-border-strong pressed:scale-[0.98] disabled:opacity-50"
          >
            <Archive className="size-3.5" strokeWidth={1.75} aria-hidden />
            {busy === "archive" ? "Archiving…" : "Archive"}
          </Button>
        )}
        {onDelete && (
          <Button
            onClick={() => void сделать("delete", onDelete)}
            disabled={!!busy}
            className="focus-ring flex min-h-8 items-center gap-1.5 rounded-lg border border-destructive/50 bg-card px-2.5 text-xs text-destructive outline-none transition-colors duration-150 hover:bg-destructive/10 pressed:scale-[0.98] disabled:opacity-50"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
            {busy === "delete" ? "Deleting…" : "Delete forever"}
          </Button>
        )}
      </div>
      {ошибка && (
        <span role="alert" className="max-w-[340px] break-words text-right font-mono text-2xs text-destructive">
          {ошибка}
        </span>
      )}
    </div>
  );
}

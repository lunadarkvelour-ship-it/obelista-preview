/* Лист «Integrations» — что подключено, что нет, и что подключение потребует
 * (иссус #126, пункт 5 владельца; сжат по #157).
 *
 * ЛИСТ КОРОТКИЙ НАМЕРЕННО. Разбор владельца 15.08: раздел выглядел огромным и
 * функциональным за счёт объёма текста, хотя подключить сегодня нельзя ни
 * одного источника. Объём пояснений сам по себе обещает работающий механизм —
 * то же враньё, что зелёная галочка над неработающим подключением, только
 * набранное словами. Поэтому формат карточки: имя, компактная информация,
 * состояние, кнопка. Ничего вокруг.
 *
 * Что снесено тем же решением и почему это не потеря:
 *   • раздел антидетекта целиком — подключать там нечего по устройству
 *     (браузер слушает `127.0.0.1` на машине оператора), а откуда берутся
 *     профили, сказано на листе профилей (`SocialsView`), где стоит и код
 *     привязки машины;
 *   • глоссарий трёх состояний — сам статус остался у каждой карточки, а
 *     объяснять «Not connected» словами значит объяснять очевидное.
 *
 * Лист не перечисляет вендоров сам — ходит по реестру
 * (`@/lib/integrations-registry`), а вендор приезжает отдельным модулем. Ровно
 * так же устроен движок после иссуса #26: код зовёт интерфейс, а не вендора по
 * имени.
 *
 * ГЛАВНОЕ ПРАВИЛО ЛИСТА. Живых подключений к этим трекерам нет, и панели
 * физически некуда сохранить адрес с ключом: в `panel/app/api` лежат
 * `fb/callback` и `snapshot`, ручек подключений там нет ни одной. Карточка,
 * которая выглядит рабочей и ничего не делает, хуже отсутствующей — человек
 * введёт ключ, увидит галочку и будет ждать воронку, которой неоткуда взяться.
 * Поэтому ни одного поля ввода на листе нет, кнопка ведёт в раскрывашку, а
 * раскрывашка честно перечисляет, чего не хватает.
 *
 * Без "use client" нарочно: странице не нужен ни один хук — ни стора, ни
 * антика, ни состояния браузера. Раскрывашки нативные (`<details>`), и
 * серверный рендер для такого листа дешевле и честнее клиентского. Тот же
 * приём, что у `RulesView` и `BillingView`, по образцу которых лист сделан.
 */

import { AlertTriangle } from "lucide-react";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import { CustomIntegrationCard } from "@/components/sections/integrations/CustomIntegrationCard";
import { DataSourceCard } from "@/components/sections/integrations/DataSourceCard";
import { VendorCard } from "@/components/sections/integrations/VendorCard";
import { NO_BACKEND_CONTEXT, type Section } from "@/lib/integrations";
import { SECTIONS, SECTION_ICON } from "@/lib/integrations-registry";
import { cn } from "@/lib/utils";

export function IntegrationsView() {
  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "flex flex-col gap-4 py-5")}>
      <h1 className="font-heading text-lg font-semibold">Integrations</h1>

      <NoBackendNotice />

      {/* Источник данных о профилях — ПЕРВЫМ и отдельно от вендоров.
          Он единственный на этом листе, который правда переключается: у
          остальных карточек подключать сегодня нечего. Ставить его вниз, к
          трекерам, значило бы прятать работающее среди неработающего.
          Почему он вообще здесь, а не в шапке продукта, — в самой карточке. */}
      <DataSourceCard />

      {SECTIONS.map((s) => (
        <SectionBlock key={s.id} section={s} />
      ))}
    </div>
  );
}

/** Одна строка сверху, один раз. Не про конкретное подключение — про то, что
 *  сегодня верно для всех разом: сохранить настройки некуда и проверить связь
 *  некому. Молчать об этом значило бы рисовать рабочий механизм там, где его
 *  физически нет. Абзац с разбором, почему это не «проверка провалилась», убран
 *  по #157: он объяснял состояние, которое и так написано на каждой карточке. */
function NoBackendNotice() {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2"
    >
      <AlertTriangle className="mt-px size-3.5 flex-none text-warning" strokeWidth={1.8} aria-hidden />
      <p className="text-xs leading-relaxed">
        Nothing can be connected from this page yet — there is nowhere to store a key and
        nothing that goes out to check a connection.
      </p>
    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  const Icon = SECTION_ICON[section.id];
  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
          <Icon className="size-4 flex-none text-muted-foreground" strokeWidth={1.8} aria-hidden />
          {section.title}
          <span className="text-2xs font-normal text-faint">
            {section.vendors.length === 1 ? "1 source" : `${section.vendors.length} sources`}
          </span>
        </h2>
        <p className="text-xs text-muted-foreground">{section.blurb}</p>
      </div>

      {/* Дверь для самописного источника стоит ПЕРЕД списком чужих имён, а не
          после него: список из шести названий читается как «поддерживается
          только это», и тот, у кого трекер свой, закрывает лист, не долистав.
          Условие по разделу, а не по имени вендора — вендоров этот файл не
          знает вовсе. */}
      {section.id === "trackers" ? <CustomIntegrationCard /> : null}

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {section.vendors.map((v) => (
          <VendorCard key={v.id} vendor={v} ctx={NO_BACKEND_CONTEXT} />
        ))}
      </div>
    </section>
  );
}

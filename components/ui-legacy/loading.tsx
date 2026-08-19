/* Ожидание, которое не выглядит поломкой.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ КОМПОНЕНТ. Владелец 15.08: «там где долго грузит контент —
 * добавь аккуратную анимашку, мол прогрузка идёт». Просьба про ощущение, а
 * причина техническая: пустой экран и сломанный экран выглядят ОДИНАКОВО, и
 * человек, глядя на пустоту, идёт перезагружать страницу ровно тогда, когда
 * запрос уже почти вернулся.
 *
 * ПОЧЕМУ НЕ КРУТИЛКА И НЕ ТРИ ТОЧКИ. Крутилка не говорит НИЧЕГО, кроме «жди», и
 * при задержке в четыре секунды читается как зависание. Здесь вместо неё —
 * подпись словами («Opening your workspace…») и мягкая пульсация: подпись
 * отвечает на вопрос «чего именно я жду», а движение отвечает на «оно вообще
 * живое».
 *
 * `prefers-reduced-motion` уважается через `motion-safe:` — человеку, который
 * выключил анимации в системе, мигающий блок на весь экран не помощь.
 */
import { cn } from "@/lib/utils";

export function Загрузка({
  подпись,
  className,
}: {
  подпись?: string;
  className?: string;
}) {
  return (
    <main
      role="status"
      aria-live="polite"
      className={cn("grid min-h-dvh place-items-center px-6", className)}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Три полосы разной длины и с разной задержкой: одинаковые читаются
            как индикатор загрузки файла и обещают процент, которого нет. */}
        <div className="flex items-end gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="motion-safe:animate-pulse h-6 w-1.5 rounded-full bg-border-strong"
              style={{
                animationDelay: `${i * 160}ms`,
                animationDuration: "1200ms",
                height: `${16 + i * 6}px`,
              }}
            />
          ))}
        </div>
        {подпись && (
          <p className="text-[13px] text-muted-foreground">{подпись}</p>
        )}
      </div>
    </main>
  );
}

/** Ожидание ВНУТРИ листа: та же идея, но без захвата всей высоты экрана.
 *
 *  Отдельным компонентом, а не флагом: лист, который на время загрузки схлопнул
 *  свою шапку и занял весь экран, дёргает раскладку дважды — при появлении и
 *  при исчезновении. */
export function ЗагрузкаВнутри({ подпись }: { подпись?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2.5 px-1 py-3">
      <span className="flex items-end gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="motion-safe:animate-pulse w-1 rounded-full bg-border-strong"
            style={{
              animationDelay: `${i * 160}ms`,
              animationDuration: "1200ms",
              height: `${8 + i * 3}px`,
            }}
          />
        ))}
      </span>
      {подпись && <span className="text-2xs text-muted-foreground">{подпись}</span>}
    </div>
  );
}

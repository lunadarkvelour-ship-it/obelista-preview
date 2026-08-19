"use client";

/** Дата+время старта = DatePicker + TimeField из tailwind-стартера.
 *  Наружу — прежний строковый контракт datetime-local ("" | "YYYY-MM-DDTHH:mm"). */
import * as React from "react";
import { CalendarDate, Time, parseDate, parseTime } from "@internationalized/date";
import { DatePicker } from "@/components/rac/DatePicker";
import { TimeField } from "@/components/rac/TimeField";
import { cn } from "@/lib/utils";

function split(value: string): { date: CalendarDate | null; time: Time | null } {
  if (!value || !value.includes("T")) return { date: null, time: null };
  const [d, t] = value.split("T");
  try {
    return { date: parseDate(d), time: t ? parseTime(t) : null };
  } catch {
    return { date: null, time: null };
  }
}

function join(date: CalendarDate | null, time: Time | null): string {
  if (!date) return "";
  const t = time ?? new Time(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.toString()}T${pad(t.hour)}:${pad(t.minute)}`;
}

export function DateTimeField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { date, time } = split(value);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <DatePicker
        aria-label="Start date"
        value={date}
        onChange={(nd) => onChange(join(nd, time))}
      />
      <TimeField
        aria-label="Start time"
        value={time}
        onChange={(nt) => onChange(join(date, nt))}
        isDisabled={!date}
        hourCycle={24}
      />
    </div>
  );
}

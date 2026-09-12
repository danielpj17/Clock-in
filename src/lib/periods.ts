import { addDays, diffDays, endOfLocalDay, startOfLocalDay, type LocalDate } from "./dates";

export interface PeriodSettings {
  periodAnchor: LocalDate;
  periodLengthDays: number;
}

export interface Period {
  /** First day of the period (inclusive). */
  start: LocalDate;
  /** Last day of the period (inclusive). */
  end: LocalDate;
  /** 0 for the period that starts on the anchor; negative before it. */
  index: number;
}

/** The pay period containing `date`. */
export function periodFor(date: LocalDate, s: PeriodSettings): Period {
  const len = Math.max(1, s.periodLengthDays);
  const index = Math.floor(diffDays(date, s.periodAnchor) / len);
  return periodAt(index, s);
}

export function periodAt(index: number, s: PeriodSettings): Period {
  const len = Math.max(1, s.periodLengthDays);
  const start = addDays(s.periodAnchor, index * len);
  return { start, end: addDays(start, len - 1), index };
}

export function isLastDayOfPeriod(date: LocalDate, s: PeriodSettings): boolean {
  return periodFor(date, s).end === date;
}

export function daysUntilPeriodEnd(date: LocalDate, s: PeriodSettings): number {
  return diffDays(periodFor(date, s).end, date);
}

/** Absolute bounds for DB queries: [start, end) */
export function periodBounds(p: Period, tz: string): { from: Date; to: Date } {
  return { from: startOfLocalDay(p.start, tz), to: endOfLocalDay(p.end, tz) };
}

/** The 7-day week (Mon–Sun by default) containing `date`. */
export function weekFor(date: LocalDate, weekStartsOn = 1): { start: LocalDate; end: LocalDate } {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const back = (dow - weekStartsOn + 7) % 7;
  const start = addDays(date, -back);
  return { start, end: addDays(start, 6) };
}

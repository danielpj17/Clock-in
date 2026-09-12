import { endOfLocalDay, localDateOf, type LocalDate } from "./dates";

/** JSON-safe shift shape shared by the API and the PWA. */
export interface Shift {
  id: string;
  clockIn: string; // ISO instant
  clockOut: string | null; // ISO instant, null while clocked in
  note: string;
  source: string;
}

export const MS_PER_HOUR = 3_600_000;

export function shiftEnd(s: Shift, now: number = Date.now()): number {
  return s.clockOut ? Date.parse(s.clockOut) : now;
}

export function durationMs(s: Shift, now: number = Date.now()): number {
  return Math.max(0, shiftEnd(s, now) - Date.parse(s.clockIn));
}

export function hoursOf(ms: number): number {
  return ms / MS_PER_HOUR;
}

/** `3.08` (always two decimals, what a spreadsheet wants) */
export function fmtHours(ms: number): string {
  return hoursOf(ms).toFixed(2);
}

/** `3.08 hrs` — hours are always shown as decimals, never as h/m. */
export function fmtDuration(ms: number): string {
  return `${fmtHours(ms)} hrs`;
}

/** `$480.00` */
export function fmtMoney(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** A shift "belongs" to the local calendar date it started on. */
export function shiftDate(s: Shift, tz: string): LocalDate {
  return localDateOf(Date.parse(s.clockIn), tz);
}

export interface DaySegment {
  shift: Shift;
  date: LocalDate;
  start: number; // ms
  end: number; // ms
}

/**
 * Split a shift at local midnights so the grid can draw an overnight shift
 * across two day columns. Totals still attribute the whole shift to its
 * clock-in date (see `shiftDate`).
 */
export function splitShiftByDay(s: Shift, tz: string, now: number = Date.now()): DaySegment[] {
  const out: DaySegment[] = [];
  let cur = Date.parse(s.clockIn);
  const end = shiftEnd(s, now);
  let guard = 0;
  while (cur < end && guard++ < 10) {
    const date = localDateOf(cur, tz);
    const dayEnd = endOfLocalDay(date, tz).getTime();
    out.push({ shift: s, date, start: cur, end: Math.min(end, dayEnd) });
    cur = dayEnd;
  }
  if (out.length === 0) {
    // zero-length shift (just clocked in): still show a sliver
    const date = localDateOf(cur, tz);
    out.push({ shift: s, date, start: cur, end: cur });
  }
  return out;
}

export function totalMs(shifts: Shift[], now: number = Date.now()): number {
  return shifts.reduce((acc, s) => acc + durationMs(s, now), 0);
}

export function isValidShiftRange(clockIn: number, clockOut: number | null): string | null {
  if (!Number.isFinite(clockIn)) return "Invalid clock-in time";
  if (clockOut === null) return null;
  if (!Number.isFinite(clockOut)) return "Invalid clock-out time";
  if (clockOut <= clockIn) return "Clock-out must be after clock-in";
  if (clockOut - clockIn > 24 * MS_PER_HOUR) return "A shift can't be longer than 24 hours";
  return null;
}

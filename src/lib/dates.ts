import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** Calendar date with no time component, formatted `yyyy-MM-dd`. */
export type LocalDate = string;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(s: unknown): s is LocalDate {
  return typeof s === "string" && LOCAL_DATE_RE.test(s) && !isNaN(Date.parse(s));
}

function parts(d: LocalDate): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number);
  return [y, m, day];
}

/** Whole-day arithmetic on calendar dates, independent of any time zone. */
export function addDays(d: LocalDate, n: number): LocalDate {
  const [y, m, day] = parts(d);
  const t = Date.UTC(y, m - 1, day + n);
  return new Date(t).toISOString().slice(0, 10);
}

export function diffDays(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(d: LocalDate): number {
  const [y, m, day] = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

/** Anything we accept as an instant: Date, epoch ms, or ISO string. */
export type Instant = Date | number | string;

function ms(i: Instant): number {
  return typeof i === "number" ? i : typeof i === "string" ? Date.parse(i) : i.getTime();
}

/** The calendar date an instant falls on in `tz`. */
export function localDateOf(instant: Instant, tz: string): LocalDate {
  return format(new TZDate(ms(instant), tz), "yyyy-MM-dd");
}

/** Midnight at the start of `d` in `tz`, as an absolute instant. */
export function startOfLocalDay(d: LocalDate, tz: string): Date {
  const [y, m, day] = parts(d);
  return new Date(new TZDate(y, m - 1, day, tz).getTime());
}

/** Exclusive end of `d` in `tz` (= start of the next day). */
export function endOfLocalDay(d: LocalDate, tz: string): Date {
  return startOfLocalDay(addDays(d, 1), tz);
}

export function todayIn(tz: string, now: Instant = Date.now()): LocalDate {
  return localDateOf(now, tz);
}

/** Format an instant in `tz` with a date-fns pattern. */
export function fmtIn(instant: Instant, tz: string, pattern: string): string {
  return format(new TZDate(ms(instant), tz), pattern);
}

export function fmtTime(instant: Instant, tz: string): string {
  return fmtIn(instant, tz, "h:mm a");
}

/** `Sep 7` / `Sep 7, 2026` style. */
export function fmtLocalDate(d: LocalDate, pattern = "MMM d"): string {
  const [y, m, day] = parts(d);
  return format(new Date(y, m - 1, day), pattern);
}

/** Value for an <input type="datetime-local"> showing `instant` in `tz`. */
export function toLocalInput(instant: Instant, tz: string): string {
  return fmtIn(instant, tz, "yyyy-MM-dd'T'HH:mm");
}

/** Parse a datetime-local value (`yyyy-MM-ddTHH:mm`) as wall-clock time in `tz`. */
export function fromLocalInput(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const t = new TZDate(y, mo - 1, d, h, mi, tz).getTime();
  return isNaN(t) ? null : new Date(t);
}

/** `Sep 7 – 20` or `Sep 28 – Oct 11` */
export function fmtDateRange(start: LocalDate, end: LocalDate): string {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth
    ? `${fmtLocalDate(start, "MMM d")} – ${fmtLocalDate(end, "d")}`
    : `${fmtLocalDate(start, "MMM d")} – ${fmtLocalDate(end, "MMM d")}`;
}

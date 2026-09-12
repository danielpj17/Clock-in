import { fmtDateRange, fmtLocalDate, fmtTime, type LocalDate } from "./dates";
import { durationMs, fmtHours, fmtMoney, shiftDate, type Shift } from "./hours";
import type { Period } from "./periods";

export interface ReportRow {
  id: string;
  date: LocalDate;
  dateLabel: string; // 09/07/2026
  inLabel: string; // 9:00 AM
  outLabel: string; // 12:00 PM or "—" while open
  hours: string; // 3.00
  ms: number;
  note: string;
  open: boolean;
}

export interface Report {
  period: Period;
  title: string; // Pay period Sep 7 – 20, 2026
  rows: ReportRow[];
  totalMs: number;
  totalHours: string;
  rate: number | null;
  pay: number | null;
}

export function buildReport(
  shifts: Shift[],
  period: Period,
  tz: string,
  rate: number | null,
  now: number = Date.now(),
): Report {
  const rows = shifts
    .filter((s) => {
      const d = shiftDate(s, tz);
      return d >= period.start && d <= period.end;
    })
    .sort((a, b) => Date.parse(a.clockIn) - Date.parse(b.clockIn))
    .map<ReportRow>((s) => {
      const ms = durationMs(s, now);
      return {
        id: s.id,
        date: shiftDate(s, tz),
        dateLabel: fmtLocalDate(shiftDate(s, tz), "MM/dd/yyyy"),
        inLabel: fmtTime(Date.parse(s.clockIn), tz),
        outLabel: s.clockOut ? fmtTime(Date.parse(s.clockOut), tz) : "—",
        hours: fmtHours(ms),
        ms,
        note: s.note,
        open: !s.clockOut,
      };
    });
  const total = rows.reduce((a, r) => a + r.ms, 0);
  const hours = total / 3_600_000;
  return {
    period,
    title: `Pay period ${fmtDateRange(period.start, period.end)}, ${period.end.slice(0, 4)}`,
    rows,
    totalMs: total,
    totalHours: hours.toFixed(2),
    rate,
    pay: rate == null ? null : Math.round(hours * rate * 100) / 100,
  };
}

const HEADER = ["Date", "Clock In", "Clock Out", "Hours", "Description"];

function cells(r: Report): string[][] {
  const body = r.rows.map((row) => [row.dateLabel, row.inLabel, row.outLabel, row.hours, row.note]);
  const total = ["", "", "TOTAL", r.totalHours, r.pay != null ? fmtMoney(r.pay) : ""];
  return [HEADER, ...body, total];
}

/** Tab-separated; pasting into Google Sheets/Excel lands each value in its own cell. */
export function toTSV(r: Report): string {
  const clean = (v: string) => v.replace(/[\t\r\n]+/g, " ");
  return cells(r)
    .map((row) => row.map(clean).join("\t"))
    .join("\n");
}

export function toCSV(r: Report): string {
  const q = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return cells(r)
    .map((row) => row.map(q).join(","))
    .join("\r\n");
}

/** Monospace-aligned plain text for email / iMessage. */
export function toText(r: Report): string {
  const rows = cells(r);
  const widths = HEADER.map((_, i) => Math.max(...rows.map((row) => (row[i] ?? "").length)));
  const line = (row: string[]) =>
    row
      .map((c, i) => (i === row.length - 1 ? c : c.padEnd(widths[i])))
      .join("  ")
      .trimEnd();
  const sep = "-".repeat(widths.reduce((a, w) => a + w + 2, 0) - 2);
  const [head, ...rest] = rows;
  const total = rest.pop()!;
  return [r.title, "", line(head), sep, ...rest.map(line), sep, line(total)].join("\n");
}

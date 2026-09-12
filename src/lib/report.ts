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

/**
 * The spreadsheet layout shared by every export (matches the employer's timesheet):
 *
 *   Aug 31 - Sep 13, 2026
 *   Daniel Johnson
 *
 *   Employee Summary            Employer Payment
 *   Rate          25.00         Payment Status
 *   Total Hours    2.75         Payment Date
 *   Total Amount $ 68.75        Payment Notes
 *
 *   Date  Clock in  Clock out  Hours  Description
 *   ...
 */
export type CellFormat = "date" | "time" | "hours" | "rate" | "money";

export interface SheetCell {
  /** Display text; numeric exports (xlsx) use `n` instead when present. */
  text: string;
  n?: number;
  format?: CellFormat;
  bold?: boolean;
  border?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
  align?: "right";
}

export type SheetRow = (SheetCell | null)[];

export interface Sheet {
  title: string;
  rows: SheetRow[];
  /** 0-based index of the shift table's header row (rows after it are shifts). */
  tableStart: number;
}

const TABLE_HEADER = ["Date", "Clock in", "Clock out", "Hours", "Description"];

/** Excel serial day number for a local calendar date. */
function excelDate(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

/** Fraction of a day for a clock-face time label like "2:30 PM". */
function excelTime(label: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label);
  if (!m) return undefined;
  const h = (Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0);
  return (h * 60 + Number(m[2])) / 1440;
}

/** Draw a single outline around the rectangle rows r0..r1, cols c0..c1 (inclusive). */
function outline(rows: SheetRow[], r0: number, c0: number, r1: number, c1: number) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const cell = (rows[r][c] ??= { text: "" });
      cell.border = {
        ...cell.border,
        ...(r === r0 && { top: true }),
        ...(r === r1 && { bottom: true }),
        ...(c === c0 && { left: true }),
        ...(c === c1 && { right: true }),
      };
    }
  }
}

export function sheetTitle(r: Report): string {
  return `${fmtDateRange(r.period.start, r.period.end).replace(" – ", " - ")}, ${r.period.end.slice(0, 4)}`;
}

export function toSheet(r: Report, employeeName = ""): Sheet {
  const title = sheetTitle(r);
  const hours = Number(r.totalHours);
  const t = (text: string, extra: Partial<SheetCell> = {}): SheetCell => ({ text, ...extra });
  const num = (n: number | null, format: CellFormat, text = n == null ? "" : n.toFixed(2)): SheetCell =>
    n == null ? { text: "", format, align: "right" } : { text, n, format, align: "right" };

  const rows: SheetRow[] = [
    [t(title, { bold: true })],
    [t(employeeName, { bold: true })],
    [],
    [t("Employee Summary", { bold: true }), null, null, t("Employer Payment", { bold: true })],
    [t("Rate"), num(r.rate, "rate"), null, t("Payment Status"), t("")],
    [t("Total Hours"), num(hours, "hours"), null, t("Payment Date"), t("")],
    [t("Total Amount"), num(r.pay, "money", r.pay == null ? "" : fmtMoney(r.pay)), null, t("Payment Notes"), t("")],
    [],
    TABLE_HEADER.map((h) => t(h, { bold: true })),
    ...r.rows.map<SheetRow>((row) => [
      { text: fmtLocalDate(row.date, "M/d/yyyy"), n: excelDate(row.date), format: "date", align: "right" },
      { text: row.inLabel, n: excelTime(row.inLabel), format: "time", align: "right" },
      { text: row.outLabel, n: excelTime(row.outLabel), format: "time", align: "right" },
      num(Number(row.hours), "hours", row.hours),
      t(row.note),
    ]),
  ];
  outline(rows, 4, 0, 6, 1);
  outline(rows, 4, 3, 6, 4);
  outline(rows, 8, 0, 8, 4);
  return { title, rows, tableStart: 8 };
}

const text = (c: SheetCell | null) => c?.text ?? "";

/** Tab-separated; pasting into Google Sheets/Excel lands each value in its own cell. */
export function toTSV(sheet: Sheet): string {
  const clean = (v: string) => v.replace(/[\t\r\n]+/g, " ");
  return sheet.rows.map((row) => row.map((c) => clean(text(c))).join("\t")).join("\n");
}

export function toCSV(sheet: Sheet): string {
  const q = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return sheet.rows.map((row) => row.map((c) => q(text(c))).join(",")).join("\r\n");
}

/**
 * An HTML table for the clipboard. Google Sheets and Excel both keep inline bold,
 * borders and alignment when pasting text/html.
 */
export function toHTML(sheet: Sheet): string {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const width = Math.max(...sheet.rows.map((r) => r.length));
  const style = (c: SheetCell | null) => {
    if (!c) return "";
    const s: string[] = [];
    if (c.bold) s.push("font-weight:bold");
    if (c.align) s.push(`text-align:${c.align}`);
    for (const side of ["top", "bottom", "left", "right"] as const) {
      if (c.border?.[side]) s.push(`border-${side}:1px solid #000`);
    }
    return s.length ? ` style="${s.join(";")}"` : "";
  };
  const tr = (row: SheetRow) => {
    const cells = Array.from({ length: width }, (_, i) => row[i] ?? null);
    return `<tr>${cells.map((c) => `<td${style(c)}>${esc(text(c))}</td>`).join("")}</tr>`;
  };
  return `<table>${sheet.rows.map(tr).join("")}</table>`;
}

/** Monospace-aligned plain text for email / iMessage. */
export function toText(r: Report, employeeName = ""): string {
  const total = ["", "", "TOTAL", r.totalHours, r.pay != null ? fmtMoney(r.pay) : ""];
  const body = r.rows.map((row) => [row.dateLabel, row.inLabel, row.outLabel, row.hours, row.note]);
  const rows = [TABLE_HEADER, ...body, total];
  const widths = TABLE_HEADER.map((_, i) => Math.max(...rows.map((row) => (row[i] ?? "").length)));
  const line = (row: string[]) =>
    row
      .map((c, i) => (i === row.length - 1 ? c : c.padEnd(widths[i])))
      .join("  ")
      .trimEnd();
  const sep = "-".repeat(widths.reduce((a, w) => a + w + 2, 0) - 2);
  const heading = [r.title, employeeName].filter(Boolean);
  return [...heading, "", line(TABLE_HEADER), sep, ...body.map(line), sep, line(total)].join("\n");
}

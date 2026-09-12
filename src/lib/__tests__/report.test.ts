import { describe, expect, it } from "vitest";
import { durationMs, fmtDuration, fmtHours, isValidShiftRange, splitShiftByDay, type Shift } from "../hours";
import { periodFor } from "../periods";
import { buildReport, toCSV, toHTML, toR1C1, toSheet, toText, toTSV } from "../report";

const tz = "America/Chicago";
const s = { periodAnchor: "2026-08-31", periodLengthDays: 14 };

const shift = (id: string, clockIn: string, clockOut: string | null, note = ""): Shift => ({
  id,
  clockIn,
  clockOut,
  note,
  source: "test",
});

describe("hours", () => {
  it("formats durations", () => {
    expect(fmtDuration(3 * 3_600_000 + 5 * 60_000)).toBe("3.08 hrs");
    expect(fmtHours(10 * 3_600_000 + 44 * 60_000)).toBe("10.73");
    expect(fmtDuration(0)).toBe("0.00 hrs");
  });

  it("open shift runs to now", () => {
    const now = Date.parse("2026-09-07T16:00:00Z");
    expect(durationMs(shift("a", "2026-09-07T14:00:00Z", null), now)).toBe(2 * 3_600_000);
  });

  it("validates ranges", () => {
    expect(isValidShiftRange(10, 5)).toMatch(/after/);
    expect(isValidShiftRange(0, 25 * 3_600_000)).toMatch(/24 hours/);
    expect(isValidShiftRange(0, null)).toBeNull();
    expect(isValidShiftRange(0, 60_000)).toBeNull();
  });

  it("splits an overnight shift at local midnight", () => {
    // 10 PM → 2 AM Chicago (CDT = UTC-5)
    const segs = splitShiftByDay(shift("a", "2026-09-08T03:00:00Z", "2026-09-08T07:00:00Z"), tz);
    expect(segs.map((x) => x.date)).toEqual(["2026-09-07", "2026-09-08"]);
    expect(segs[0].end).toBe(Date.parse("2026-09-08T05:00:00Z"));
    expect(segs[1].start).toBe(Date.parse("2026-09-08T05:00:00Z"));
  });
});

describe("report", () => {
  const period = periodFor("2026-09-07", s);
  const shifts = [
    shift("1", "2026-09-07T14:00:00Z", "2026-09-07T17:00:00Z", "Built login page"),
    shift("2", "2026-09-08T17:00:00Z", "2026-09-08T19:00:00Z", 'Client call, "fixes"\twith tab'),
    shift("3", "2026-08-30T14:00:00Z", "2026-08-30T15:00:00Z", "previous period"),
    // 11:30 PM on the last day of the period, running into the next period → counts in this one
    shift("4", "2026-09-14T04:30:00Z", "2026-09-14T06:30:00Z", "overnight on period end"),
  ];

  it("filters to the period by clock-in date and totals hours", () => {
    const r = buildReport(shifts, period, tz, 40);
    expect(r.rows.map((x) => x.id)).toEqual(["1", "2", "4"]);
    expect(r.totalHours).toBe("7.00");
    expect(r.pay).toBe(280);
    expect(r.rows[0]).toMatchObject({ dateLabel: "09/07/2026", inLabel: "9:00 AM", outLabel: "12:00 PM", hours: "3.00" });
  });

  it("sheet lays out title, name, summary boxes and the shift table", () => {
    const sheet = toSheet(buildReport(shifts, period, tz, 25), "Daniel Johnson");
    expect(sheet.title).toBe("Aug 31 - Sep 13, 2026");
    expect(sheet.rows[0][0]).toMatchObject({ text: "Aug 31 - Sep 13, 2026", bold: true });
    expect(sheet.rows[1][0]).toMatchObject({ text: "Daniel Johnson", bold: true });
    expect(sheet.rows[3][0]).toMatchObject({ text: "Employee Summary", bold: true });
    expect(sheet.rows[3][3]).toMatchObject({ text: "Employer Payment", bold: true });
    expect(sheet.rows[4].slice(0, 2)).toMatchObject([{ text: "Rate" }, { text: "25.00", n: 25, format: "rate" }]);
    // 3 shifts → table body is rows 10–12
    expect(sheet.rows[5].slice(0, 2)).toMatchObject([
      { text: "Total Hours" },
      { text: "=SUM(D10:D12)", formula: "=SUM(D10:D12)", n: 7, format: "hours" },
    ]);
    expect(sheet.rows[6].slice(0, 2)).toMatchObject([
      { text: "Total Amount" },
      { text: "=B5*B6", formula: "=B5*B6", n: 175, format: "money" },
    ]);
    expect(sheet.rows[4][3]).toMatchObject({ text: "Payment Status" });
    expect(sheet.rows[8].map((c) => c?.text)).toEqual(["Date", "Clock in", "Clock out", "Hours", "Description"]);
    expect(sheet.rows[9]).toMatchObject([
      { text: "9/7/2026", format: "date", n: 46272 },
      { text: "9:00 AM", format: "time", n: 0.375 },
      { text: "12:00 PM", format: "time", n: 0.5 },
      { text: "3.00", n: 3 },
      { text: "Built login page" },
    ]);
  });

  it("sheet outlines are drawn only on the box edges", () => {
    const sheet = toSheet(buildReport(shifts, period, tz, 25));
    // Employee Summary box: A5:B7
    expect(sheet.rows[4][0]!.border).toEqual({ top: true, left: true });
    expect(sheet.rows[5][0]!.border).toEqual({ left: true });
    expect(sheet.rows[6][1]!.border).toEqual({ bottom: true, right: true });
    // Employer Payment box: D5:E7
    expect(sheet.rows[4][4]!.border).toEqual({ top: true, right: true });
    // Header row: A9:E9
    expect(sheet.rows[8][0]!.border).toEqual({ top: true, bottom: true, left: true });
    expect(sheet.rows[8][2]!.border).toEqual({ top: true, bottom: true });
    expect(sheet.rows[9][0]!.border).toBeUndefined();
  });

  it("blank rate leaves the rate cell empty but keeps the amount formula", () => {
    const sheet = toSheet(buildReport(shifts, period, tz, null));
    expect(sheet.rows[4][1]).toMatchObject({ text: "" });
    expect(sheet.rows[4][1]!.n).toBeUndefined();
    expect(sheet.rows[6][1]).toMatchObject({ formula: "=B5*B6", n: 0 });
  });

  it("an empty period still gets a valid SUM range", () => {
    const sheet = toSheet(buildReport([], period, tz, 25));
    expect(sheet.rows[5][1]).toMatchObject({ formula: "=SUM(D10:D10)", n: 0 });
  });

  it("converts A1 formulas to R1C1 offsets", () => {
    expect(toR1C1("=SUM(D10:D12)", 5, 1)).toBe("=SUM(R[4]C[2]:R[6]C[2])");
    expect(toR1C1("=B5*B6", 6, 1)).toBe("=R[-2]C[0]*R[-1]C[0]");
    expect(toR1C1("=$AA$1", 0, 0)).toBe("=R[0]C[26]");
  });

  it("TSV strips tabs/newlines so columns stay aligned", () => {
    const sheet = toSheet(buildReport(shifts, period, tz, null), "Daniel Johnson");
    const lines = toTSV(sheet).split("\n");
    expect(lines[0]).toBe("Aug 31 - Sep 13, 2026");
    expect(lines[1]).toBe("Daniel Johnson");
    expect(lines[8]).toBe("Date\tClock in\tClock out\tHours\tDescription");
    expect(lines[10].split("\t")).toHaveLength(5);
    expect(lines[10]).toContain('Client call, "fixes" with tab');
  });

  it("CSV quotes fields with commas and quotes", () => {
    const csv = toCSV(toSheet(buildReport(shifts, period, tz, 40)));
    const lines = csv.split("\r\n");
    expect(lines[5]).toBe("Total Hours,=SUM(D10:D12),,Payment Date,");
    expect(lines[6]).toBe("Total Amount,=B5*B6,,Payment Notes,");
    expect(csv).toContain('"Client call, ""fixes""\twith tab"');
  });

  it("HTML formula cells carry Sheets' relative-formula attributes", () => {
    const html = toHTML(toSheet(buildReport(shifts, period, tz, 40)));
    expect(html).toContain(
      `data-sheets-value='{"1":3,"3":7}' data-sheets-formula="=SUM(R[4]C[2]:R[6]C[2])">=SUM(D10:D12)</td>`,
    );
    expect(html).toContain(`data-sheets-value='{"1":3,"3":280}' data-sheets-formula="=R[-2]C[0]*R[-1]C[0]">=B5*B6</td>`);
  });

  it("HTML carries bold, alignment and per-side borders", () => {
    const html = toHTML(toSheet(buildReport(shifts, period, tz, 40), "A <b> & B"));
    expect(html).toContain('<td style="font-weight:bold">Aug 31 - Sep 13, 2026</td>');
    expect(html).toContain("A &lt;b&gt; &amp; B");
    expect(html).toContain('<td style="border-top:1px solid #000;border-left:1px solid #000">Rate</td>');
    expect(html).toContain('<td style="text-align:right;border-top:1px solid #000;border-right:1px solid #000">40.00</td>');
    // every row is padded to the full width so columns stay aligned on paste
    const rows = html.match(/<tr>/g)!;
    expect(rows).toHaveLength(12);
    expect(html.split("<tr>")[3].match(/<td/g)).toHaveLength(5);
  });

  it("text report has a title, name and aligned columns", () => {
    const txt = toText(buildReport(shifts, period, tz, null), "Daniel Johnson");
    expect(txt.split("\n").slice(0, 2)).toEqual(["Pay period Aug 31 – Sep 13, 2026", "Daniel Johnson"]);
    expect(txt).toMatch(/TOTAL\s+7\.00/);
  });
});

import { describe, expect, it } from "vitest";
import { durationMs, fmtDuration, fmtHours, isValidShiftRange, splitShiftByDay, type Shift } from "../hours";
import { periodFor } from "../periods";
import { buildReport, toCSV, toText, toTSV } from "../report";

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

  it("TSV strips tabs/newlines so columns stay aligned", () => {
    const r = buildReport(shifts, period, tz, null);
    const lines = toTSV(r).split("\n");
    expect(lines[0]).toBe("Date\tClock In\tClock Out\tHours\tDescription");
    expect(lines[2].split("\t")).toHaveLength(5);
    expect(lines[2]).toContain('Client call, "fixes" with tab');
    expect(lines.at(-1)).toBe("\t\tTOTAL\t7.00\t");
  });

  it("CSV quotes fields with commas and quotes", () => {
    const r = buildReport(shifts, period, tz, 40);
    const csv = toCSV(r);
    expect(csv).toContain('"Client call, ""fixes""\twith tab"');
    expect(csv.split("\r\n").at(-1)).toBe(",,TOTAL,7.00,$280.00");
  });

  it("text report has a title and aligned columns", () => {
    const txt = toText(buildReport(shifts, period, tz, null));
    expect(txt.split("\n")[0]).toBe("Pay period Aug 31 – Sep 13, 2026");
    expect(txt).toMatch(/TOTAL\s+7\.00/);
  });
});

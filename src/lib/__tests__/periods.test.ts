import { describe, expect, it } from "vitest";
import { addDays, diffDays, endOfLocalDay, localDateOf, startOfLocalDay } from "../dates";
import { daysUntilPeriodEnd, isLastDayOfPeriod, periodAt, periodBounds, periodFor, weekFor } from "../periods";

const s = { periodAnchor: "2026-08-31", periodLengthDays: 14 }; // a Monday

describe("date arithmetic", () => {
  it("adds and diffs days across month ends", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-09-14", "2026-08-31")).toBe(14);
    expect(diffDays("2026-08-30", "2026-08-31")).toBe(-1);
  });

  it("converts instants to local dates in a zone", () => {
    // 11:30 PM Chicago on Sep 7 is 04:30Z on Sep 8
    expect(localDateOf(Date.parse("2026-09-08T04:30:00Z"), "America/Chicago")).toBe("2026-09-07");
    expect(localDateOf(Date.parse("2026-09-08T04:30:00Z"), "UTC")).toBe("2026-09-08");
  });

  it("computes local day bounds across DST", () => {
    // DST ends Nov 1 2026 in the US: that day is 25 hours long
    const from = startOfLocalDay("2026-11-01", "America/New_York");
    const to = endOfLocalDay("2026-11-01", "America/New_York");
    expect((to.getTime() - from.getTime()) / 3_600_000).toBe(25);
    expect(from.toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });
});

describe("pay periods", () => {
  it("anchor day starts period 0", () => {
    expect(periodFor("2026-08-31", s)).toEqual({ start: "2026-08-31", end: "2026-09-13", index: 0 });
  });

  it("last day of a period belongs to that period", () => {
    expect(periodFor("2026-09-13", s).start).toBe("2026-08-31");
    expect(periodFor("2026-09-14", s).start).toBe("2026-09-14");
  });

  it("works for dates before the anchor", () => {
    expect(periodFor("2026-08-30", s)).toEqual({ start: "2026-08-17", end: "2026-08-30", index: -1 });
    expect(periodFor("2026-08-17", s).index).toBe(-1);
    expect(periodFor("2026-08-16", s).index).toBe(-2);
  });

  it("periodAt walks forward and back", () => {
    expect(periodAt(1, s).start).toBe("2026-09-14");
    expect(periodAt(-1, s).end).toBe("2026-08-30");
  });

  it("detects the last day and days remaining", () => {
    expect(isLastDayOfPeriod("2026-09-13", s)).toBe(true);
    expect(isLastDayOfPeriod("2026-09-12", s)).toBe(false);
    expect(daysUntilPeriodEnd("2026-09-01", s)).toBe(12);
    expect(daysUntilPeriodEnd("2026-09-13", s)).toBe(0);
  });

  it("supports non-14-day lengths", () => {
    const weekly = { periodAnchor: "2026-09-04", periodLengthDays: 7 };
    expect(periodFor("2026-09-10", weekly)).toEqual({ start: "2026-09-04", end: "2026-09-10", index: 0 });
    expect(periodFor("2026-09-11", weekly).start).toBe("2026-09-11");
  });

  it("period bounds are timezone-aware", () => {
    const { from, to } = periodBounds(periodFor("2026-09-01", s), "America/Los_Angeles");
    expect(from.toISOString()).toBe("2026-08-31T07:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-14T07:00:00.000Z");
  });
});

describe("weeks", () => {
  it("Monday-start week containing a Sunday", () => {
    expect(weekFor("2026-09-13")).toEqual({ start: "2026-09-07", end: "2026-09-13" });
    expect(weekFor("2026-09-07")).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });
  it("Sunday-start week", () => {
    expect(weekFor("2026-09-09", 0)).toEqual({ start: "2026-09-06", end: "2026-09-12" });
  });
});

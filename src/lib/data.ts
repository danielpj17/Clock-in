import { and, asc, gte, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { settings, shifts, type SettingsRow, type ShiftRow } from "@/db/schema";
import { todayIn } from "./dates";
import { durationMs, fmtDuration, fmtMoney, totalMs, type Shift } from "./hours";
import { periodBounds, periodFor } from "./periods";

import type { AppSettings } from "./types";
export type { AppSettings };

function toSettings(r: SettingsRow): AppSettings {
  return {
    periodAnchor: r.periodAnchor,
    periodLengthDays: r.periodLengthDays,
    hourlyRate: r.hourlyRate == null ? null : Number(r.hourlyRate),
    employeeName: r.employeeName,
    timezone: r.timezone,
    dayStartHour: r.dayStartHour,
    dayEndHour: r.dayEndHour,
  };
}

export function toShift(r: ShiftRow): Shift {
  return {
    id: r.id,
    clockIn: r.clockIn.toISOString(),
    clockOut: r.clockOut ? r.clockOut.toISOString() : null,
    note: r.note,
    source: r.source,
  };
}

/** Settings row, created with defaults on first use. */
export async function getSettings(): Promise<AppSettings> {
  const rows = await (await db()).select().from(settings).limit(1);
  if (rows.length) return toSettings(rows[0]);
  const inserted = await (await db())
    .insert(settings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (inserted.length) return toSettings(inserted[0]);
  const again = await (await db()).select().from(settings).limit(1);
  return toSettings(again[0]);
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  await getSettings();
  const rows = await (await db())
    .update(settings)
    .set({
      ...(patch.periodAnchor !== undefined && { periodAnchor: patch.periodAnchor }),
      ...(patch.periodLengthDays !== undefined && { periodLengthDays: patch.periodLengthDays }),
      ...(patch.hourlyRate !== undefined && {
        hourlyRate: patch.hourlyRate == null ? null : patch.hourlyRate.toFixed(2),
      }),
      ...(patch.employeeName !== undefined && { employeeName: patch.employeeName }),
      ...(patch.timezone !== undefined && { timezone: patch.timezone }),
      ...(patch.dayStartHour !== undefined && { dayStartHour: patch.dayStartHour }),
      ...(patch.dayEndHour !== undefined && { dayEndHour: patch.dayEndHour }),
    })
    .where(sql`${settings.id} = 1`)
    .returning();
  return toSettings(rows[0]);
}

export async function getOpenShift(): Promise<Shift | null> {
  const rows = await (await db()).select().from(shifts).where(isNull(shifts.clockOut)).limit(1);
  return rows.length ? toShift(rows[0]) : null;
}

/** Shifts that overlap [from, to). Open shifts count as extending to now. */
export async function listShifts(from: Date, to: Date): Promise<Shift[]> {
  const rows = await (await db())
    .select()
    .from(shifts)
    .where(
      and(
        lt(shifts.clockIn, to),
        or(isNull(shifts.clockOut), gte(shifts.clockOut, from)),
      ),
    )
    .orderBy(asc(shifts.clockIn));
  return rows.map(toShift);
}

export interface Summary {
  todayMs: number;
  periodMs: number;
  periodPay: number | null;
  period: { start: string; end: string };
}

/** Today's and the current pay period's totals (attributed by clock-in date). */
export async function summarize(s: AppSettings, now = Date.now()): Promise<Summary> {
  const today = todayIn(s.timezone, now);
  const period = periodFor(today, s);
  const { from, to } = periodBounds(period, s.timezone);
  const rows = await listShifts(from, to);
  const inPeriod = rows.filter((r) => {
    const t = Date.parse(r.clockIn);
    return t >= from.getTime() && t < to.getTime();
  });
  const { from: tFrom, to: tTo } = periodBounds({ start: today, end: today, index: 0 }, s.timezone);
  const todayRows = inPeriod.filter((r) => {
    const t = Date.parse(r.clockIn);
    return t >= tFrom.getTime() && t < tTo.getTime();
  });
  const periodMs = totalMs(inPeriod, now);
  return {
    todayMs: totalMs(todayRows, now),
    periodMs,
    periodPay: s.hourlyRate == null ? null : Math.round((periodMs / 3_600_000) * s.hourlyRate * 100) / 100,
    period: { start: period.start, end: period.end },
  };
}

/** One-line status string for the Shortcut notification. */
export function summaryLine(sum: Summary): string {
  const pay = sum.periodPay != null ? ` (${fmtMoney(sum.periodPay)})` : "";
  return `Today: ${fmtDuration(sum.todayMs)} · Period: ${fmtDuration(sum.periodMs)}${pay}`;
}

export function shiftDurationLine(shift: Shift, now = Date.now()): string {
  return fmtDuration(durationMs(shift, now));
}

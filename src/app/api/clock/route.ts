import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { shifts } from "@/db/schema";
import { error, handler, json, parseInstant, readJson } from "@/lib/api";
import { getOpenShift, getSettings, summarize, summaryLine, toShift } from "@/lib/data";
import { fmtTime } from "@/lib/dates";
import { fmtDuration, isValidShiftRange } from "@/lib/hours";

export const dynamic = "force-dynamic";

interface ClockBody {
  action?: "in" | "out";
  note?: string;
  /** Optional ISO timestamp; defaults to the server's current time. */
  at?: string | number;
  /**
   * Clock-out only: if nothing is open, the time you actually started.
   * Records a complete shift from `startedAt` to `at`/now.
   */
  startedAt?: string | number;
  source?: string;
}

/**
 * POST /api/clock  { action: "in" | "out", note?, at?, startedAt? }
 * The iPhone Shortcut's single endpoint. Always returns a human-readable
 * `message` (or `error`) the Shortcut can show in a notification.
 *
 * A clock-out with no open shift is refused (409, `code: "not_clocked_in"`)
 * unless `startedAt` is supplied, in which case the missed clock-in is
 * back-filled and the shift is saved in one step.
 */
export const POST = handler(async (req) => {
  const body = await readJson<ClockBody>(req);
  const action = String(body.action ?? "").toLowerCase();
  const at = parseInstant(body.at, "at") ?? new Date();
  const now = Date.now();
  const s = await getSettings();
  const tz = s.timezone;
  const open = await getOpenShift();

  if (action === "in") {
    if (open) {
      return error(
        `Already clocked in since ${fmtTime(Date.parse(open.clockIn), tz)} (${fmtDuration(now - Date.parse(open.clockIn))}). Clock out first.`,
        409,
      );
    }
    const [row] = await (await db())
      .insert(shifts)
      .values({ clockIn: at, note: "", source: body.source ?? "shortcut" })
      .returning();
    const sum = await summarize(s, now);
    return json({
      ok: true,
      action: "in",
      shift: toShift(row),
      message: `Clocked in at ${fmtTime(at, tz)}. ${summaryLine(sum)}`,
      todayHours: +(sum.todayMs / 3_600_000).toFixed(2),
      periodHours: +(sum.periodMs / 3_600_000).toFixed(2),
      periodPay: sum.periodPay,
    });
  }

  if (action === "out") {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const startedAt = parseInstant(body.startedAt, "startedAt");
    let row;
    let clockIn: number;
    let backfilled = false;

    if (open) {
      clockIn = Date.parse(open.clockIn);
      const invalid = isValidShiftRange(clockIn, at.getTime());
      if (invalid) return error(invalid, 422);
      [row] = await (await db())
        .update(shifts)
        .set({ clockOut: at, note, updatedAt: new Date() })
        .where(eq(shifts.id, open.id))
        .returning();
    } else if (startedAt) {
      // Missed the clock-in: back-fill it from the supplied start time.
      clockIn = startedAt.getTime();
      const invalid = isValidShiftRange(clockIn, at.getTime());
      if (invalid) return error(invalid, 422);
      backfilled = true;
      [row] = await (await db())
        .insert(shifts)
        .values({ clockIn: startedAt, clockOut: at, note, source: body.source ?? "shortcut" })
        .returning();
    } else {
      return NextResponse.json(
        {
          error: "You're not clocked in. Clock in first, or send startedAt with the time you actually started.",
          code: "not_clocked_in",
        },
        { status: 409 },
      );
    }

    const sum = await summarize(s, now);
    const worked = fmtDuration(at.getTime() - clockIn);
    const prefix = backfilled ? `Saved ${fmtTime(clockIn, tz)} – ${fmtTime(at, tz)}` : `Clocked out at ${fmtTime(at, tz)}`;
    return json({
      ok: true,
      action: "out",
      backfilled,
      shift: toShift(row),
      message: `${prefix} · ${worked} this shift. ${summaryLine(sum)}`,
      shiftDuration: worked,
      todayHours: +(sum.todayMs / 3_600_000).toFixed(2),
      periodHours: +(sum.periodMs / 3_600_000).toFixed(2),
      periodPay: sum.periodPay,
    });
  }

  return error('action must be "in" or "out"', 400);
});

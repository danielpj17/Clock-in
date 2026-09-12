import { error, handler, json } from "@/lib/api";
import { getSettings, listShifts } from "@/lib/data";
import { diffDays, fmtDateRange, isLocalDate, todayIn } from "@/lib/dates";
import { fmtDuration, fmtMoney, shiftDate, totalMs } from "@/lib/hours";
import { periodBounds, periodFor } from "@/lib/periods";

export const dynamic = "force-dynamic";

/**
 * GET /api/period?date=YYYY-MM-DD
 * Used by the weekly "Timesheet Reminder" automation. Tells the Shortcut
 * whether `date` (default: today) is the last day of a pay period, plus the
 * period's totals so the notification can show them.
 */
export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const s = await getSettings();
  const now = Date.now();
  const dateParam = url.searchParams.get("date");
  if (dateParam && !isLocalDate(dateParam)) return error("date must be YYYY-MM-DD");
  const today = dateParam ?? todayIn(s.timezone, now);

  const period = periodFor(today, s);
  const { from, to } = periodBounds(period, s.timezone);
  const rows = (await listShifts(from, to)).filter((r) => {
    const d = shiftDate(r, s.timezone);
    return d >= period.start && d <= period.end;
  });
  const ms = totalMs(rows, now);
  const hours = ms / 3_600_000;
  const pay = s.hourlyRate == null ? null : Math.round(hours * s.hourlyRate * 100) / 100;
  const daysRemaining = diffDays(period.end, today);
  const isLastDay = daysRemaining === 0;
  const label = fmtDateRange(period.start, period.end);
  const payText = pay != null ? ` (${fmtMoney(pay)})` : "";

  return json({
    ok: true,
    date: today,
    start: period.start,
    end: period.end,
    label,
    isLastDay,
    daysRemaining,
    shifts: rows.length,
    totalHours: +hours.toFixed(2),
    pay,
    message: isLastDay
      ? `Pay period ${label} ends today — ${fmtDuration(ms)}${payText}. Time to submit your hours!`
      : `Pay period ${label}: ${fmtDuration(ms)}${payText} so far, ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left.`,
    reportUrl: `${url.origin}/report?start=${period.start}`,
  });
});

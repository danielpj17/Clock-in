import { handler, json } from "@/lib/api";
import { getOpenShift, getSettings, summarize, summaryLine } from "@/lib/data";
import { fmtTime } from "@/lib/dates";
import { fmtDuration } from "@/lib/hours";

export const dynamic = "force-dynamic";

/** GET /api/status → current open shift + today/period totals. */
export const GET = handler(async () => {
  const now = Date.now();
  const s = await getSettings();
  const open = await getOpenShift();
  const sum = await summarize(s, now);
  const status = open
    ? `Clocked in since ${fmtTime(Date.parse(open.clockIn), s.timezone)} (${fmtDuration(now - Date.parse(open.clockIn))})`
    : "Not clocked in";
  return json({
    ok: true,
    open,
    clockedIn: !!open,
    /** "in" | "out" — plain text so a Shortcut "If" can compare it reliably. */
    state: open ? "in" : "out",
    status,
    summary: summaryLine(sum),
    todayHours: +(sum.todayMs / 3_600_000).toFixed(2),
    periodHours: +(sum.periodMs / 3_600_000).toFixed(2),
    periodPay: sum.periodPay,
    period: sum.period,
    settings: s,
  });
});

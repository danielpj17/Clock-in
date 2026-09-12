import { error, handler, json } from "@/lib/api";
import { getSettings, listShifts } from "@/lib/data";
import { isLocalDate, todayIn } from "@/lib/dates";
import { periodBounds, periodFor } from "@/lib/periods";
import { buildReport, toCSV, toText, toTSV } from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * GET /api/report?start=YYYY-MM-DD&format=json|tsv|csv|text
 * `start` is any date inside the wanted pay period (default: today).
 */
export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const s = await getSettings();
  const now = Date.now();
  const startParam = url.searchParams.get("start");
  if (startParam && !isLocalDate(startParam)) return error("start must be YYYY-MM-DD");
  const period = periodFor(startParam ?? todayIn(s.timezone, now), s);
  const { from, to } = periodBounds(period, s.timezone);
  const rows = await listShifts(from, to);
  const report = buildReport(rows, period, s.timezone, s.hourlyRate, now);

  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const filename = `timesheet-${period.start}_to_${period.end}`;
  switch (format) {
    case "tsv":
      return new Response(toTSV(report), {
        headers: { "content-type": "text/tab-separated-values; charset=utf-8" },
      });
    case "csv":
      return new Response(toCSV(report), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    case "text":
      return new Response(toText(report), {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    case "json":
      return json({ ok: true, report, tsv: toTSV(report), text: toText(report), csv: toCSV(report) });
    default:
      return error("format must be json, tsv, csv or text");
  }
});

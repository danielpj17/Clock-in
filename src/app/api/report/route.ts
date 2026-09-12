import { error, handler, json } from "@/lib/api";
import { getSettings, listShifts } from "@/lib/data";
import { isLocalDate, todayIn } from "@/lib/dates";
import { periodBounds, periodFor } from "@/lib/periods";
import { buildReport, toCSV, toHTML, toSheet, toText, toTSV } from "@/lib/report";
import { toXLSX } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

/**
 * GET /api/report?start=YYYY-MM-DD&format=json|tsv|csv|xlsx|text
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
  const sheet = toSheet(report, s.employeeName);

  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const filename = `timesheet-${period.start}_to_${period.end}`;
  switch (format) {
    case "tsv":
      return new Response(toTSV(sheet), {
        headers: { "content-type": "text/tab-separated-values; charset=utf-8" },
      });
    case "csv":
      return new Response(toCSV(sheet), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    case "xlsx":
      return new Response(new Uint8Array(await toXLSX(sheet)), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    case "text":
      return new Response(toText(report, s.employeeName), {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    case "json":
      return json({
        ok: true,
        report,
        tsv: toTSV(sheet),
        html: toHTML(sheet),
        text: toText(report, s.employeeName),
        csv: toCSV(sheet),
      });
    default:
      return error("format must be json, tsv, csv, xlsx or text");
  }
});

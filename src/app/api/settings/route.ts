import { error, handler, json, readJson } from "@/lib/api";
import { getSettings, updateSettings, type AppSettings } from "@/lib/data";
import { isLocalDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const GET = handler(async () => json({ ok: true, settings: await getSettings() }));

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** PUT /api/settings — partial update; only provided keys change. */
export const PUT = handler(async (req) => {
  const body = await readJson<Partial<AppSettings>>(req);
  const patch: Partial<AppSettings> = {};

  if (body.periodAnchor !== undefined) {
    if (!isLocalDate(body.periodAnchor)) return error("periodAnchor must be YYYY-MM-DD");
    patch.periodAnchor = body.periodAnchor;
  }
  if (body.periodLengthDays !== undefined) {
    const n = Number(body.periodLengthDays);
    if (!Number.isInteger(n) || n < 1 || n > 62) return error("periodLengthDays must be 1–62");
    patch.periodLengthDays = n;
  }
  if (body.hourlyRate !== undefined) {
    if (body.hourlyRate === null || body.hourlyRate === ("" as unknown)) patch.hourlyRate = null;
    else {
      const r = Number(body.hourlyRate);
      if (!Number.isFinite(r) || r < 0) return error("hourlyRate must be a non-negative number");
      patch.hourlyRate = r;
    }
  }
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== "string" || !isValidTimezone(body.timezone)) {
      return error("timezone must be a valid IANA zone, e.g. America/Chicago");
    }
    patch.timezone = body.timezone;
  }
  if (body.dayStartHour !== undefined || body.dayEndHour !== undefined) {
    const cur = await getSettings();
    const start = body.dayStartHour !== undefined ? Number(body.dayStartHour) : cur.dayStartHour;
    const end = body.dayEndHour !== undefined ? Number(body.dayEndHour) : cur.dayEndHour;
    if (![start, end].every((h) => Number.isInteger(h) && h >= 0 && h <= 24) || end <= start) {
      return error("dayStartHour/dayEndHour must be 0–24 with end after start");
    }
    patch.dayStartHour = start;
    patch.dayEndHour = end;
  }

  return json({ ok: true, settings: await updateSettings(patch) });
});

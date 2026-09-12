import { db } from "@/db/client";
import { shifts } from "@/db/schema";
import { error, handler, json, parseInstant, readJson } from "@/lib/api";
import { getOpenShift, listShifts, toShift } from "@/lib/data";
import { isValidShiftRange } from "@/lib/hours";

export const dynamic = "force-dynamic";

/** GET /api/shifts?from=ISO&to=ISO → shifts overlapping [from, to). */
export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const from = parseInstant(url.searchParams.get("from"), "from");
  const to = parseInstant(url.searchParams.get("to"), "to");
  if (!from || !to) return error("from and to are required (ISO timestamps)");
  return json({ ok: true, shifts: await listShifts(from, to) });
});

interface ShiftBody {
  clockIn?: string | number;
  clockOut?: string | number | null;
  note?: string;
}

/** POST /api/shifts → manually add a completed (or open) shift. */
export const POST = handler(async (req) => {
  const body = await readJson<ShiftBody>(req);
  const clockIn = parseInstant(body.clockIn, "clockIn");
  if (!clockIn) return error("clockIn is required");
  const clockOut = parseInstant(body.clockOut, "clockOut");
  const invalid = isValidShiftRange(clockIn.getTime(), clockOut?.getTime() ?? null);
  if (invalid) return error(invalid, 422);
  if (!clockOut && (await getOpenShift())) {
    return error("There is already an open shift. Close it before adding another.", 409);
  }
  const [row] = await (await db())
    .insert(shifts)
    .values({
      clockIn,
      clockOut,
      note: typeof body.note === "string" ? body.note.trim() : "",
      source: "manual",
    })
    .returning();
  return json({ ok: true, shift: toShift(row) }, { status: 201 });
});

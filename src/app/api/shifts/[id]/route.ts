import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { shifts } from "@/db/schema";
import { error, handler, json, parseInstant, readJson } from "@/lib/api";
import { getOpenShift, toShift } from "@/lib/data";
import { isValidShiftRange } from "@/lib/hours";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface PatchBody {
  clockIn?: string | number;
  clockOut?: string | number | null;
  note?: string;
}

/** PATCH /api/shifts/:id → edit times and/or note. */
export const PATCH = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const [existing] = await (await db()).select().from(shifts).where(eq(shifts.id, id)).limit(1);
  if (!existing) return error("Shift not found", 404);

  const body = await readJson<PatchBody>(req);
  const clockIn = body.clockIn !== undefined ? parseInstant(body.clockIn, "clockIn") : existing.clockIn;
  if (!clockIn) return error("clockIn is required");
  const clockOut =
    body.clockOut !== undefined ? parseInstant(body.clockOut, "clockOut") : existing.clockOut;

  const invalid = isValidShiftRange(clockIn.getTime(), clockOut?.getTime() ?? null);
  if (invalid) return error(invalid, 422);
  if (!clockOut) {
    const open = await getOpenShift();
    if (open && open.id !== id) return error("Another shift is already open.", 409);
  }

  const [row] = await (await db())
    .update(shifts)
    .set({
      clockIn,
      clockOut,
      ...(typeof body.note === "string" && { note: body.note.trim() }),
      updatedAt: new Date(),
    })
    .where(eq(shifts.id, id))
    .returning();
  return json({ ok: true, shift: toShift(row) });
});

/** DELETE /api/shifts/:id */
export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const rows = await (await db()).delete(shifts).where(eq(shifts.id, id)).returning();
  if (!rows.length) return error("Shift not found", 404);
  return json({ ok: true, id });
});

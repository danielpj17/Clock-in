import { NextResponse } from "next/server";
import { requireAuth } from "./auth";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrap a route handler with auth + uniform error handling. */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    const denied = requireAuth(req);
    if (denied) return denied;
    try {
      return await fn(req, ctx);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Unexpected error";
      return error(msg, 500);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Body must be valid JSON");
  }
}

/** Parse an ISO string (or epoch ms) into a Date, or null if missing. */
export function parseInstant(v: unknown, label: string): Date | null {
  if (v === undefined || v === null || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  if (isNaN(d.getTime())) throw new Error(`${label} is not a valid date`);
  return d;
}

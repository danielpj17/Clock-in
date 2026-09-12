import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Returns a 401/500 response if the request isn't authorized, else null.
 * Accepts `Authorization: Bearer <APP_SECRET>` (Shortcut + PWA)
 * or `?token=<APP_SECRET>` (handy for a bookmark to /api/report?format=text).
 */
export function requireAuth(req: Request): NextResponse | null {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server is missing APP_SECRET" }, { status: 500 });
  }
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const query = new URL(req.url).searchParams.get("token") ?? "";
  const provided = bearer || query;
  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

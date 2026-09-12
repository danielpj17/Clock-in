import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import path from "node:path";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let _db: Promise<Db> | undefined;

/**
 * Production: Neon Postgres over HTTP (DATABASE_URL, injected by Vercel).
 * Local dev without DATABASE_URL: an embedded PGlite database in ./.pglite
 * with migrations from ./drizzle applied automatically — zero setup.
 */
export function db(): Promise<Db> {
  return (_db ??= create());
}

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema });
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(path.join(process.cwd(), ".pglite"));
  const local = drizzle(client, { schema });
  await migrate(local, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("[db] using local PGlite database at ./.pglite (set DATABASE_URL to use Neon)");
  return local;
}

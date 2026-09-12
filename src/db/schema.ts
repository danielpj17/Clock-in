import {
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clockIn: timestamp("clock_in", { withTimezone: true }).notNull(),
    // null = currently clocked in
    clockOut: timestamp("clock_out", { withTimezone: true }),
    note: text("note").notNull().default(""),
    source: text("source").notNull().default("app"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // At most one open shift at a time.
    uniqueIndex("shifts_one_open_idx")
      .on(sql`(${t.clockOut} IS NULL)`)
      .where(sql`${t.clockOut} IS NULL`),
  ],
);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  // A date on which some pay period started; every period is anchor + k*length.
  periodAnchor: date("period_anchor").notNull().default("2026-08-31"),
  periodLengthDays: integer("period_length_days").notNull().default(14),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  timezone: text("timezone").notNull().default("America/Denver"),
  // Visible hour range on the week grid (0–24)
  dayStartHour: integer("day_start_hour").notNull().default(6),
  dayEndHour: integer("day_end_hour").notNull().default(22),
});

export type ShiftRow = typeof shifts.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;

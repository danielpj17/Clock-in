import type { Shift } from "./hours";

/** Shape returned by GET /api/status (mirrors src/lib/data.ts). */
export interface AppSettings {
  periodAnchor: string;
  periodLengthDays: number;
  hourlyRate: number | null;
  employeeName: string;
  timezone: string;
  dayStartHour: number;
  dayEndHour: number;
}

export interface StatusResponse {
  ok: true;
  open: Shift | null;
  clockedIn: boolean;
  state: "in" | "out";
  status: string;
  summary: string;
  todayHours: number;
  periodHours: number;
  periodPay: number | null;
  period: { start: string; end: string };
  settings: AppSettings;
}

export interface ClockResponse {
  ok: true;
  action: "in" | "out";
  backfilled?: boolean;
  shift: Shift;
  message: string;
  todayHours: number;
  periodHours: number;
  periodPay: number | null;
}

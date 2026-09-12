"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { addDays, endOfLocalDay, fmtDateRange, isLocalDate, startOfLocalDay, todayIn } from "@/lib/dates";
import { useNow, useRefreshOnFocus } from "@/lib/hooks";
import { fmtDuration, fmtMoney, type Shift } from "@/lib/hours";
import { weekFor } from "@/lib/periods";
import type { StatusResponse } from "@/lib/types";
import { ClockButton } from "./ClockButton";
import { useGate } from "./SecretGate";
import { ShiftSheet } from "./ShiftSheet";
import { Toast } from "./Toast";
import { WeekGrid } from "./WeekGrid";

const STALE_OPEN_MS = 16 * 3_600_000;

export function WeekView() {
  const router = useRouter();
  const params = useSearchParams();
  const { lock } = useGate();
  const now = useNow(30_000);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Shift | null | "new">(null);

  const tz = status?.settings.timezone;
  const today = tz ? todayIn(tz, now) : null;
  const weekParam = params.get("week");
  const weekStart = today ? (isLocalDate(weekParam) ? weekFor(weekParam).start : weekFor(today).start) : null;

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api<StatusResponse>("/api/status"));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) lock();
      else setError((e as Error).message);
    }
  }, [lock]);

  const loadShifts = useCallback(
    async (zone: string, start: string) => {
      // One day of padding on each side so overnight shifts render fully.
      const from = startOfLocalDay(addDays(start, -1), zone).toISOString();
      const to = endOfLocalDay(addDays(start, 7), zone).toISOString();
      try {
        const res = await api<{ shifts: Shift[] }>(`/api/shifts?from=${from}&to=${to}`);
        setShifts(res.shifts);
        setError(null);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) lock();
        else setError((e as Error).message);
      }
    },
    [lock],
  );

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);
  useEffect(() => {
    if (tz && weekStart) loadShifts(tz, weekStart);
  }, [tz, weekStart, loadShifts]);

  function refresh() {
    loadStatus();
    if (tz && weekStart) loadShifts(tz, weekStart);
  }
  useRefreshOnFocus(refresh);

  function go(delta: number | "today") {
    if (!weekStart || !today) return;
    const target = delta === "today" ? today : addDays(weekStart, delta * 7);
    router.replace(delta === "today" ? "/" : `/?week=${target}`);
  }

  if (!status || !tz || !today || !weekStart) {
    return (
      <div className="py-20 text-center text-muted">
        {error ? <span className="text-danger">{error}</span> : "Loading…"}
      </div>
    );
  }

  const s = status.settings;
  const open = status.open;
  const staleOpen = open && now - Date.parse(open.clockIn) > STALE_OPEN_MS;
  const isThisWeek = weekStart === weekFor(today).start;

  return (
    <div className="mx-auto max-w-5xl">
      <Toast message={toast} onDone={() => setToast(null)} />

      <header className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-secondary px-2" onClick={() => go(-1)} aria-label="Previous week">
            ‹
          </button>
          <button type="button" className="btn-secondary px-2" onClick={() => go(1)} aria-label="Next week">
            ›
          </button>
          {!isThisWeek && (
            <button type="button" className="btn-secondary" onClick={() => go("today")}>
              Today
            </button>
          )}
        </div>
        <h1 className="text-lg font-semibold">
          {fmtDateRange(weekStart, addDays(weekStart, 6))}
          <span className="ml-1 text-muted">{weekStart.slice(0, 4)}</span>
        </h1>
        <button type="button" className="btn-secondary ml-auto" onClick={() => setEditing("new")}>
          + Add shift
        </button>
      </header>

      <Link
        href={`/report?start=${status.period.start}`}
        className="card mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
      >
        <span className="text-muted">Pay period</span>
        <span className="font-medium">{fmtDateRange(status.period.start, status.period.end)}</span>
        <span className="ml-auto font-semibold">{status.periodHours.toFixed(2)} hrs</span>
        {status.periodPay != null && <span className="font-semibold text-accent-text">{fmtMoney(status.periodPay)}</span>}
        <span className="text-muted">›</span>
      </Link>

      {staleOpen && open && (
        <button
          type="button"
          onClick={() => setEditing(open)}
          className="mb-3 w-full rounded-lg bg-warn-soft px-3 py-2 text-left text-sm text-warn-text"
        >
          Looks like you forgot to clock out — this shift has been open for {fmtDuration(now - Date.parse(open.clockIn))}.
          Tap to fix it.
        </button>
      )}

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <WeekGrid
        weekStart={weekStart}
        today={today}
        shifts={shifts}
        tz={tz}
        dayStartHour={s.dayStartHour}
        dayEndHour={s.dayEndHour}
        now={now}
        onSelect={(sh) => setEditing(sh)}
      />

      <p className="mt-2 text-xs text-muted">
        Today: {status.todayHours.toFixed(2)} hrs · {status.status}
      </p>

      <ClockButton
        open={open}
        now={now}
        onChanged={(msg) => {
          setToast(msg);
          refresh();
        }}
      />

      {editing !== null && (
        <ShiftSheet
          key={editing === "new" ? "new" : editing.id}
          shift={editing === "new" ? null : editing}
          defaultStart={isThisWeek ? now - 3_600_000 : startOfLocalDay(weekStart, tz).getTime() + 9 * 3_600_000}
          tz={tz}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

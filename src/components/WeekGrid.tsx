"use client";

import { useEffect, useRef } from "react";
import { addDays, fmtLocalDate, fmtTime, startOfLocalDay, type LocalDate } from "@/lib/dates";
import { fmtDuration, shiftDate, splitShiftByDay, totalMs, type Shift } from "@/lib/hours";

const HOUR_PX = 44;
const GUTTER_PX = 44;
const MIN_COL_PX = 92;

interface Props {
  weekStart: LocalDate;
  today: LocalDate;
  shifts: Shift[];
  tz: string;
  dayStartHour: number;
  dayEndHour: number;
  now: number;
  onSelect: (s: Shift) => void;
}

function hourLabel(h: number) {
  if (h === 0 || h === 24) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export function WeekGrid({ weekStart, today, shifts, tz, dayStartHour, dayEndHour, now, onSelect }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const segments = shifts.flatMap((s) => splitShiftByDay(s, tz, now)).filter((seg) => days.includes(seg.date));

  // Expand the visible range if a shift falls outside the configured hours.
  let startHour = dayStartHour;
  let endHour = dayEndHour;
  for (const seg of segments) {
    const dayStart = startOfLocalDay(seg.date, tz).getTime();
    startHour = Math.min(startHour, Math.floor((seg.start - dayStart) / 3_600_000));
    endHour = Math.max(endHour, Math.ceil((seg.end - dayStart) / 3_600_000));
  }
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const bodyHeight = hours.length * HOUR_PX;

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // On phones, scroll today's column into view once.
    const el = scroller.current;
    if (!el) return;
    const idx = days.indexOf(today);
    if (idx < 0) return;
    const col = el.querySelector<HTMLElement>(`[data-day="${today}"]`);
    if (col && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = Math.max(0, col.offsetLeft - GUTTER_PX - 8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, today]);

  const dayTotals = days.map((d) => totalMs(shifts.filter((s) => shiftDate(s, tz) === d), now));
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  const nowTop = (() => {
    const dayStart = startOfLocalDay(today, tz).getTime();
    const h = (now - dayStart) / 3_600_000;
    return h >= startHour && h <= endHour ? (h - startHour) * HOUR_PX : null;
  })();

  return (
    <div ref={scroller} className="card overflow-x-auto overflow-y-hidden">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${GUTTER_PX}px repeat(7, minmax(${MIN_COL_PX}px, 1fr))`,
          minWidth: GUTTER_PX + 7 * MIN_COL_PX,
        }}
      >
        {/* Header */}
        <div className="sticky left-0 z-20 border-b border-border bg-surface" />
        {days.map((d) => {
          const isToday = d === today;
          return (
            <div
              key={d}
              data-day={d}
              className={`border-b border-l border-border px-1 py-1.5 text-center ${isToday ? "bg-accent-soft/40" : ""}`}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted">{fmtLocalDate(d, "EEE")}</div>
              <div
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? "bg-accent text-white" : ""
                }`}
              >
                {fmtLocalDate(d, "d")}
              </div>
            </div>
          );
        })}

        {/* Time gutter */}
        {/* sticky is a positioned ancestor, so the absolute labels anchor to it */}
        <div className="sticky left-0 z-20 bg-surface" style={{ height: bodyHeight }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[10px] text-muted"
              style={{ top: i * HOUR_PX }}
            >
              {i === 0 ? "" : hourLabel(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d) => (
          <div key={d} className="relative border-l border-border" style={{ height: bodyHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-border/70"
                style={{ top: i * HOUR_PX, height: HOUR_PX }}
              />
            ))}
            {d === today && nowTop !== null && (
              <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger/80" style={{ top: nowTop }}>
                <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-danger" />
              </div>
            )}
            {segments
              .filter((seg) => seg.date === d)
              .map((seg) => {
                const dayStart = startOfLocalDay(d, tz).getTime();
                const top = ((seg.start - dayStart) / 3_600_000 - startHour) * HOUR_PX;
                const height = Math.max(18, ((seg.end - seg.start) / 3_600_000) * HOUR_PX);
                const open = !seg.shift.clockOut;
                const continues = seg.end < (seg.shift.clockOut ? Date.parse(seg.shift.clockOut) : now);
                const continued = seg.start > Date.parse(seg.shift.clockIn);
                return (
                  <button
                    key={`${seg.shift.id}-${seg.start}`}
                    type="button"
                    onClick={() => onSelect(seg.shift)}
                    title={seg.shift.note}
                    className={`absolute inset-x-0.5 z-[5] overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight ${
                      open
                        ? "live-block border-live bg-live-soft text-text"
                        : "border-accent/50 bg-accent-soft text-accent-text"
                    } ${continues ? "rounded-b-none" : ""} ${continued ? "rounded-t-none" : ""}`}
                    style={{ top, height }}
                  >
                    <div className="font-semibold">
                      {fmtTime(seg.shift.clockIn, tz)} – {open ? "now" : fmtTime(seg.shift.clockOut!, tz)}
                    </div>
                    {height > 34 && (
                      <div className="text-[10px] opacity-80">
                        {fmtDuration((seg.shift.clockOut ? Date.parse(seg.shift.clockOut) : now) - Date.parse(seg.shift.clockIn))}
                      </div>
                    )}
                    {height > 50 && seg.shift.note && (
                      <div className="mt-0.5 line-clamp-3 text-[10px] opacity-90">{seg.shift.note}</div>
                    )}
                  </button>
                );
              })}
          </div>
        ))}

        {/* Footer totals */}
        <div className="sticky left-0 z-20 border-t border-border bg-surface px-1 py-1.5 text-[10px] text-muted">
          Total
        </div>
        {dayTotals.map((ms, i) => (
          <div
            key={days[i]}
            className={`border-l border-t border-border px-1 py-1.5 text-center text-xs font-medium ${
              ms ? "" : "text-muted/60"
            }`}
          >
            {ms ? (ms / 3_600_000).toFixed(2) : "–"}
          </div>
        ))}
      </div>
      <div className="border-t border-border px-3 py-2 text-right text-sm">
        Week total: <span className="font-semibold">{(weekTotal / 3_600_000).toFixed(2)} hrs</span>
      </div>
    </div>
  );
}

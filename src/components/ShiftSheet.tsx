"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { fromLocalInput, toLocalInput } from "@/lib/dates";
import { fmtDuration, isValidShiftRange, type Shift } from "@/lib/hours";

interface Props {
  /** Existing shift to edit, or null to create a new one. */
  shift: Shift | null;
  /** Default clock-in for a new shift (ms). */
  defaultStart: number;
  tz: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Bottom-sheet editor. The parent keys this component by shift id so state
 * initializes fresh for each shift instead of being synced in an effect.
 */
export function ShiftSheet({ shift, defaultStart, tz, onClose, onSaved }: Props) {
  const isNew = !shift;
  const initialStart = defaultStart;
  const [clockIn, setClockIn] = useState(() =>
    shift ? toLocalInput(shift.clockIn, tz) : toLocalInput(initialStart, tz),
  );
  const [clockOut, setClockOut] = useState(() =>
    shift ? (shift.clockOut ? toLocalInput(shift.clockOut, tz) : "") : toLocalInput(initialStart + 3_600_000, tz),
  );
  const [stillOpen, setStillOpen] = useState(() => !!shift && !shift.clockOut);
  const [note, setNote] = useState(shift?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const inDate = fromLocalInput(clockIn, tz);
  const outDate = stillOpen ? null : fromLocalInput(clockOut, tz);
  const rangeError = inDate ? isValidShiftRange(inDate.getTime(), outDate?.getTime() ?? (stillOpen ? null : NaN)) : "Enter a clock-in time";
  const duration = inDate && outDate ? fmtDuration(outDate.getTime() - inDate.getTime()) : null;

  async function save() {
    if (!inDate || rangeError) return;
    setBusy(true);
    setError(null);
    const body = { clockIn: inDate.toISOString(), clockOut: outDate ? outDate.toISOString() : null, note };
    try {
      if (isNew) await api("/api/shifts", { method: "POST", body: JSON.stringify(body) });
      else await api(`/api/shifts/${shift.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!shift) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await api(`/api/shifts/${shift.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{isNew ? "Add shift" : "Edit shift"}</h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Clock in</label>
            <input className="input" type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
          </div>
          <div>
            <label className="label">Clock out</label>
            <input
              className="input"
              type="datetime-local"
              value={clockOut}
              disabled={stillOpen}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            aria-label="Still clocked in"
            checked={stillOpen}
            onChange={(e) => setStillOpen(e.target.checked)}
          />
          <span>Still clocked in</span>
        </div>

        <div className="mt-3">
          <label className="label">What did you work on?</label>
          <textarea className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </div>

        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted">{duration ? `Duration: ${duration}` : stillOpen ? "Open shift" : ""}</span>
          {rangeError && clockIn && <span className="text-danger">{rangeError}</span>}
        </div>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}

        <div className="mt-4 flex gap-2">
          {!isNew && (
            <button type="button" className="btn-danger" onClick={remove} disabled={busy}>
              {confirmDelete ? "Really delete?" : "Delete"}
            </button>
          )}
          <button type="button" className="btn-primary ml-auto" onClick={save} disabled={busy || !!rangeError}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

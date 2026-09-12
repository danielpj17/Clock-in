"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { fmtDuration, type Shift } from "@/lib/hours";
import type { ClockResponse } from "@/lib/types";

interface Props {
  open: Shift | null;
  now: number;
  onChanged: (message: string) => void;
}

/** Floating clock in / clock out control (same API the Shortcut uses). */
export function ClockButton({ open, now, onChanged }: Props) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clock(action: "in" | "out") {
    setBusy(true);
    setError(null);
    try {
      const res = await api<ClockResponse>("/api/clock", {
        method: "POST",
        body: JSON.stringify({ action, note, source: "app" }),
      });
      setAsking(false);
      setNote("");
      onChanged(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] right-4 z-30">
        {open ? (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="btn rounded-full bg-live px-5 py-3 text-white shadow-lg"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Clock out · {fmtDuration(now - Date.parse(open.clockIn))}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => clock("in")}
            disabled={busy}
            className="btn rounded-full bg-accent px-5 py-3 text-white shadow-lg"
          >
            {busy ? "…" : "Clock in"}
          </button>
        )}
      </div>

      {asking && open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setAsking(false)}>
          <div className="card w-full max-w-lg p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">Clock out</h2>
            <p className="mt-1 text-sm text-muted">
              You&apos;ve been clocked in for {fmtDuration(now - Date.parse(open.clockIn))}. What did you work on?
            </p>
            <textarea
              className="input mt-3 min-h-24"
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Built the login page, fixed the invoice bug"
            />
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setAsking(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={() => clock("out")} disabled={busy}>
                {busy ? "Saving…" : "Clock out"}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && !asking && (
        <div className="fixed bottom-[calc(120px+env(safe-area-inset-bottom))] right-4 z-30 rounded-lg bg-danger px-3 py-2 text-sm text-white shadow">
          {error}
        </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, getSecret } from "@/lib/api-client";
import { fmtDateRange, fmtLocalDate, todayIn } from "@/lib/dates";
import { periodFor } from "@/lib/periods";
import type { AppSettings } from "@/lib/types";
import { useGate } from "./SecretGate";
import { Toast } from "./Toast";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function SettingsView() {
  const { lock } = useGate();
  const [s, setS] = useState<AppSettings | null>(null);
  const [form, setForm] = useState<{
    periodAnchor: string;
    periodLengthDays: string;
    hourlyRate: string;
    timezone: string;
    dayStartHour: string;
    dayEndHour: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ settings: AppSettings }>("/api/settings");
      setS(res.settings);
      setForm({
        periodAnchor: res.settings.periodAnchor,
        periodLengthDays: String(res.settings.periodLengthDays),
        hourlyRate: res.settings.hourlyRate == null ? "" : String(res.settings.hourlyRate),
        timezone: res.settings.timezone,
        dayStartHour: String(res.settings.dayStartHour),
        dayEndHour: String(res.settings.dayEndHour),
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) lock();
      else setError((e as Error).message);
    }
  }, [lock]);

  useEffect(() => {
    load();
    setOrigin(window.location.origin);
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ settings: AppSettings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          periodAnchor: form.periodAnchor,
          periodLengthDays: Number(form.periodLengthDays),
          hourlyRate: form.hourlyRate.trim() === "" ? null : Number(form.hourlyRate),
          timezone: form.timezone,
          dayStartHour: Number(form.dayStartHour),
          dayEndHour: Number(form.dayEndHour),
        }),
      });
      setS(res.settings);
      setToast("Settings saved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label} copied`);
    } catch {
      setToast("Couldn't copy");
    }
  }

  if (!form || !s) {
    return (
      <div className="py-20 text-center text-muted">
        {error ? <span className="text-danger">{error}</span> : "Loading…"}
      </div>
    );
  }

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const preview = (() => {
    try {
      const len = Number(form.periodLengthDays);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.periodAnchor) || !(len >= 1)) return null;
      const p = periodFor(todayIn(form.timezone || s.timezone), { periodAnchor: form.periodAnchor, periodLengthDays: len });
      const endDow = WEEKDAYS[new Date(p.end + "T12:00:00Z").getUTCDay()];
      return { label: fmtDateRange(p.start, p.end), endDow, endLabel: fmtLocalDate(p.end, "EEE, MMM d") };
    } catch {
      return null;
    }
  })();

  const secret = getSecret();
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-2xl">
      <Toast message={toast} onDone={() => setToast(null)} />
      <h1 className="mb-3 text-lg font-semibold">Settings</h1>

      <form onSubmit={save} className="card space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Pay period start date</label>
            <input className="input" type="date" value={form.periodAnchor} onChange={f("periodAnchor")} required />
            <p className="mt-1 text-xs text-muted">Any day a pay period began. Periods repeat from here.</p>
          </div>
          <div>
            <label className="label">Period length (days)</label>
            <input className="input" type="number" min={1} max={62} value={form.periodLengthDays} onChange={f("periodLengthDays")} required />
            <p className="mt-1 text-xs text-muted">14 = every other week.</p>
          </div>
        </div>
        {preview && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            Current period: <span className="font-medium">{preview.label}</span>. Periods end on {preview.endDow}s; this one
            ends <span className="font-medium">{preview.endLabel}</span>.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Hourly rate ($)</label>
            <input className="input" type="number" min={0} step="0.01" placeholder="optional" value={form.hourlyRate} onChange={f("hourlyRate")} />
          </div>
          <div>
            <label className="label">Time zone</label>
            <input className="input" list="tz-list" value={form.timezone} onChange={f("timezone")} required />
            <datalist id="tz-list">
              {[browserTz, "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((z) => (
                  <option key={z} value={z} />
                ))}
            </datalist>
            {browserTz !== form.timezone && (
              <button type="button" className="mt-1 text-xs text-accent" onClick={() => setForm({ ...form, timezone: browserTz })}>
                Use this device&apos;s zone ({browserTz})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Grid starts at (hour, 0–23)</label>
            <input className="input" type="number" min={0} max={23} value={form.dayStartHour} onChange={f("dayStartHour")} />
          </div>
          <div>
            <label className="label">Grid ends at (hour, 1–24)</label>
            <input className="input" type="number" min={1} max={24} value={form.dayEndHour} onChange={f("dayEndHour")} />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <section className="card mt-4 p-4">
        <h2 className="font-semibold">iPhone Shortcut setup</h2>
        <p className="mt-1 text-sm text-muted">
          Build the two Shortcuts on your phone using these values. Full step-by-step instructions are in{" "}
          <code className="font-mono">docs/shortcut.md</code> in the repo.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="App URL" value={origin} onCopy={() => copy(origin, "URL")} />
          <Row label="Clock endpoint" value={`${origin}/api/clock`} onCopy={() => copy(`${origin}/api/clock`, "Endpoint")} />
          <Row label="Period endpoint" value={`${origin}/api/period`} onCopy={() => copy(`${origin}/api/period`, "Endpoint")} />
          <Row
            label="Authorization header"
            value={showSecret ? `Bearer ${secret}` : "Bearer ••••••••"}
            mono
            onCopy={() => copy(`Bearer ${secret}`, "Header value")}
            extra={
              <button type="button" className="text-xs text-accent" onClick={() => setShowSecret((v) => !v)}>
                {showSecret ? "hide" : "show"}
              </button>
            }
          />
        </dl>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
          <li>
            <b>Clock</b> shortcut: GET <code className="font-mono">/api/status</code> → Choose from Menu &ldquo;Clock
            in&rdquo; / &ldquo;Clock out&rdquo; → (out: Ask for Input; if <code className="font-mono">state</code> is{" "}
            <code className="font-mono">out</code>, also ask &ldquo;When did you start?&rdquo; and send it as{" "}
            <code className="font-mono">startedAt</code>) → POST <code className="font-mono">/api/clock</code> with header{" "}
            <code className="font-mono">Authorization</code> and JSON <code className="font-mono">{`{ "action": "in" }`}</code> or{" "}
            <code className="font-mono">{`{ "action": "out", "note": …, "startedAt"?: … }`}</code> → Show Notification with{" "}
            <code className="font-mono">message</code>.
          </li>
          <li>
            <b>Timesheet Reminder</b> shortcut: Get Contents of URL <code className="font-mono">GET /api/period</code> → If{" "}
            <code className="font-mono">isLastDay</code> is true → Show Notification with <code className="font-mono">message</code>. Add a
            weekly Time-of-Day automation on {preview?.endDow ?? "the period-end weekday"}.
          </li>
        </ol>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="font-semibold">This device</h2>
        <p className="mt-1 text-sm text-muted">The app secret is stored only in this browser.</p>
        <button type="button" className="btn-danger mt-3" onClick={lock}>
          Forget secret & lock
        </button>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  onCopy,
  extra,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <dt className="w-40 shrink-0 text-muted">{label}</dt>
      <dd className={`min-w-0 flex-1 truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
      {extra}
      <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={onCopy}>
        Copy
      </button>
    </div>
  );
}

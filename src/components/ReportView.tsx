"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import { api, ApiError, getSecret } from "@/lib/api-client";
import { addDays, diffDays, isLocalDate } from "@/lib/dates";
import { useRefreshOnFocus } from "@/lib/hooks";
import { fmtMoney } from "@/lib/hours";
import type { Report } from "@/lib/report";
import { useGate } from "./SecretGate";
import { Toast } from "./Toast";

interface ReportResponse {
  report: Report;
  tsv: string;
  html: string;
  text: string;
  csv: string;
}

export function ReportView() {
  const router = useRouter();
  const params = useSearchParams();
  const { lock } = useGate();
  const startParam = params.get("start");
  const start = isLocalDate(startParam) ? startParam : null;

  const [data, setData] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = start ? `?start=${start}` : "";
      setData(await api<ReportResponse>(`/api/report${q}`));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) lock();
      else setError((e as Error).message);
    }
  }, [start, lock]);

  useEffect(() => {
    load();
  }, [load]);
  useRefreshOnFocus(load);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${what} copied`);
    } catch {
      setToast("Couldn't copy. Long-press the table to select it instead.");
    }
  }

  /** Rich copy: text/html keeps bold + outlines in Sheets/Excel; text/plain (TSV) is the fallback. */
  async function copySheet() {
    if (!data) return;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([data.html], { type: "text/html" }),
            "text/plain": new Blob([data.tsv], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(data.tsv);
      }
      setToast("Table copied — paste into cell A1 of a sheet");
    } catch {
      setToast("Couldn't copy. Long-press the table to select it instead.");
    }
  }

  async function share() {
    if (!data) return;
    const title = data.report.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: data.text });
        return;
      } catch {
        /* user cancelled */
        return;
      }
    }
    copy(data.text, "Report");
  }

  function download(format: "xlsx" | "csv") {
    if (!data) return;
    const p = data.report.period;
    // Served by the API so it works even where blob downloads are blocked.
    window.open(`/api/report?start=${p.start}&format=${format}&token=${encodeURIComponent(getSecret())}`, "_blank");
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-muted">
        {error ? <span className="text-danger">{error}</span> : "Loading…"}
      </div>
    );
  }

  const r = data.report;
  const periodLen = diffDays(r.period.end, r.period.start) + 1;
  const go = (delta: number) => router.replace(`/report?start=${addDays(r.period.start, delta * periodLen)}`);

  return (
    <div className="mx-auto max-w-3xl">
      <Toast message={toast} onDone={() => setToast(null)} />

      <header className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-nav" onClick={() => go(-1)} aria-label="Previous period">
          ‹
        </button>
        <h1 className="text-lg font-semibold">{r.title}</h1>
        <button type="button" className="btn-nav" onClick={() => go(1)} aria-label="Next period">
          ›
        </button>
        {start && (
          <button type="button" className="btn-secondary" onClick={() => router.replace("/report")}>
            Current
          </button>
        )}
      </header>

      <div className="card mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
        <div>
          <div className="text-xs text-muted">Hours</div>
          <div className="text-2xl font-semibold">{r.totalHours}</div>
        </div>
        {r.pay != null && (
          <div>
            <div className="text-xs text-muted">Pay @ {fmtMoney(r.rate!)}/h</div>
            <div className="text-2xl font-semibold text-accent-text">{fmtMoney(r.pay)}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-muted">Shifts</div>
          <div className="text-2xl font-semibold">{r.rows.length}</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={copySheet}>
          Copy for Google Sheets
        </button>
        <button type="button" className="btn-secondary" onClick={() => copy(data.text, "Text")}>
          Copy as text
        </button>
        <button type="button" className="btn-secondary" onClick={share}>
          Share…
        </button>
        <button type="button" className="btn-secondary" onClick={() => download("xlsx")}>
          Excel
        </button>
        <button type="button" className="btn-secondary" onClick={() => download("csv")}>
          CSV
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">In</th>
              <th className="px-3 py-2">Out</th>
              <th className="px-3 py-2 text-right">Hours</th>
              <th className="hidden px-3 py-2 sm:table-cell">Description</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  No shifts in this period.
                </td>
              </tr>
            )}
            {r.rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2">{row.dateLabel}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.inLabel}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {row.open ? <span className="text-live">open</span> : row.outLabel}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono">{row.hours}</td>
                  <td className="hidden min-w-40 px-3 py-2 text-muted sm:table-cell">{row.note}</td>
                </tr>
                {row.note && (
                  <tr className="sm:hidden">
                    <td colSpan={4} className="px-3 pb-2 pt-0 text-xs text-muted">
                      {row.note}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface-2 font-semibold">
              <td colSpan={3} className="px-3 py-2 text-right">
                Total
              </td>
              <td className="px-3 py-2 text-right font-mono">{r.totalHours}</td>
              <td className="hidden px-3 py-2 sm:table-cell">{r.pay != null ? fmtMoney(r.pay) : ""}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        Tip: &ldquo;Copy for Google Sheets&rdquo; copies the full timesheet layout (title, summary boxes, shift table) with
        bold and outlines — paste into cell A1. &ldquo;Excel&rdquo; downloads the same layout as a formatted .xlsx; CSV is
        plain values only.
      </p>
    </div>
  );
}


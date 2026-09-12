"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, getSecret, setSecret } from "@/lib/api-client";

interface GateCtx {
  /** Call when a request comes back 401 to send the user back to the lock screen. */
  lock: () => void;
}
const Ctx = createContext<GateCtx>({ lock: () => {} });
export const useGate = () => useContext(Ctx);

/** Blocks the UI until the shared secret is stored and verified against /api/status. */
export function SecretGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lock = useCallback(() => {
    setSecret("");
    setState("locked");
  }, []);

  useEffect(() => {
    // Convenience: /#secret=... stores the secret (fragments never reach the server).
    const m = /[#&]secret=([^&]+)/.exec(window.location.hash);
    if (m) {
      setSecret(decodeURIComponent(m[1]));
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (!getSecret()) {
      setState("locked");
      return;
    }
    api("/api/status")
      .then(() => setState("open"))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) lock();
        else setState("open"); // offline etc. — let the pages show their own errors
      });
  }, [lock]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSecret(value.trim());
    try {
      await api("/api/status");
      setState("open");
      setValue("");
    } catch (err) {
      setSecret("");
      setError(err instanceof ApiError && err.status === 401 ? "That secret didn't match." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") {
    return <div className="flex min-h-dvh items-center justify-center text-muted">Loading…</div>;
  }

  if (state === "locked") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 safe-top safe-bottom">
        <form onSubmit={submit} className="card w-full max-w-sm p-6">
          <h1 className="text-xl font-semibold">Clock In</h1>
          <p className="mt-1 text-sm text-muted">
            Enter the app secret (the <code className="font-mono">APP_SECRET</code> you set on Vercel). It&apos;s stored
            only on this device.
          </p>
          <input
            className="input mt-4 font-mono"
            type="password"
            autoComplete="current-password"
            placeholder="Secret"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <button className="btn-primary mt-4 w-full" disabled={busy || !value.trim()}>
            {busy ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return <Ctx.Provider value={{ lock }}>{children}</Ctx.Provider>;
}

"use client";

import { useEffect } from "react";

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, 4000);
    return () => clearTimeout(id);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 top-[calc(12px+env(safe-area-inset-top))] z-50 flex justify-center">
      <div className="rounded-lg bg-text px-4 py-2 text-sm text-bg shadow-lg">{message}</div>
    </div>
  );
}

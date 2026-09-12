import { Suspense } from "react";
import { WeekView } from "@/components/WeekView";

export default function WeekPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted">Loading…</div>}>
      <WeekView />
    </Suspense>
  );
}

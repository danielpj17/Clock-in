import { Suspense } from "react";
import { ReportView } from "@/components/ReportView";

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted">Loading…</div>}>
      <ReportView />
    </Suspense>
  );
}

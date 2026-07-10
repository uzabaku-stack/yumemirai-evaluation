"use client";

import { Printer } from "lucide-react";

export function StaffAnalysisPrintButton({ targetId }: { targetId: string }) {
  function printStaffAnalysis() {
    const target = document.getElementById(targetId);
    if (!target) return;

    const cleanup = () => {
      document.body.classList.remove("printing-staff-analysis");
      target.classList.remove("print-target");
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("printing-staff-analysis");
    target.classList.add("print-target");
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  return (
    <button
      type="button"
      onClick={printStaffAnalysis}
      className="no-print inline-flex min-h-12 items-center gap-2 rounded bg-clinic px-4 py-3 font-bold text-white"
    >
      <Printer size={18} />
      印刷
    </button>
  );
}

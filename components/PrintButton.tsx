"use client";
import { Printer } from "lucide-react";

export function PrintButton({ label = "印刷" }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="no-print inline-flex min-h-12 items-center gap-2 rounded bg-clinic px-5 py-3 font-bold text-white shadow-soft"><Printer size={18} />{label}</button>;
}

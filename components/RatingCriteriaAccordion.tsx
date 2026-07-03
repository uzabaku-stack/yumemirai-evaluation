"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function RatingCriteriaAccordion({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return <section className="rounded border-2 border-clinic/20 bg-white p-4 shadow-soft"><button type="button" onClick={() => setOpen((current) => !current)} className="flex min-h-16 w-full items-center justify-between gap-4 rounded bg-mint px-5 py-4 text-left text-xl font-bold text-clinic"><span>評価点の基準を見る</span>{open ? <ChevronUp size={26} /> : <ChevronDown size={26} />}</button>{open ? <div className="mt-4 rounded border border-teal-900/10 bg-slate-50 p-5 text-base leading-8 text-ink"><p className="whitespace-pre-wrap">{text}</p></div> : null}</section>;
}

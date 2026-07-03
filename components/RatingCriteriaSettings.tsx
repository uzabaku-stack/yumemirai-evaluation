"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import type { RatingCriterion } from "@/lib/types";

export function RatingCriteriaSettings({ initialCriteria }: { initialCriteria: RatingCriterion[] }) {
  const [criteria, setCriteria] = useState<RatingCriterion[]>(() => [...initialCriteria].sort((a, b) => a.score - b.score));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(score: number, patch: Partial<RatingCriterion>) {
    setSaved(false);
    setCriteria((current) => current.map((item) => item.score === score ? { ...item, ...patch } : item));
  }

  async function save() {
    const invalid = criteria.find((item) => !item.label.trim() || !item.description.trim());
    if (invalid) {
      alert("1点〜5点すべての見出しと説明文を入力してください。");
      return;
    }
    setSaving(true);
    setSaved(false);
    const response = await fetch("/api/rating-criteria", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria })
    });
    if (!response.ok) {
      alert("保存できませんでした。");
      setSaving(false);
      return;
    }
    const data = await response.json();
    setCriteria((data.criteria as RatingCriterion[]).sort((a, b) => a.score - b.score));
    setSaving(false);
    setSaved(true);
  }

  return <div className="space-y-5"><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">1〜5点の全体基準</h2><p className="mt-1 text-sm text-slate-600">評価入力・評価結果・PDFに共通で表示されます。</p></div><button onClick={save} disabled={saving} className="flex min-h-12 items-center gap-2 rounded bg-clinic px-6 py-3 font-bold text-white disabled:opacity-60"><Save size={20} />{saving ? "保存中" : "保存"}</button></div>{saved ? <div className="mt-4 rounded bg-mint px-4 py-3 font-bold text-clinic">保存しました。</div> : null}</div><div className="space-y-4">{criteria.map((item) => <section key={item.score} className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded bg-clinic text-xl font-bold text-white">{item.score}</span><label className="flex-1 space-y-2"><span className="font-bold">{item.score}点の見出し</span><input value={item.label} onChange={(event) => update(item.score, { label: event.target.value })} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" /></label></div><label className="mt-4 block space-y-2"><span className="font-bold">説明文</span><textarea value={item.description} onChange={(event) => update(item.score, { description: event.target.value })} className="min-h-36 w-full rounded border border-slate-300 p-4 text-base leading-7" placeholder="複数行で入力できます" /></label></section>)}</div><div className="sticky bottom-0 -mx-5 border-t bg-paper/95 p-4 backdrop-blur"><button onClick={save} disabled={saving} className="flex min-h-14 w-full items-center justify-center gap-2 rounded bg-clinic px-6 py-4 text-xl font-bold text-white disabled:opacity-60"><Save />{saving ? "保存中" : "評価基準を保存"}</button></div></div>;
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Eraser, Trash2 } from "lucide-react";
import type { Evaluation } from "@/lib/types";

type Props = {
  evaluations: Evaluation[];
};

function currentMonth() {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
}

function evaluationLabel(evaluation: Evaluation) {
  return [evaluation.staff_name || "氏名未設定", evaluation.evaluation_month, evaluation.entry_date].filter(Boolean).join(" / ");
}

export function EvaluationResultsTable({ evaluations }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const visibleIds = useMemo(() => evaluations.map((evaluation) => evaluation.id), [evaluations]);
  const selectedEvaluations = useMemo(() => evaluations.filter((evaluation) => selectedIds.includes(evaluation.id)), [evaluations, selectedIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const selectedCount = selectedIds.length;

  function setSelection(ids: number[]) {
    setSelectedIds(Array.from(new Set(ids)));
  }

  function toggleOne(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id]);
  }

  function toggleVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelection([...selectedIds, ...visibleIds]);
  }

  function selectThisMonth() {
    const month = currentMonth();
    setSelection(evaluations.filter((evaluation) => evaluation.evaluation_month === month).map((evaluation) => evaluation.id));
  }

  async function deleteIds(ids: number[]) {
    setDeleting(true);
    try {
      for (const id of ids) {
        const response = await fetch("/api/evaluations/" + id, { method: "DELETE" });
        if (!response.ok) throw new Error("delete failed");
      }
      setSelectedIds([]);
      router.push("/?deleted=1");
      router.refresh();
    } catch {
      alert("削除できませんでした。");
      setDeleting(false);
    }
  }

  async function bulkDelete() {
    if (!selectedIds.length) {
      alert("削除する評価を選択してください。");
      return;
    }
    const names = selectedEvaluations.map(evaluationLabel).slice(0, 50).join("\n");
    const extra = selectedEvaluations.length > 50 ? "\nほか " + String(selectedEvaluations.length - 50) + " 件" : "";
    const ok = window.confirm(String(selectedIds.length) + "件の評価を削除します。\nこの操作は元に戻せません。\n\n削除対象:\n" + names + extra);
    if (!ok) return;
    await deleteIds(selectedIds);
  }

  async function singleDelete(id: number) {
    const target = evaluations.find((evaluation) => evaluation.id === id);
    const ok = window.confirm("この評価を削除しますか？この操作は元に戻せません。\n\n削除対象:\n" + (target ? evaluationLabel(target) : "ID: " + id));
    if (!ok) return;
    await deleteIds([id]);
  }

  return <div className="mt-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSelection(visibleIds)} className="inline-flex min-h-12 items-center gap-2 rounded border border-slate-200 bg-white px-4 py-3 font-bold text-ink"><CheckSquare size={18} />全選択</button>
        <button type="button" onClick={() => setSelection([])} className="inline-flex min-h-12 items-center gap-2 rounded border border-slate-200 bg-white px-4 py-3 font-bold text-ink"><Eraser size={18} />選択解除</button>
        <button type="button" onClick={selectThisMonth} className="min-h-12 rounded border border-slate-200 bg-white px-4 py-3 font-bold text-ink">今月だけ選択</button>
        <button type="button" onClick={() => setSelection(visibleIds)} className="min-h-12 rounded border border-slate-200 bg-white px-4 py-3 font-bold text-ink">表示中のみ選択</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded bg-white px-4 py-3 font-bold text-slate-700">選択中: {selectedCount}件</span>
        <button type="button" onClick={bulkDelete} disabled={deleting || selectedCount === 0} className="inline-flex min-h-12 items-center gap-2 rounded bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-50"><Trash2 size={18} />選択した評価を削除{selectedCount ? "（" + selectedCount + "件）" : ""}</button>
      </div>
    </div>

    {selectedEvaluations.length ? <section className="rounded border border-red-100 bg-red-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-red-700">削除対象（{selectedEvaluations.length}件）</h3>
        <p className="text-sm font-semibold text-red-700">削除前に対象を確認してください。</p>
      </div>
      <div className="mt-3 max-h-80 overflow-y-auto rounded border border-red-100 bg-white">
        <ul className="divide-y divide-red-50">
          {selectedEvaluations.slice(0, 50).map((evaluation) => <li key={evaluation.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="font-bold text-ink">{evaluationLabel(evaluation)}</span><span className="text-slate-500">ID: {evaluation.id}</span></li>)}
          {selectedEvaluations.length > 50 ? <li className="px-4 py-3 text-sm font-bold text-slate-600">ほか {selectedEvaluations.length - 50} 件</li> : null}
        </ul>
      </div>
    </section> : null}

    <div className="max-h-[70vh] overflow-auto rounded border border-slate-200">
      <table className="w-full min-w-[900px] text-left">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b text-sm text-slate-500"><th className="w-16 py-3"><label className="flex min-h-11 items-center justify-center"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="h-5 w-5 rounded border-slate-300" aria-label="すべて選択" /></label></th><th className="py-3">氏名</th><th>評価年月</th><th>記載日</th><th>平均</th><th>ランク</th><th className="text-right">操作</th></tr>
        </thead>
        <tbody>{evaluations.length ? evaluations.map((evaluation) => <tr key={evaluation.id} className="border-b last:border-0"><td className="py-3"><label className="flex min-h-12 items-center justify-center"><input type="checkbox" checked={selectedIds.includes(evaluation.id)} onChange={() => toggleOne(evaluation.id)} className="h-5 w-5 rounded border-slate-300" aria-label={(evaluation.staff_name ?? "評価") + "を選択"} /></label></td><td className="py-4 font-semibold">{evaluation.staff_name}</td><td>{evaluation.evaluation_month}</td><td>{evaluation.entry_date}</td><td>{evaluation.average_score.toFixed(2)}</td><td><span className="rounded bg-mint px-3 py-1 font-bold text-clinic">{evaluation.rank}</span></td><td className="py-3 text-right"><div className="flex flex-wrap justify-end gap-2"><Link className="rounded bg-ink px-4 py-3 font-bold text-white" href={"/evaluations/" + evaluation.id}>結果</Link><button type="button" onClick={() => singleDelete(evaluation.id)} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded border border-red-200 px-4 py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"><Trash2 size={18} />削除</button></div></td></tr>) : <tr><td colSpan={7} className="py-8 text-center text-slate-500">表示できる評価はありません。</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}

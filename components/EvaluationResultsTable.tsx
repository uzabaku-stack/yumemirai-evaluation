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

export function EvaluationResultsTable({ evaluations }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const visibleIds = useMemo(() => evaluations.map((evaluation) => evaluation.id), [evaluations]);
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
    const ok = window.confirm(String(selectedIds.length) + "件の評価を削除します。\nこの操作は元に戻せません。");
    if (!ok) return;
    await deleteIds(selectedIds);
  }

  async function singleDelete(id: number) {
    const ok = window.confirm("この評価を削除しますか？この操作は元に戻せません。");
    if (!ok) return;
    await deleteIds([id]);
  }

  return <div className="mt-4 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelection(visibleIds)} className="inline-flex min-h-12 items-center gap-2 rounded border border-slate-200 bg-white px-4 py-3 font-bold text-ink"><CheckSquare size={18} />全選択</button><button type="button" onClick={() => setSelection([])} className="inline-flex min-h-12 items-center gap-2 rounded border border-slate-200 bg-white px-4 py-3 font-bold text-ink"><Eraser size={18} />全解除</button><button type="button" onClick={selectThisMonth} className="min-h-12 rounded border border-slate-200 bg-white px-4 py-3 font-bold text-ink">今月だけ選択</button><button type="button" onClick={() => setSelection(visibleIds)} className="min-h-12 rounded border border-slate-200 bg-white px-4 py-3 font-bold text-ink">表示中のみ選択</button></div><button type="button" onClick={bulkDelete} disabled={deleting || selectedCount === 0} className="inline-flex min-h-12 items-center gap-2 rounded bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-50"><Trash2 size={18} />選択した評価を削除{selectedCount ? "（" + selectedCount + "件）" : ""}</button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b text-sm text-slate-500"><th className="w-16 py-3"><label className="flex min-h-11 items-center justify-center"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="h-5 w-5 rounded border-slate-300" aria-label="すべて選択" /></label></th><th className="py-3">氏名</th><th>評価年月</th><th>記載日</th><th>平均</th><th>ランク</th><th className="text-right">操作</th></tr></thead><tbody>{evaluations.length ? evaluations.map((evaluation) => <tr key={evaluation.id} className="border-b last:border-0"><td className="py-3"><label className="flex min-h-12 items-center justify-center"><input type="checkbox" checked={selectedIds.includes(evaluation.id)} onChange={() => toggleOne(evaluation.id)} className="h-5 w-5 rounded border-slate-300" aria-label={(evaluation.staff_name ?? "評価") + "を選択"} /></label></td><td className="py-4 font-semibold">{evaluation.staff_name}</td><td>{evaluation.evaluation_month}</td><td>{evaluation.entry_date}</td><td>{evaluation.average_score.toFixed(2)}</td><td><span className="rounded bg-mint px-3 py-1 font-bold text-clinic">{evaluation.rank}</span></td><td className="py-3 text-right"><div className="flex flex-wrap justify-end gap-2"><Link className="rounded bg-ink px-4 py-3 font-bold text-white" href={"/evaluations/" + evaluation.id}>結果</Link><button type="button" onClick={() => singleDelete(evaluation.id)} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded border border-red-200 px-4 py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"><Trash2 size={18} />削除</button></div></td></tr>) : <tr><td colSpan={7} className="py-8 text-center text-slate-500">表示できる評価はありません。</td></tr>}</tbody></table></div></div>;
}

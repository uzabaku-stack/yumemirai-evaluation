"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Copy, Download, Edit3, Eraser, Eye, FileText, MoreVertical, Trash2 } from "lucide-react";
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

function typeLabel(type: Evaluation["evaluation_type"]) {
  if (type === "self") return "自己評価";
  if (type === "peer") return "360°評価";
  if (type === "director") return "院長評価";
  return "他者評価";
}

function escapeCsv(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadEvaluationCsv(evaluation: Evaluation) {
  const rows = [
    ["項目", "内容"],
    ["ID", evaluation.id],
    ["氏名", evaluation.staff_name ?? ""],
    ["評価年月", evaluation.evaluation_month],
    ["記載日", evaluation.entry_date],
    ["評価種別", typeLabel(evaluation.evaluation_type)],
    ["評価者", evaluation.evaluator_staff_name || evaluation.evaluator_name || ""],
    ["合計点", evaluation.total_score],
    ["満点", evaluation.max_score],
    ["平均点", Number.isFinite(evaluation.average_score) ? evaluation.average_score.toFixed(2) : ""],
    ["ランク", evaluation.rank],
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "evaluation-" + evaluation.id + ".csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function EvaluationResultsTable({ evaluations }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const visibleIds = useMemo(() => evaluations.map((evaluation) => evaluation.id), [evaluations]);
  const selectedEvaluations = useMemo(() => evaluations.filter((evaluation) => selectedIds.includes(evaluation.id)), [evaluations, selectedIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const selectedCount = selectedIds.length;

  function setSelection(ids: number[]) {
    setSelectedIds(Array.from(new Set(ids)));
    setMessage("");
  }

  function toggleOne(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id]));
    setMessage("");
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
    setMessage("");
    try {
      for (const id of ids) {
        const response = await fetch("/api/evaluations/" + id, { method: "DELETE" });
        if (!response.ok) throw new Error("delete failed");
      }
      setSelectedIds([]);
      setMessage(String(ids.length) + "件の評価を削除しました。");
      router.refresh();
    } catch (error) {
      console.error("delete evaluations failed", error);
      alert("削除できませんでした。");
    } finally {
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

  async function singleDelete(evaluation: Evaluation) {
    const ok = window.confirm("この評価を削除しますか？この操作は元に戻せません。\n\n削除対象:\n" + evaluationLabel(evaluation));
    if (!ok) return;
    await deleteIds([evaluation.id]);
  }

  async function duplicateEvaluation(evaluation: Evaluation) {
    const ok = window.confirm("この評価を複製して、新しい編集画面を開きますか？\n\n複製元:\n" + evaluationLabel(evaluation));
    if (!ok) return;
    setDuplicatingId(evaluation.id);
    try {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: evaluation.staff_id,
          evaluator_name: evaluation.evaluator_name,
          evaluation_type: evaluation.evaluation_type,
          evaluation_month: evaluation.evaluation_month,
          entry_date: new Date().toISOString().slice(0, 10),
          evaluation_cycle_id: evaluation.evaluation_cycle_id ?? undefined,
          is_360: evaluation.is_360 ?? 0,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "duplicate failed");
      router.push("/evaluations/" + data.id + "/edit");
      router.refresh();
    } catch (error) {
      console.error("duplicate evaluation failed", error);
      alert("複製できませんでした。");
    } finally {
      setDuplicatingId(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
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

      {message ? <div className="rounded border border-teal-200 bg-mint px-4 py-3 font-bold text-clinic">{message}</div> : null}

      {selectedEvaluations.length ? (
        <section className="rounded border border-red-100 bg-red-50 p-4">
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
        </section>
      ) : null}

      <div className="max-h-[70vh] overflow-auto rounded border border-slate-200">
        <table className="w-full min-w-[980px] text-left">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b text-sm text-slate-500">
              <th className="w-16 py-3"><label className="flex min-h-11 items-center justify-center"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="h-5 w-5 rounded border-slate-300" aria-label="すべて選択" /></label></th>
              <th className="py-3">氏名</th>
              <th>評価年月</th>
              <th>記載日</th>
              <th>評価種別</th>
              <th>平均</th>
              <th>ランク</th>
              <th className="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.length ? evaluations.map((evaluation) => (
              <tr key={evaluation.id} className="border-b last:border-0">
                <td className="py-3"><label className="flex min-h-12 items-center justify-center"><input type="checkbox" checked={selectedIds.includes(evaluation.id)} onChange={() => toggleOne(evaluation.id)} className="h-5 w-5 rounded border-slate-300" aria-label={(evaluation.staff_name ?? "評価") + "を選択"} /></label></td>
                <td className="py-4 font-semibold">{evaluation.staff_name}</td>
                <td>{evaluation.evaluation_month}</td>
                <td>{evaluation.entry_date}</td>
                <td><span className="rounded bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{typeLabel(evaluation.evaluation_type)}</span></td>
                <td>{Number.isFinite(evaluation.average_score) ? evaluation.average_score.toFixed(2) : "-"}</td>
                <td><span className="rounded bg-mint px-3 py-1 font-bold text-clinic">{evaluation.rank}</span></td>
                <td className="py-3 text-right">
                  <details className="relative inline-block text-left">
                    <summary className="grid min-h-12 w-12 cursor-pointer list-none place-items-center rounded border border-slate-200 bg-white text-ink hover:bg-slate-50" aria-label="操作メニュー"><MoreVertical size={22} /></summary>
                    <div className="absolute right-0 z-20 mt-2 w-56 rounded border border-slate-200 bg-white p-2 text-left shadow-lg">
                      <Link href={"/evaluations/" + evaluation.id} className="flex min-h-11 items-center gap-2 rounded px-3 py-2 font-bold text-ink hover:bg-slate-50"><Eye size={18} />詳細を見る</Link>
                      <Link href={"/evaluations/" + evaluation.id + "/edit"} className="flex min-h-11 items-center gap-2 rounded px-3 py-2 font-bold text-ink hover:bg-slate-50"><Edit3 size={18} />編集</Link>
                      <button type="button" onClick={() => duplicateEvaluation(evaluation)} disabled={duplicatingId === evaluation.id} className="flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left font-bold text-ink hover:bg-slate-50 disabled:opacity-50"><Copy size={18} />{duplicatingId === evaluation.id ? "複製中" : "複製"}</button>
                      <button type="button" onClick={() => downloadEvaluationCsv(evaluation)} className="flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left font-bold text-ink hover:bg-slate-50"><Download size={18} />CSV出力</button>
                      <Link href={"/evaluations/" + evaluation.id + "/print"} target="_blank" className="flex min-h-11 items-center gap-2 rounded px-3 py-2 font-bold text-ink hover:bg-slate-50"><FileText size={18} />PDF出力</Link>
                      <button type="button" onClick={() => singleDelete(evaluation)} disabled={deleting} className="flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={18} />評価を削除</button>
                    </div>
                  </details>
                </td>
              </tr>
            )) : <tr><td colSpan={8} className="py-8 text-center text-slate-500">表示できる評価はありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

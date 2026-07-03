"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteEvaluationButton({ evaluationId }: { evaluationId: number }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const ok = window.confirm("この評価を削除しますか？この操作は元に戻せません。");
    if (!ok) return;
    setDeleting(true);
    const response = await fetch("/api/evaluations/" + evaluationId, { method: "DELETE" });
    if (!response.ok) {
      alert("削除できませんでした。");
      setDeleting(false);
      return;
    }
    router.push("/?deleted=1");
    router.refresh();
  }

  return <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded border border-red-200 px-4 py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"><Trash2 size={18} />{deleting ? "削除中" : "削除"}</button>;
}

"use client";

import { useState } from "react";
import { Save } from "lucide-react";

type Props = {
  cycleId: number | null;
  cycleName: string;
  results: Record<string, unknown>;
  savedAt?: string | null;
};

export function SaveEvaluationResultsButton({ cycleId, cycleName, results, savedAt }: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(savedAt ? "保存済み: " + new Date(savedAt).toLocaleString("ja-JP") : "");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/evaluation-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluation_cycle_id: cycleId, name: cycleName, results }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "保存できませんでした");
      setMessage("評価結果を保存しました: " + new Date(data.snapshot.updated_at).toLocaleString("ja-JP"));
    } catch (error) {
      console.error("save evaluation results failed", error);
      setMessage("評価結果を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded border border-clinic px-5 py-3 font-bold text-clinic disabled:opacity-50">
        <Save size={18} />{saving ? "保存中..." : "評価結果を保存"}
      </button>
      {message ? <span className="rounded bg-mint px-3 py-2 text-sm font-bold text-clinic">{message}</span> : null}
    </div>
  );
}

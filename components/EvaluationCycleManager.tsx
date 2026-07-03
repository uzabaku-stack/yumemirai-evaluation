"use client";

import { Copy, Plus, Save } from "lucide-react";
import { useState } from "react";
import type { EvaluationCycle, EvaluationCycleStatus } from "@/lib/types";

const statuses: Array<{ value: EvaluationCycleStatus; label: string }> = [
  { value: "draft", label: "下書き" },
  { value: "active", label: "実施中" },
  { value: "closed", label: "終了" },
];

function today() { return new Date().toISOString().slice(0, 10); }

export function EvaluationCycleManager({ initialCycles }: { initialCycles: EvaluationCycle[] }) {
  const [cycles, setCycles] = useState(initialCycles);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", startDate: today().slice(0, 7) + "-01", endDate: today(), status: "draft" as EvaluationCycleStatus });

  async function reload() {
    const response = await fetch("/api/evaluation-cycles", { cache: "no-store" });
    const data = await response.json();
    setCycles(data.cycles ?? []);
  }

  async function createCycle() {
    const response = await fetch("/api/evaluation-cycles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!response.ok) { setMessage("保存できませんでした。"); return; }
    setForm({ name: "", startDate: today().slice(0, 7) + "-01", endDate: today(), status: "draft" });
    setMessage("評価回を作成しました。");
    await reload();
  }

  async function updateCycle(cycle: EvaluationCycle) {
    const response = await fetch("/api/evaluation-cycles/" + cycle.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cycle) });
    setMessage(response.ok ? "評価回を保存しました。" : "保存できませんでした。");
    await reload();
  }

  async function copyCycle(cycle: EvaluationCycle) {
    const name = window.prompt("新しい評価回名を入力してください", cycle.name.replace("夏", "冬"));
    if (!name) return;
    const response = await fetch("/api/evaluation-cycles/" + cycle.id + "/copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, startDate: form.startDate, endDate: form.endDate, status: "draft" }) });
    setMessage(response.ok ? "評価回をコピーしました。" : "コピーできませんでした。");
    await reload();
  }

  function setCycleValue(id: number, key: keyof EvaluationCycle, value: string) {
    setCycles((current) => current.map((cycle) => cycle.id === id ? { ...cycle, [key]: value } : cycle));
  }

  return <div className="space-y-5">
    {message ? <div className="rounded border border-teal-200 bg-mint px-5 py-4 font-bold text-clinic shadow-soft">{message}</div> : null}
    <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-bold">評価回を追加</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
        <input className="min-h-12 rounded border border-slate-300 px-4" placeholder="例：2026年 夏評価" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input className="min-h-12 rounded border border-slate-300 px-4" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
        <input className="min-h-12 rounded border border-slate-300 px-4" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
        <select className="min-h-12 rounded border border-slate-300 px-4" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EvaluationCycleStatus })}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
        <button type="button" onClick={createCycle} className="inline-flex min-h-12 items-center justify-center gap-2 rounded bg-clinic px-5 font-bold text-white"><Plus size={20} />追加</button>
      </div>
    </section>
    <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-bold">評価回一覧</h2>
      <div className="mt-4 space-y-3">
        {cycles.map((cycle) => <div key={cycle.id} className="rounded border border-slate-200 p-4">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto_auto]">
            <input className="min-h-12 rounded border border-slate-300 px-4 font-bold" value={cycle.name} onChange={(event) => setCycleValue(cycle.id, "name", event.target.value)} />
            <input className="min-h-12 rounded border border-slate-300 px-4" type="date" value={cycle.startDate} onChange={(event) => setCycleValue(cycle.id, "startDate", event.target.value)} />
            <input className="min-h-12 rounded border border-slate-300 px-4" type="date" value={cycle.endDate} onChange={(event) => setCycleValue(cycle.id, "endDate", event.target.value)} />
            <select className="min-h-12 rounded border border-slate-300 px-4" value={cycle.status} onChange={(event) => setCycleValue(cycle.id, "status", event.target.value)}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
            <button type="button" onClick={() => updateCycle(cycle)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded bg-clinic px-5 font-bold text-white"><Save size={18} />保存</button>
            <button type="button" onClick={() => copyCycle(cycle)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded border border-clinic px-5 font-bold text-clinic"><Copy size={18} />コピー</button>
          </div>
          {cycle.status === "active" ? <p className="mt-2 text-sm font-bold text-clinic">現在の入力対象です。</p> : null}
        </div>)}
      </div>
    </section>
  </div>;
}

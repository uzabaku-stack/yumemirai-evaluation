"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Save } from "lucide-react";

type BonusStaff = {
  id: number;
  name: string;
  role: string;
  averageScore: number | null;
  standardizedScore: number | null;
  bonusScore: number | null;
};

type CalculationMode = "base" | "pool";

type RowInput = {
  baseSalary: string;
  baseBonus: string;
  absenceRate: string;
  memo: string;
};

type Props = {
  staff: BonusStaff[];
};

const storageKey = "yumemirai_bonus_calculator_v2";
const absenceRates = [0, 5, 10, 20];

function yen(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(Math.round(value));
}

function numberValue(value: string) {
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function evaluationCoefficient(average: number | null) {
  if (average === null) return 0.8;
  if (average >= 4.5) return 1.2;
  if (average >= 4.0) return 1.1;
  if (average >= 3.5) return 1.0;
  if (average >= 3.0) return 0.9;
  return 0.8;
}

function escapeCsv(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function initialRows(staff: BonusStaff[]) {
  return Object.fromEntries(staff.map((person) => [String(person.id), { baseSalary: "", baseBonus: "", absenceRate: "0", memo: "" }])) as Record<string, RowInput>;
}

function distributeTotal(total: number, weights: number[]) {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (!total || totalWeight <= 0 || !weights.length) return weights.map(() => 0);
  const raw = weights.map((weight) => (total * weight) / totalWeight);
  const rounded = raw.map((value) => Math.floor(value));
  let remainder = Math.round(total) - rounded.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);
  for (const item of order) {
    if (remainder <= 0) break;
    rounded[item.index] += 1;
    remainder -= 1;
  }
  return rounded;
}

export function BonusCalculator({ staff }: Props) {
  const [rows, setRows] = useState<Record<string, RowInput>>(() => initialRows(staff));
  const [mode, setMode] = useState<CalculationMode>("base");
  const [totalPool, setTotalPool] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { rows?: Record<string, RowInput>; mode?: CalculationMode; totalPool?: string };
      if (parsed.rows) setRows((current) => ({ ...current, ...parsed.rows }));
      if (parsed.mode === "base" || parsed.mode === "pool") setMode(parsed.mode);
      if (parsed.totalPool) setTotalPool(parsed.totalPool);
    } catch (error) {
      console.error("bonus settings load failed", error);
    }
  }, []);

  useEffect(() => {
    setRows((current) => ({ ...initialRows(staff), ...current }));
  }, [staff]);

  const calculated = useMemo(() => {
    const baseRows = staff.map((person) => {
      const input = rows[String(person.id)] ?? { baseSalary: "", baseBonus: "", absenceRate: "0", memo: "" };
      const baseBonus = numberValue(input.baseBonus);
      const absenceMinusRate = numberValue(input.absenceRate);
      const coefficient = evaluationCoefficient(person.bonusScore);
      const absenceMultiplier = Math.max(0, 1 - absenceMinusRate / 100);
      const weight = coefficient * absenceMultiplier;
      const baseModeBonus = baseBonus * weight;
      return { person, input, baseBonus, coefficient, absenceMinusRate, absenceMultiplier, weight, baseModeBonus, finalBonus: baseModeBonus };
    });
    if (mode === "pool") {
      const distributed = distributeTotal(numberValue(totalPool), baseRows.map((row) => row.weight));
      return baseRows.map((row, index) => ({ ...row, finalBonus: distributed[index] ?? 0 }));
    }
    return baseRows;
  }, [staff, rows, mode, totalPool]);

  const totalBonus = calculated.reduce((sum, row) => sum + row.finalBonus, 0);

  function update(id: number, patch: Partial<RowInput>) {
    setRows((current) => ({ ...current, [String(id)]: { ...(current[String(id)] ?? { baseSalary: "", baseBonus: "", absenceRate: "0", memo: "" }), ...patch } }));
    setSavedMessage("");
  }

  function saveLocal() {
    window.localStorage.setItem(storageKey, JSON.stringify({ rows, mode, totalPool }));
    setSavedMessage("この端末に保存しました。");
  }

  function exportCsv() {
    const header = ["計算モード", "スタッフ名", "職種", "基本給", "スタッフ評価平均", "評価標準化", "賞与反映評価", "評価係数", "休みマイナス率", "休み補正率", "基準賞与額", "最終賞与額", "メモ"];
    const body = calculated.map((row) => [
      mode === "base" ? "基準賞与から計算" : "総賞与額から自動配分",
      row.person.name,
      row.person.role,
      numberValue(row.input.baseSalary),
      row.person.averageScore === null ? "" : row.person.averageScore.toFixed(2),
      row.person.standardizedScore === null ? "" : row.person.standardizedScore.toFixed(2),
      row.person.bonusScore === null ? "" : row.person.bonusScore.toFixed(2),
      row.coefficient,
      row.absenceMinusRate + "%",
      row.absenceMultiplier,
      row.baseBonus,
      Math.round(row.finalBonus),
      row.input.memo,
    ]);
    const csv = [header, ...body, ["合計", "", "", "", "", "", "", "", "", "", "", Math.round(totalBonus), ""]].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bonus-calculation.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div className="space-y-5"><section className="grid gap-4 md:grid-cols-3"><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="text-sm font-bold text-slate-500">計算モード</div><div className="mt-3 grid gap-2"><button type="button" onClick={() => setMode("base")} className={(mode === "base" ? "bg-clinic text-white" : "border border-clinic bg-white text-clinic") + " min-h-12 rounded px-4 py-3 font-bold"}>基準賞与から計算</button><button type="button" onClick={() => setMode("pool")} className={(mode === "pool" ? "bg-clinic text-white" : "border border-clinic bg-white text-clinic") + " min-h-12 rounded px-4 py-3 font-bold"}>総賞与額から自動配分</button></div></div><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="text-sm font-bold text-slate-500">総賞与額</div><input inputMode="numeric" value={totalPool} onChange={(event) => setTotalPool(event.target.value)} disabled={mode !== "pool"} className="mt-3 h-14 w-full rounded border border-slate-300 px-4 text-right text-xl font-bold disabled:bg-slate-100 disabled:text-slate-400" placeholder="例 4200000" /><p className="mt-2 text-xs text-slate-500">自動配分モードでは、最終賞与額の合計がこの金額と一致します。</p></div><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="text-sm font-bold text-slate-500">合計賞与額</div><div className="mt-2 text-3xl font-bold text-clinic">{yen(totalBonus)}</div><p className="mt-2 text-xs text-slate-500">{mode === "base" ? "基準賞与から計算した合計です。" : "総賞与額に一致するよう自動配分しています。"}</p></div></section><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">賞与計算表</h2><p className="mt-1 text-sm text-slate-600">保存処理や評価データは変更しません。入力内容はこの端末に保存できます。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={saveLocal} className="flex min-h-12 items-center gap-2 rounded border border-clinic px-5 py-3 font-bold text-clinic"><Save size={18} />この端末に保存</button><button type="button" onClick={exportCsv} className="flex min-h-12 items-center gap-2 rounded bg-clinic px-5 py-3 font-bold text-white"><Download size={18} />CSV出力</button></div>{savedMessage ? <div className="w-full rounded bg-mint px-4 py-3 font-bold text-clinic">{savedMessage}</div> : null}</div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1380px] text-left"><thead><tr className="border-b text-sm text-slate-500"><th className="py-3">スタッフ名</th><th>職種</th><th>基本給</th><th>スタッフ評価平均</th><th>評価標準化</th><th>賞与反映評価</th><th>評価係数</th><th>休み補正率</th><th>基準賞与額</th><th>最終賞与額</th><th>メモ</th></tr></thead><tbody>{calculated.map((row) => <tr key={row.person.id} className="border-b last:border-0 align-top"><td className="py-4 pr-3 font-bold text-ink">{row.person.name}</td><td className="py-4 pr-3"><span className="rounded bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{row.person.role}</span></td><td className="py-3 pr-3"><input inputMode="numeric" value={row.input.baseSalary} onChange={(event) => update(row.person.id, { baseSalary: event.target.value })} className="h-12 w-36 rounded border border-slate-300 px-3 text-right" placeholder="例 250000" /></td><td className="py-4 text-lg font-bold text-ink">{row.person.averageScore === null ? "-" : row.person.averageScore.toFixed(2)}</td><td className="py-4 text-lg font-bold text-clinic">{row.person.standardizedScore === null ? "-" : row.person.standardizedScore.toFixed(2)}</td><td className="py-4 text-lg font-bold text-clinic">{row.person.bonusScore === null ? "-" : row.person.bonusScore.toFixed(2)}</td><td className="py-4 font-bold">{row.coefficient.toFixed(1)}</td><td className="py-3 pr-3"><select value={row.input.absenceRate} onChange={(event) => update(row.person.id, { absenceRate: event.target.value })} className="h-12 w-32 rounded border border-slate-300 px-3">{absenceRates.map((rate) => <option key={rate} value={String(rate)}>{rate}% → {(1 - rate / 100).toFixed(2)}</option>)}</select></td><td className="py-3 pr-3"><input inputMode="numeric" value={row.input.baseBonus} onChange={(event) => update(row.person.id, { baseBonus: event.target.value })} disabled={mode !== "base"} className="h-12 w-36 rounded border border-slate-300 px-3 text-right disabled:bg-slate-100 disabled:text-slate-400" placeholder="例 300000" /></td><td className="py-4 pr-3 text-xl font-bold text-clinic">{yen(row.finalBonus)}</td><td className="py-3"><textarea value={row.input.memo} onChange={(event) => update(row.person.id, { memo: event.target.value })} className="min-h-12 w-64 rounded border border-slate-300 p-3" placeholder="メモ" /></td></tr>)}</tbody><tfoot><tr className="bg-mint/60"><td colSpan={9} className="px-3 py-4 text-right text-lg font-bold">合計賞与額</td><td className="px-3 py-4 text-xl font-bold text-clinic">{yen(totalBonus)}</td><td /></tr></tfoot></table></div></section><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">評価標準化の考え方</h2><p className="mt-2 text-sm leading-7 text-slate-600">スタッフ評価平均とは別に、評価者ごとの甘め・厳しめの傾向を控えめに補正した「評価標準化」を表示します。賞与計算では「賞与反映評価」を使用します。補正ロジックは <code className="rounded bg-slate-100 px-2 py-1">lib/evaluationStandardization.ts</code> に独立しています。</p></section><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">評価係数</h2><div className="mt-4 grid gap-3 md:grid-cols-5">{["4.5以上: 1.2", "4.0以上: 1.1", "3.5以上: 1.0", "3.0以上: 0.9", "3.0未満: 0.8"].map((item) => <div key={item} className="rounded bg-slate-50 p-4 text-center font-bold text-ink">{item}</div>)}</div></section></div>;
}

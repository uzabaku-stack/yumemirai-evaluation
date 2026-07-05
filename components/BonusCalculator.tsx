"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Save } from "lucide-react";

type BonusStaff = {
  id: number;
  name: string;
  averageScore: number | null;
};

type RowInput = {
  baseSalary: string;
  baseBonus: string;
  absenceRate: string;
  memo: string;
};

type Props = {
  staff: BonusStaff[];
};

const storageKey = "yumemirai_bonus_calculator_v1";
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

export function BonusCalculator({ staff }: Props) {
  const [rows, setRows] = useState<Record<string, RowInput>>(() => initialRows(staff));
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setRows((current) => ({ ...current, ...JSON.parse(stored) }));
    } catch (error) {
      console.error("bonus settings load failed", error);
    }
  }, []);

  useEffect(() => {
    setRows((current) => ({ ...initialRows(staff), ...current }));
  }, [staff]);

  const calculated = useMemo(() => staff.map((person) => {
    const input = rows[String(person.id)] ?? { baseSalary: "", baseBonus: "", absenceRate: "0", memo: "" };
    const baseBonus = numberValue(input.baseBonus);
    const absenceMinusRate = numberValue(input.absenceRate);
    const coefficient = evaluationCoefficient(person.averageScore);
    const absenceMultiplier = Math.max(0, 1 - absenceMinusRate / 100);
    const adjustedBonus = baseBonus * coefficient * absenceMultiplier;
    return { person, input, baseBonus, coefficient, absenceMinusRate, absenceMultiplier, adjustedBonus };
  }), [staff, rows]);

  const totalBonus = calculated.reduce((sum, row) => sum + row.adjustedBonus, 0);

  function update(id: number, patch: Partial<RowInput>) {
    setRows((current) => ({ ...current, [String(id)]: { ...(current[String(id)] ?? { baseSalary: "", baseBonus: "", absenceRate: "0", memo: "" }), ...patch } }));
    setSavedMessage("");
  }

  function saveLocal() {
    window.localStorage.setItem(storageKey, JSON.stringify(rows));
    setSavedMessage("この端末に保存しました。");
  }

  function exportCsv() {
    const header = ["スタッフ名", "評価平均点", "評価係数", "基本給", "基準賞与額", "休みマイナス率", "休み調整率", "調整後賞与額", "メモ"];
    const body = calculated.map((row) => [
      row.person.name,
      row.person.averageScore === null ? "" : row.person.averageScore.toFixed(2),
      row.coefficient,
      numberValue(row.input.baseSalary),
      row.baseBonus,
      row.absenceMinusRate + "%",
      row.absenceMultiplier,
      Math.round(row.adjustedBonus),
      row.input.memo,
    ]);
    const csv = [header, ...body].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bonus-calculation.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div className="space-y-5"><section className="grid gap-4 md:grid-cols-3"><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="text-sm font-bold text-slate-500">対象スタッフ</div><div className="mt-2 text-3xl font-bold text-ink">{staff.length}名</div></div><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="text-sm font-bold text-slate-500">合計賞与額</div><div className="mt-2 text-3xl font-bold text-clinic">{yen(totalBonus)}</div></div><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="text-sm font-bold text-slate-500">計算式</div><div className="mt-2 text-base font-bold text-ink">基準賞与額 × 評価係数 × 休み調整率</div></div></section><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">賞与計算表</h2><p className="mt-1 text-sm text-slate-600">基本給・基準賞与額・休みマイナス率・メモはこの画面で編集できます。保存処理や評価データは変更しません。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={saveLocal} className="flex min-h-12 items-center gap-2 rounded border border-clinic px-5 py-3 font-bold text-clinic"><Save size={18} />この端末に保存</button><button type="button" onClick={exportCsv} className="flex min-h-12 items-center gap-2 rounded bg-clinic px-5 py-3 font-bold text-white"><Download size={18} />CSV出力</button></div>{savedMessage ? <div className="w-full rounded bg-mint px-4 py-3 font-bold text-clinic">{savedMessage}</div> : null}</div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1120px] text-left"><thead><tr className="border-b text-sm text-slate-500"><th className="py-3">スタッフ名</th><th>評価平均点</th><th>評価係数</th><th>基本給</th><th>基準賞与額</th><th>欠勤・休み調整率</th><th>調整後賞与額</th><th>メモ</th></tr></thead><tbody>{calculated.map((row) => <tr key={row.person.id} className="border-b last:border-0 align-top"><td className="py-4 pr-3 font-bold text-ink">{row.person.name}</td><td className="py-4 text-lg font-bold text-clinic">{row.person.averageScore === null ? "-" : row.person.averageScore.toFixed(2)}</td><td className="py-4 font-bold">{row.coefficient.toFixed(1)}</td><td className="py-3 pr-3"><input inputMode="numeric" value={row.input.baseSalary} onChange={(event) => update(row.person.id, { baseSalary: event.target.value })} className="h-12 w-36 rounded border border-slate-300 px-3 text-right" placeholder="例 250000" /></td><td className="py-3 pr-3"><input inputMode="numeric" value={row.input.baseBonus} onChange={(event) => update(row.person.id, { baseBonus: event.target.value })} className="h-12 w-36 rounded border border-slate-300 px-3 text-right" placeholder="例 300000" /></td><td className="py-3 pr-3"><select value={row.input.absenceRate} onChange={(event) => update(row.person.id, { absenceRate: event.target.value })} className="h-12 w-32 rounded border border-slate-300 px-3">{absenceRates.map((rate) => <option key={rate} value={String(rate)}>{rate}% → {(1 - rate / 100).toFixed(2)}</option>)}</select></td><td className="py-4 pr-3 text-xl font-bold text-clinic">{yen(row.adjustedBonus)}</td><td className="py-3"><textarea value={row.input.memo} onChange={(event) => update(row.person.id, { memo: event.target.value })} className="min-h-12 w-64 rounded border border-slate-300 p-3" placeholder="メモ" /></td></tr>)}</tbody><tfoot><tr className="bg-mint/60"><td colSpan={6} className="px-3 py-4 text-right text-lg font-bold">合計賞与額</td><td className="px-3 py-4 text-xl font-bold text-clinic">{yen(totalBonus)}</td><td /></tr></tfoot></table></div></section><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">評価係数</h2><div className="mt-4 grid gap-3 md:grid-cols-5">{["4.5以上: 1.2", "4.0以上: 1.1", "3.5以上: 1.0", "3.0以上: 0.9", "3.0未満: 0.8"].map((item) => <div key={item} className="rounded bg-slate-50 p-4 text-center font-bold text-ink">{item}</div>)}</div></section></div>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Save } from "lucide-react";
import { calculateBonusAdjustment, ratePercentToMultiplier } from "@/lib/bonusAdjustment";

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
  employmentAdjustmentRate: string;
  workHoursAdjustmentRate: string;
  attendanceAdjustmentRate: string;
  individualAdjustmentAmount: string;
  memo: string;
};

type LegacyRowInput = Partial<RowInput> & {
  absenceRate?: string;
  overallAdjustmentRate?: string;
};

type Props = {
  staff: BonusStaff[];
};

const storageKey = "yumemirai_bonus_calculator_v4";
const legacyStorageKeys = ["yumemirai_bonus_calculator_v3", "yumemirai_bonus_calculator_v2"];
const percentageOptions = [50, 60, 70, 80, 90, 100, 110, 120];

function yen(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(Math.round(value));
}

function numberValue(value: string) {
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function percent(value: number) {
  return Math.round(value * 100) + "%";
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

function defaultRowInput(): RowInput {
  return {
    baseSalary: "",
    baseBonus: "",
    employmentAdjustmentRate: "100",
    workHoursAdjustmentRate: "100",
    attendanceAdjustmentRate: "100",
    individualAdjustmentAmount: "0",
    memo: "",
  };
}

function legacyMinusRateToPercent(input?: LegacyRowInput) {
  const oldRate = input?.overallAdjustmentRate ?? input?.absenceRate;
  if (oldRate === undefined || oldRate === null || oldRate === "") return undefined;
  return String(Math.max(0, 100 - numberValue(oldRate)));
}

function normalizeRowInput(input?: LegacyRowInput): RowInput {
  const fallback = defaultRowInput();
  const legacyAttendanceRate = legacyMinusRateToPercent(input);
  return {
    baseSalary: input?.baseSalary ?? fallback.baseSalary,
    baseBonus: input?.baseBonus ?? fallback.baseBonus,
    employmentAdjustmentRate: input?.employmentAdjustmentRate ?? fallback.employmentAdjustmentRate,
    workHoursAdjustmentRate: input?.workHoursAdjustmentRate ?? fallback.workHoursAdjustmentRate,
    attendanceAdjustmentRate: input?.attendanceAdjustmentRate ?? legacyAttendanceRate ?? fallback.attendanceAdjustmentRate,
    individualAdjustmentAmount: input?.individualAdjustmentAmount ?? fallback.individualAdjustmentAmount,
    memo: input?.memo ?? fallback.memo,
  };
}

function initialRows(staff: BonusStaff[]) {
  return Object.fromEntries(staff.map((person) => [String(person.id), defaultRowInput()])) as Record<string, RowInput>;
}

function normalizeRows(rows?: Record<string, LegacyRowInput>) {
  if (!rows) return {};
  return Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, normalizeRowInput(row)])) as Record<string, RowInput>;
}

function distributeTotal(total: number, weights: number[], fixedAdjustments: number[]) {
  if (!total || !weights.length) return weights.map(() => 0);
  const fixedTotal = fixedAdjustments.reduce((sum, value) => sum + value, 0);
  const distributableTotal = Math.max(0, Math.round(total - fixedTotal));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) return weights.map((_, index) => Math.max(0, fixedAdjustments[index] ?? 0));
  const raw = weights.map((weight, index) => (distributableTotal * weight) / totalWeight + (fixedAdjustments[index] ?? 0));
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

function RateSelect({ id, value, onChange, label }: { id: string; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded border border-slate-300 px-3">
        {percentageOptions.map((rate) => <option key={rate} value={String(rate)}>{rate}%</option>)}
      </select>
    </label>
  );
}

export function BonusCalculator({ staff }: Props) {
  const [rows, setRows] = useState<Record<string, RowInput>>(() => initialRows(staff));
  const [mode, setMode] = useState<CalculationMode>("base");
  const [totalPool, setTotalPool] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey) ?? legacyStorageKeys.map((key) => window.localStorage.getItem(key)).find(Boolean);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { rows?: Record<string, LegacyRowInput>; mode?: CalculationMode; totalPool?: string };
      if (parsed.rows) setRows((current) => ({ ...current, ...normalizeRows(parsed.rows) }));
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
      const input = normalizeRowInput(rows[String(person.id)]);
      const baseBonus = numberValue(input.baseBonus);
      const coefficient = evaluationCoefficient(person.bonusScore);
      const adjustment = calculateBonusAdjustment({
        baseBonus,
        evaluationMultiplier: coefficient,
        employmentMultiplier: ratePercentToMultiplier(numberValue(input.employmentAdjustmentRate)),
        workHoursMultiplier: ratePercentToMultiplier(numberValue(input.workHoursAdjustmentRate)),
        attendanceMultiplier: ratePercentToMultiplier(numberValue(input.attendanceAdjustmentRate)),
        individualAdjustmentAmount: numberValue(input.individualAdjustmentAmount),
      });
      const weight = coefficient * adjustment.overallMultiplier;
      return { person, input, baseBonus, coefficient, adjustment, weight, finalBonus: adjustment.finalBonus };
    });
    if (mode === "pool") {
      const distributed = distributeTotal(numberValue(totalPool), baseRows.map((row) => row.weight), baseRows.map((row) => row.adjustment.individualAdjustmentAmount));
      return baseRows.map((row, index) => ({ ...row, finalBonus: distributed[index] ?? 0 }));
    }
    return baseRows;
  }, [staff, rows, mode, totalPool]);

  const totalBonus = calculated.reduce((sum, row) => sum + row.finalBonus, 0);

  function update(id: number, patch: Partial<RowInput>) {
    setRows((current) => ({ ...current, [String(id)]: { ...normalizeRowInput(current[String(id)]), ...patch } }));
    setSavedMessage("");
  }

  function saveLocal() {
    window.localStorage.setItem(storageKey, JSON.stringify({ rows, mode, totalPool }));
    setSavedMessage("この端末に保存しました。");
  }

  function exportCsv() {
    const header = ["計算モード", "スタッフ名", "職種", "基本給", "スタッフ評価平均", "評価標準化", "賞与反映評価", "評価標準化補正", "雇用形態補正", "勤務時間補正", "出勤日数補正", "総合補正", "個別調整", "基準賞与額", "評価反映後", "最終賞与額", "メモ"];
    const body = calculated.map((row) => [
      mode === "base" ? "基準賞与から計算" : "総賞与額から自動配分",
      row.person.name,
      row.person.role,
      numberValue(row.input.baseSalary),
      row.person.averageScore === null ? "" : row.person.averageScore.toFixed(2),
      row.person.standardizedScore === null ? "" : row.person.standardizedScore.toFixed(2),
      row.person.bonusScore === null ? "" : row.person.bonusScore.toFixed(2),
      percent(row.adjustment.evaluationMultiplier),
      percent(row.adjustment.employmentMultiplier),
      percent(row.adjustment.workHoursMultiplier),
      percent(row.adjustment.attendanceMultiplier),
      percent(row.adjustment.overallMultiplier),
      row.adjustment.individualAdjustmentAmount,
      row.baseBonus,
      Math.round(row.adjustment.evaluationAdjustedBonus),
      Math.round(row.finalBonus),
      row.input.memo,
    ]);
    const csv = [header, ...body, ["合計", "", "", "", "", "", "", "", "", "", "", "", "", "", "", Math.round(totalBonus), ""]].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bonus-calculation.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <div className="text-sm font-bold text-slate-500">計算モード</div>
          <div className="mt-3 grid gap-2">
            <button type="button" onClick={() => setMode("base")} className={(mode === "base" ? "bg-clinic text-white" : "border border-clinic bg-white text-clinic") + " min-h-12 rounded px-4 py-3 font-bold"}>基準賞与から計算</button>
            <button type="button" onClick={() => setMode("pool")} className={(mode === "pool" ? "bg-clinic text-white" : "border border-clinic bg-white text-clinic") + " min-h-12 rounded px-4 py-3 font-bold"}>総賞与額から自動配分</button>
          </div>
        </div>
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <div className="text-sm font-bold text-slate-500">総賞与額</div>
          <input inputMode="numeric" value={totalPool} onChange={(event) => setTotalPool(event.target.value)} disabled={mode !== "pool"} className="mt-3 h-14 w-full rounded border border-slate-300 px-4 text-right text-xl font-bold disabled:bg-slate-100 disabled:text-slate-400" placeholder="例 4200000" />
          <p className="mt-2 text-xs text-slate-500">自動配分モードでは、最終賞与額の合計がこの金額と一致します。</p>
        </div>
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <div className="text-sm font-bold text-slate-500">合計賞与額</div>
          <div className="mt-2 text-3xl font-bold text-clinic">{yen(totalBonus)}</div>
          <p className="mt-2 text-xs text-slate-500">{mode === "base" ? "基準賞与から計算した合計です。" : "総賞与額に一致するよう自動配分しています。"}</p>
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">賞与計算表</h2>
            <p className="mt-1 text-sm text-slate-600">総合補正を雇用形態・勤務時間・出勤日数・個別調整に分けて管理します。</p>
            <p className="mt-1 text-sm text-slate-600">パート勤務や時短勤務など、勤務実態に応じた反映率をスタッフごとに調整できます。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveLocal} className="flex min-h-12 items-center gap-2 rounded border border-clinic px-5 py-3 font-bold text-clinic"><Save size={18} />この端末に保存</button>
            <button type="button" onClick={exportCsv} className="flex min-h-12 items-center gap-2 rounded bg-clinic px-5 py-3 font-bold text-white"><Download size={18} />CSV出力</button>
          </div>
          {savedMessage ? <div className="w-full rounded bg-mint px-4 py-3 font-bold text-clinic">{savedMessage}</div> : null}
        </div>

        <div className="mt-5 space-y-4">
          {calculated.map((row) => (
            <article key={row.person.id} className="rounded border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-ink">{row.person.name}</h3>
                    <span className="rounded bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{row.person.role}</span>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                    <span>評価平均: <b>{row.person.averageScore === null ? "-" : row.person.averageScore.toFixed(2)}</b></span>
                    <span>評価標準化: <b>{row.person.standardizedScore === null ? "-" : row.person.standardizedScore.toFixed(2)}</b></span>
                    <span>賞与反映評価: <b>{row.person.bonusScore === null ? "-" : row.person.bonusScore.toFixed(2)}</b></span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-500">最終賞与</div>
                  <div className="text-3xl font-bold text-clinic">{yen(row.finalBonus)}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[160px_160px_1fr_180px]">
                <label className="space-y-1"><span className="text-sm font-bold text-slate-600">基本給</span><input inputMode="numeric" value={row.input.baseSalary} onChange={(event) => update(row.person.id, { baseSalary: event.target.value })} className="h-12 w-full rounded border border-slate-300 px-3 text-right" placeholder="例 250000" /></label>
                <label className="space-y-1"><span className="text-sm font-bold text-slate-600">基準賞与額</span><input inputMode="numeric" value={row.input.baseBonus} onChange={(event) => update(row.person.id, { baseBonus: event.target.value })} disabled={mode !== "base"} className="h-12 w-full rounded border border-slate-300 px-3 text-right disabled:bg-slate-100 disabled:text-slate-400" placeholder="例 300000" /></label>
                <div className="grid gap-2 rounded bg-mint/60 p-3 text-sm md:grid-cols-4">
                  <div><div className="text-slate-600">基本賞与</div><b>{yen(row.baseBonus)}</b></div>
                  <div><div className="text-slate-600">評価反映後</div><b>{yen(row.adjustment.evaluationAdjustedBonus)}</b></div>
                  <div><div className="text-slate-600">総合補正</div><b>{percent(row.adjustment.overallMultiplier)}</b></div>
                  <div><div className="text-slate-600">個別調整後</div><b>{yen(row.adjustment.finalBonus)}</b></div>
                </div>
                <label className="space-y-1"><span className="text-sm font-bold text-slate-600">メモ</span><input value={row.input.memo} onChange={(event) => update(row.person.id, { memo: event.target.value })} className="h-12 w-full rounded border border-slate-300 px-3" placeholder="メモ" /></label>
              </div>

              <details className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-base font-bold text-ink">総合補正の詳細を開く</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-5">
                  <RateSelect id={"employment-" + row.person.id} label="雇用形態補正" value={row.input.employmentAdjustmentRate} onChange={(value) => update(row.person.id, { employmentAdjustmentRate: value })} />
                  <RateSelect id={"work-hours-" + row.person.id} label="勤務時間補正" value={row.input.workHoursAdjustmentRate} onChange={(value) => update(row.person.id, { workHoursAdjustmentRate: value })} />
                  <RateSelect id={"attendance-" + row.person.id} label="出勤日数補正" value={row.input.attendanceAdjustmentRate} onChange={(value) => update(row.person.id, { attendanceAdjustmentRate: value })} />
                  <label className="space-y-1"><span className="text-sm font-bold text-slate-600">個別調整</span><input inputMode="numeric" value={row.input.individualAdjustmentAmount} onChange={(event) => update(row.person.id, { individualAdjustmentAmount: event.target.value })} className="h-12 w-full rounded border border-slate-300 px-3 text-right" placeholder="例 -10000" /></label>
                  <div className="rounded bg-white p-3 text-sm leading-7">
                    <div>評価標準化補正: <b>{percent(row.adjustment.evaluationMultiplier)}</b></div>
                    <div>雇用形態補正: <b>{percent(row.adjustment.employmentMultiplier)}</b></div>
                    <div>勤務時間補正: <b>{percent(row.adjustment.workHoursMultiplier)}</b></div>
                    <div>出勤日数補正: <b>{percent(row.adjustment.attendanceMultiplier)}</b></div>
                    <div>個別調整: <b>{yen(row.adjustment.individualAdjustmentAmount)}</b></div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">総合補正は、雇用形態補正 × 勤務時間補正 × 出勤日数補正で計算します。個別調整は最後に金額で加減します。</p>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">補正計算の考え方</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">評価標準化スコアから評価係数を決め、基準賞与に反映します。その後、雇用形態・勤務時間・出勤日数の総合補正を掛け合わせ、最後に個別調整額を加減します。計算ロジックは <code className="rounded bg-slate-100 px-2 py-1">lib/bonusAdjustment.ts</code> に独立しています。</p>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">評価標準化補正</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">{["4.5以上: 120%", "4.0以上: 110%", "3.5以上: 100%", "3.0以上: 90%", "3.0未満: 80%"].map((item) => <div key={item} className="rounded bg-slate-50 p-4 text-center font-bold text-ink">{item}</div>)}</div>
      </section>
    </div>
  );
}

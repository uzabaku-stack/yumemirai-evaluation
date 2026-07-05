"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RotateCcw, Save } from "lucide-react";
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
type BaseBonusMode = "auto" | "manual";

type RowInput = {
  baseSalary: string;
  baseBonus: string;
  baseBonusMode: BaseBonusMode;
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

const storageKey = "yumemirai_bonus_calculator_v5";
const legacyStorageKeys = ["yumemirai_bonus_calculator_v4", "yumemirai_bonus_calculator_v3", "yumemirai_bonus_calculator_v2"];
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
    baseBonusMode: "auto",
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
  const baseBonus = input?.baseBonus ?? fallback.baseBonus;
  const baseBonusMode = input?.baseBonusMode === "manual" || input?.baseBonusMode === "auto" ? input.baseBonusMode : (baseBonus ? "manual" : "auto");
  return {
    baseSalary: input?.baseSalary ?? fallback.baseSalary,
    baseBonus,
    baseBonusMode,
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

function distributeEvenly(total: number, count: number) {
  if (!total || count <= 0) return [] as number[];
  const base = Math.floor(total / count);
  let remainder = Math.round(total) - base * count;
  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return value;
  });
}

function distributePoolByWeight(total: number, weights: number[], fixedAdjustments: number[]) {
  if (!weights.length) return [] as number[];
  const roundedTotal = Math.round(total);
  if (!roundedTotal) return weights.map(() => 0);
  const fixedTotal = fixedAdjustments.reduce((sum, value) => sum + value, 0);
  const distributableTotal = Math.max(0, roundedTotal - fixedTotal);
  const totalWeight = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  const raw = weights.map((weight, index) => {
    const variablePart = totalWeight > 0 ? (distributableTotal * Math.max(0, weight)) / totalWeight : distributableTotal / weights.length;
    return variablePart + (fixedAdjustments[index] ?? 0);
  });
  const rounded = raw.map((value) => Math.round(value));
  let diff = roundedTotal - rounded.reduce((sum, value) => sum + value, 0);
  if (diff !== 0) {
    const order = raw
      .map((value, index) => ({ index, value, fraction: Math.abs(value - Math.round(value)) }))
      .sort((a, b) => b.value - a.value || b.fraction - a.fraction);
    let cursor = 0;
    while (diff !== 0 && order.length) {
      const target = order[cursor % order.length].index;
      if (diff > 0) {
        rounded[target] += 1;
        diff -= 1;
      } else if (rounded[target] > 0) {
        rounded[target] -= 1;
        diff += 1;
      } else if (order.every((item) => rounded[item.index] <= 0)) {
        rounded[target] += diff;
        diff = 0;
      }
      cursor += 1;
    }
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
    const totalPoolValue = numberValue(totalPool);
    const autoBaseBonuses = mode === "pool" ? distributeEvenly(totalPoolValue, staff.length) : staff.map(() => 0);
    const baseRows = staff.map((person, index) => {
      const input = normalizeRowInput(rows[String(person.id)]);
      const coefficient = evaluationCoefficient(person.bonusScore);
      const employmentMultiplier = ratePercentToMultiplier(numberValue(input.employmentAdjustmentRate));
      const workHoursMultiplier = ratePercentToMultiplier(numberValue(input.workHoursAdjustmentRate));
      const attendanceMultiplier = ratePercentToMultiplier(numberValue(input.attendanceAdjustmentRate));
      const individualAdjustmentAmount = numberValue(input.individualAdjustmentAmount);
      const suggestedBaseBonus = autoBaseBonuses[index] ?? 0;
      const usesAutoBaseBonus = mode === "pool" && input.baseBonusMode !== "manual";
      const baseBonus = usesAutoBaseBonus ? suggestedBaseBonus : numberValue(input.baseBonus);
      const adjustment = calculateBonusAdjustment({
        baseBonus,
        evaluationMultiplier: coefficient,
        employmentMultiplier,
        workHoursMultiplier,
        attendanceMultiplier,
        individualAdjustmentAmount,
      });
      const poolWeight = Math.max(0, baseBonus) * coefficient * adjustment.overallMultiplier;
      return { person, input, baseBonus, suggestedBaseBonus, usesAutoBaseBonus, coefficient, adjustment, poolWeight, finalBonus: adjustment.finalBonus };
    });

    if (mode !== "pool") return baseRows;

    const poolFinalBonuses = distributePoolByWeight(totalPoolValue, baseRows.map((row) => row.poolWeight), baseRows.map((row) => row.adjustment.individualAdjustmentAmount));
    return baseRows.map((row, index) => {
      const finalBonus = poolFinalBonuses[index] ?? 0;
      const evaluationAdjustedBonus = row.adjustment.evaluationMultiplier * row.baseBonus;
      const calculatedFinalBeforePool = row.adjustment.finalBonus;
      return { ...row, finalBonus, evaluationAdjustedBonus, calculatedFinalBeforePool };
    });
  }, [staff, rows, mode, totalPool]);

  const totalBonus = calculated.reduce((sum, row) => sum + row.finalBonus, 0);
  const poolDifference = mode === "pool" ? numberValue(totalPool) - totalBonus : 0;

  function update(id: number, patch: Partial<RowInput>) {
    setRows((current) => ({ ...current, [String(id)]: { ...normalizeRowInput(current[String(id)]), ...patch } }));
    setSavedMessage("");
  }

  function updateBaseBonus(id: number, value: string) {
    update(id, { baseBonus: value, baseBonusMode: "manual" });
  }

  function resetBaseBonusToAuto(id: number) {
    update(id, { baseBonus: "", baseBonusMode: "auto" });
  }

  function saveLocal() {
    window.localStorage.setItem(storageKey, JSON.stringify({ rows, mode, totalPool }));
    setSavedMessage("この端末に保存しました。");
  }

  function exportCsv() {
    const header = ["計算モード", "スタッフ名", "職種", "基本給", "スタッフ評価平均", "評価標準化", "賞与反映評価", "基準賞与の扱い", "均等配分基準賞与", "基準賞与額", "評価標準化補正", "雇用形態補正", "勤務時間補正", "出勤日数補正", "総合補正", "個別調整", "評価反映後", "補正後参考額", "最終賞与額", "メモ"];
    const body = calculated.map((row) => [
      mode === "base" ? "基準賞与から計算" : "総賞与額から自動配分",
      row.person.name,
      row.person.role,
      numberValue(row.input.baseSalary),
      row.person.averageScore === null ? "" : row.person.averageScore.toFixed(2),
      row.person.standardizedScore === null ? "" : row.person.standardizedScore.toFixed(2),
      row.person.bonusScore === null ? "" : row.person.bonusScore.toFixed(2),
      row.usesAutoBaseBonus ? "自動配分" : "個別上書き",
      Math.round(row.suggestedBaseBonus),
      Math.round(row.baseBonus),
      percent(row.adjustment.evaluationMultiplier),
      percent(row.adjustment.employmentMultiplier),
      percent(row.adjustment.workHoursMultiplier),
      percent(row.adjustment.attendanceMultiplier),
      percent(row.adjustment.overallMultiplier),
      row.adjustment.individualAdjustmentAmount,
      Math.round(row.adjustment.evaluationAdjustedBonus),
      Math.round(row.adjustment.finalBonus),
      Math.round(row.finalBonus),
      row.input.memo,
    ]);
    const csv = [header, ...body, ["合計", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", Math.round(totalBonus), ""]].map((line) => line.map(escapeCsv).join(",")).join("\n");
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
          <p className="mt-2 text-xs text-slate-500">自動配分モードでは、総賞与額を補正後重みに応じて必ず全額配分します。</p>
        </div>
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <div className="text-sm font-bold text-slate-500">最終賞与合計</div>
          <div className="mt-2 text-3xl font-bold text-clinic">{yen(totalBonus)}</div>
          <p className="mt-2 text-xs text-slate-500">{mode === "pool" ? "差額: " + yen(poolDifference) : "入力した基準賞与から計算した合計です。"}</p>
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">賞与計算表</h2>
            <p className="mt-1 text-sm text-slate-600">自動配分モードでは、総賞与額を賞与原資として、評価標準化・総合補正・個別調整を反映した重みに応じて全額配分します。</p>
            <p className="mt-1 text-sm text-slate-600">基準賞与額は均等配分額を初期値として表示し、スタッフごとに手動上書きできます。</p>
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
                    {mode === "pool" ? <span className={(row.usesAutoBaseBonus ? "bg-mint text-clinic" : "bg-amber-50 text-amber-700") + " rounded px-3 py-1 text-sm font-bold"}>{row.usesAutoBaseBonus ? "均等基準" : "個別上書き"}</span> : null}
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

              <div className="mt-4 grid gap-3 lg:grid-cols-[160px_220px_1fr_180px]">
                <label className="space-y-1"><span className="text-sm font-bold text-slate-600">基本給</span><input inputMode="numeric" value={row.input.baseSalary} onChange={(event) => update(row.person.id, { baseSalary: event.target.value })} className="h-12 w-full rounded border border-slate-300 px-3 text-right" placeholder="例 250000" /></label>
                <label className="space-y-1">
                  <span className="text-sm font-bold text-slate-600">基準賞与額</span>
                  <div className="flex gap-2">
                    <input inputMode="numeric" value={mode === "pool" && row.usesAutoBaseBonus ? String(Math.round(row.suggestedBaseBonus)) : row.input.baseBonus} onChange={(event) => updateBaseBonus(row.person.id, event.target.value)} className="h-12 min-w-0 flex-1 rounded border border-slate-300 px-3 text-right" placeholder="例 300000" />
                    {mode === "pool" && !row.usesAutoBaseBonus ? <button type="button" onClick={() => resetBaseBonusToAuto(row.person.id)} className="grid h-12 w-12 place-items-center rounded border border-clinic text-clinic" title="均等配分額に戻す"><RotateCcw size={18} /></button> : null}
                  </div>
                  {mode === "pool" ? <span className="block text-xs text-slate-500">均等配分額: {yen(row.suggestedBaseBonus)}。入力すると個別上書きになります。</span> : null}
                </label>
                <div className="grid gap-2 rounded bg-mint/60 p-3 text-sm md:grid-cols-4">
                  <div><div className="text-slate-600">基準賞与</div><b>{yen(row.baseBonus)}</b></div>
                  <div><div className="text-slate-600">評価反映後</div><b>{yen(row.adjustment.evaluationAdjustedBonus)}</b></div>
                  <div><div className="text-slate-600">補正後参考額</div><b>{yen(row.adjustment.finalBonus)}</b></div>
                  <div><div className="text-slate-600">最終配分額</div><b>{yen(row.finalBonus)}</b></div>
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
                    <div>総合補正: <b>{percent(row.adjustment.overallMultiplier)}</b></div>
                    <div>個別調整: <b>{yen(row.adjustment.individualAdjustmentAmount)}</b></div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">自動配分モードでは、基準賞与額 × 評価標準化補正 × 総合補正を重みとして計算し、賞与原資を全額再配分します。</p>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">補正計算の考え方</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">基準賞与額に評価標準化補正と総合補正を掛けた値をスタッフごとの重みとして扱います。自動配分モードでは、その重みに応じて総賞与額を全額配分し、円単位の差額も調整します。計算ロジックは <code className="rounded bg-slate-100 px-2 py-1">lib/bonusAdjustment.ts</code> に独立しています。</p>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">評価標準化補正</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">{["4.5以上: 120%", "4.0以上: 110%", "3.5以上: 100%", "3.0以上: 90%", "3.0未満: 80%"].map((item) => <div key={item} className="rounded bg-slate-50 p-4 text-center font-bold text-ink">{item}</div>)}</div>
      </section>
    </div>
  );
}

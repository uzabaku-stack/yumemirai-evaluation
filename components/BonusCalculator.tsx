"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RotateCcw, Save } from "lucide-react";
import { calculateBonusAdjustment, calculateEvaluationStandardizationMultiplier, evaluationStandardizationAdjustmentDescription, ratePercentToMultiplier } from "@/lib/bonusAdjustment";
import type { BonusCalculation, EvaluationCycle } from "@/lib/types";

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
  finalBonus: string;
  finalBonusMode: BaseBonusMode;
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

type BonusCalculationSnapshot = {
  rows?: Record<string, LegacyRowInput>;
  mode?: CalculationMode;
  totalPool?: string;
};

type Props = {
  staff: BonusStaff[];
  cycles: EvaluationCycle[];
  selectedCycleId: number | null;
  initialCalculations: BonusCalculation[];
};

const storageKey = "yumemirai_bonus_calculator_v5";
const legacyStorageKeys = ["yumemirai_bonus_calculator_v4", "yumemirai_bonus_calculator_v3", "yumemirai_bonus_calculator_v2"];
const percentageOptions = Array.from({ length: 15 }, (_, index) => 50 + index * 5);

function yen(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(Math.round(value));
}

function numberValue(value: string) {
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function percent(value: number) {
  return (value * 100).toFixed(1).replace(/\.0$/, "") + "%";
}

function fmt(value: number | null) {
  return value === null || !Number.isFinite(value) ? "-" : value.toFixed(2);
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
    finalBonus: "",
    finalBonusMode: "auto",
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
  const finalBonus = input?.finalBonus ?? fallback.finalBonus;
  const finalBonusMode = input?.finalBonusMode === "manual" || input?.finalBonusMode === "auto" ? input.finalBonusMode : (finalBonus ? "manual" : "auto");
  return {
    baseSalary: input?.baseSalary ?? fallback.baseSalary,
    baseBonus,
    baseBonusMode,
    finalBonus,
    finalBonusMode,
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

function distributePoolByWeightWithLockedFinals(total: number, weights: number[], fixedAdjustments: number[], lockedFinals: Array<number | null>) {
  if (!weights.length) return [] as number[];
  const results = lockedFinals.map((value) => value === null ? 0 : Math.max(0, Math.round(value)));
  const unlockedIndexes = weights.map((_, index) => index).filter((index) => lockedFinals[index] === null);
  if (!unlockedIndexes.length) {
    return results;
  }
  const lockedTotal = results.reduce((sum, value, index) => sum + (lockedFinals[index] === null ? 0 : value), 0);
  const unlockedBonuses = distributePoolByWeight(
    Math.max(0, Math.round(total) - lockedTotal),
    unlockedIndexes.map((index) => weights[index]),
    unlockedIndexes.map((index) => fixedAdjustments[index]),
  );
  unlockedIndexes.forEach((index, cursor) => {
    results[index] = unlockedBonuses[cursor] ?? 0;
  });
  return results;
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

function nextBonusCycleInput(cycle: EvaluationCycle | null | undefined) {
  const baseDate = cycle?.endDate ? new Date(cycle.endDate + "T00:00:00") : new Date();
  const year = baseDate.getFullYear();
  const isSummer = String(cycle?.name ?? "").includes("夏") || baseDate.getMonth() < 8;
  const nextYear = isSummer ? year : year + 1;
  const name = nextYear + "年 " + (isSummer ? "冬評価" : "夏評価");
  return isSummer
    ? { name, startDate: nextYear + "-09-01", endDate: nextYear + "-12-31", status: "active" }
    : { name, startDate: nextYear + "-01-01", endDate: nextYear + "-08-31", status: "active" };
}

export function BonusCalculator({ staff, cycles, selectedCycleId, initialCalculations }: Props) {
  const selectedCycle = cycles.find((cycle) => cycle.id === selectedCycleId) ?? null;
  const selectedCalculation = initialCalculations.find((calculation) => calculation.evaluation_cycle_id === selectedCycleId) ?? null;
  const [calculationId, setCalculationId] = useState<number | null>(selectedCalculation?.id ?? null);
  const [rows, setRows] = useState<Record<string, RowInput>>(() => ({ ...initialRows(staff), ...normalizeRows(selectedCalculation?.rows as Record<string, LegacyRowInput> | undefined) }));
  const [mode, setMode] = useState<CalculationMode>(selectedCalculation?.mode ?? "base");
  const [totalPool, setTotalPool] = useState(selectedCalculation?.total_pool ?? "");
  const [savedMessage, setSavedMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingCycle, setIsCreatingCycle] = useState(false);
  const [localBackup, setLocalBackup] = useState<BonusCalculationSnapshot | null>(null);

  useEffect(() => {
    if (selectedCalculation) {
      setLocalBackup(null);
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey) ?? legacyStorageKeys.map((key) => window.localStorage.getItem(key)).find(Boolean);
      if (!stored) {
        setLocalBackup(null);
        return;
      }
      const parsed = JSON.parse(stored) as BonusCalculationSnapshot;
      setLocalBackup(parsed.rows ? parsed : null);
    } catch (error) {
      console.error("bonus local backup load failed", error);
      setLocalBackup(null);
    }
  }, [selectedCalculation]);

  useEffect(() => {
    if (selectedCalculation) {
      setCalculationId(selectedCalculation.id);
      setRows({ ...initialRows(staff), ...normalizeRows(selectedCalculation.rows as Record<string, LegacyRowInput> | undefined) });
      setMode(selectedCalculation.mode);
      setTotalPool(selectedCalculation.total_pool);
      setSavedMessage("保存済みの賞与計算を読み込みました。");
      return;
    }
    setCalculationId(null);
    setRows(initialRows(staff));
    setMode("base");
    setTotalPool("");
    setSavedMessage("");
  }, [selectedCalculation, staff]);

  const calculated = useMemo(() => {
    const totalPoolValue = numberValue(totalPool);
    const autoBaseBonuses = mode === "pool" ? distributeEvenly(totalPoolValue, staff.length) : staff.map(() => 0);
    const baseRows = staff.map((person, index) => {
      const input = normalizeRowInput(rows[String(person.id)]);
      const coefficient = calculateEvaluationStandardizationMultiplier(person.bonusScore);
      const employmentMultiplier = ratePercentToMultiplier(numberValue(input.employmentAdjustmentRate));
      const workHoursMultiplier = ratePercentToMultiplier(numberValue(input.workHoursAdjustmentRate));
      const attendanceMultiplier = ratePercentToMultiplier(numberValue(input.attendanceAdjustmentRate));
      const individualAdjustmentAmount = numberValue(input.individualAdjustmentAmount);
      const suggestedBaseBonus = autoBaseBonuses[index] ?? 0;
      const usesAutoBaseBonus = mode === "pool" && input.baseBonusMode !== "manual";
      const baseBonus = usesAutoBaseBonus ? suggestedBaseBonus : numberValue(input.baseBonus);
      const finalBonusOverride = input.finalBonusMode === "manual" && input.finalBonus !== "" ? Math.max(0, numberValue(input.finalBonus)) : null;
      const adjustment = calculateBonusAdjustment({
        baseBonus,
        evaluationMultiplier: coefficient,
        employmentMultiplier,
        workHoursMultiplier,
        attendanceMultiplier,
        individualAdjustmentAmount,
      });
      const poolWeight = Math.max(0, baseBonus) * coefficient * adjustment.overallMultiplier;
      return { person, input, baseBonus, suggestedBaseBonus, usesAutoBaseBonus, coefficient, adjustment, poolWeight, finalBonusOverride, finalBonus: finalBonusOverride ?? adjustment.finalBonus };
    });

    if (mode !== "pool") return baseRows;

    const poolFinalBonuses = distributePoolByWeightWithLockedFinals(
      totalPoolValue,
      baseRows.map((row) => row.poolWeight),
      baseRows.map((row) => row.adjustment.individualAdjustmentAmount),
      baseRows.map((row) => row.finalBonusOverride),
    );
    return baseRows.map((row, index) => ({ ...row, finalBonus: poolFinalBonuses[index] ?? 0 }));
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

  function updateFinalBonus(id: number, value: string) {
    update(id, { finalBonus: value, finalBonusMode: value === "" ? "auto" : "manual" });
  }

  function resetFinalBonusToAuto(id: number) {
    update(id, { finalBonus: "", finalBonusMode: "auto" });
  }

  async function saveLocal() {
    setIsSaving(true);
    setSavedMessage("");
    window.localStorage.setItem(storageKey, JSON.stringify({ rows, mode, totalPool }));
    try {
      const response = await fetch("/api/bonus-calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: calculationId, evaluation_cycle_id: selectedCycleId, name: selectedCycle?.name ?? "賞与計算", mode, total_pool: totalPool, rows }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "保存できませんでした");
      setCalculationId(data.calculation.id);
      setSavedMessage("賞与計算を保存しました。");
    } catch (error) {
      console.error("save bonus calculation failed", error);
      setSavedMessage("保存できませんでした。この端末には一時保存しています。");
    } finally {
      setIsSaving(false);
    }
  }

  function resetCurrentCalculation() {
    if (!window.confirm((selectedCycle?.name ?? "この評価期間") + "の賞与計算を新しく入力し直します。現在の画面の未保存変更は消えます。よろしいですか？")) return;
    setCalculationId(selectedCalculation?.id ?? null);
    setRows(initialRows(staff));
    setMode("base");
    setTotalPool("");
    setSavedMessage("新しい賞与計算を開始しました。保存するとこの評価期間の賞与計算として保管されます。");
  }

  function loadLocalBackup() {
    if (!localBackup?.rows) return;
    const ok = window.confirm("この端末に残っている前回の賞与計算データを読み込みます。現在の画面の未保存内容は置き換わります。よろしいですか？");
    if (!ok) return;
    setRows({ ...initialRows(staff), ...normalizeRows(localBackup.rows) });
    if (localBackup.mode === "base" || localBackup.mode === "pool") setMode(localBackup.mode);
    setTotalPool(localBackup.totalPool ?? "");
    setSavedMessage("この端末に残っていた前回の賞与計算を読み込みました。残す場合は「賞与計算を保存」を押してください。");
  }

  async function createNextCycle() {
    const next = nextBonusCycleInput(selectedCycle);
    const name = window.prompt("新しい評価期間名", next.name);
    if (!name) return;
    setIsCreatingCycle(true);
    try {
      const response = await fetch("/api/evaluation-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, name }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "評価期間を作成できませんでした");
      window.location.href = "/bonus?cycleId=" + data.cycle.id;
    } catch (error) {
      console.error("create bonus cycle failed", error);
      setSavedMessage("新しい評価期間を作成できませんでした。");
    } finally {
      setIsCreatingCycle(false);
    }
  }

  function exportCsv() {
    const header = ["計算モード", "スタッフ名", "職種", "基本給", "スタッフ評価平均", "評価標準化", "賞与反映評価", "基準賞与の扱い", "均等配分基準賞与", "基準賞与額", "評価標準化補正", "補正後の重み", "雇用形態補正", "勤務時間補正", "出勤日数補正", "総合補正", "個別調整", "評価反映後", "総合補正後", "最終賞与", "メモ"];
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
      Math.round(row.poolWeight),
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
    const csv = [header, ...body, ["合計", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", Math.round(totalBonus), ""]].map((line) => line.map(escapeCsv).join(",")).join("\n");
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
      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">賞与計算の保存・期間切り替え</h2>
            <p className="mt-1 text-sm text-slate-600">夏・冬など評価期間ごとに賞与計算を保存し、あとから呼び出せます。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={selectedCycleId ?? ""} onChange={(event) => { window.location.href = "/bonus?cycleId=" + event.target.value; }} className="h-12 rounded border border-slate-300 bg-white px-3 font-bold">
              {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
            </select>
            <button type="button" onClick={resetCurrentCalculation} className="min-h-12 rounded border border-clinic px-4 py-3 font-bold text-clinic">この期間で新規開始</button>
            <button type="button" onClick={createNextCycle} disabled={isCreatingCycle} className="min-h-12 rounded bg-clinic px-4 py-3 font-bold text-white disabled:opacity-50">{isCreatingCycle ? "作成中..." : "次の賞与期間を作成"}</button>
          </div>
        </div>
        <div className="mt-3 rounded bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          現在の期間: {selectedCycle?.name ?? "-"} / 保存状態: {calculationId ? "保存済み" : "未保存"}
        </div>
        {!calculationId && localBackup?.rows ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-bold text-amber-800">この端末に前回の賞与計算データが残っています。</p>
            <button type="button" onClick={loadLocalBackup} className="min-h-11 rounded bg-amber-600 px-4 py-2 font-bold text-white">前回の端末保存データを読み込む</button>
          </div>
        ) : null}
      </section>

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
          <p className="mt-2 text-xs text-slate-500">自動配分モードでは、総賞与額を賞与原資として全額配分します。</p>
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
            <h2 className="text-xl font-bold">賞与計算一覧</h2>
            <p className="mt-1 text-sm text-slate-600">通常表示は必要な金額だけに絞り、総合補正の詳細と入力欄は折りたたみ内にまとめています。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveLocal} disabled={isSaving} className="flex min-h-12 items-center gap-2 rounded border border-clinic px-5 py-3 font-bold text-clinic disabled:opacity-50"><Save size={18} />{isSaving ? "保存中..." : "賞与計算を保存"}</button>
            <button type="button" onClick={exportCsv} className="flex min-h-12 items-center gap-2 rounded bg-clinic px-5 py-3 font-bold text-white"><Download size={18} />CSV出力</button>
          </div>
          {savedMessage ? <div className="w-full rounded bg-mint px-4 py-3 font-bold text-clinic">{savedMessage}</div> : null}
        </div>

        <div className="mt-5 space-y-3">
          {calculated.map((row) => (
            <article key={row.person.id} className="rounded border border-slate-200 bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(5,minmax(120px,1fr))] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-xl font-bold text-ink">{row.person.name}</h3>
                    <span className="rounded bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{row.person.role}</span>
                    {row.finalBonusOverride !== null ? <span className="rounded bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">最終賞与を上書き中</span> : null}
                    {mode === "pool" ? <span className={(row.usesAutoBaseBonus ? "bg-mint text-clinic" : "bg-amber-50 text-amber-700") + " rounded px-3 py-1 text-xs font-bold"}>{row.usesAutoBaseBonus ? "自動配分" : "個別上書き"}</span> : null}
                  </div>
                </div>
                <SummaryValue label="標準化前評価" value={fmt(row.person.averageScore)} />
                <SummaryValue label="標準化後評価" value={fmt(row.person.standardizedScore)} />
                <SummaryValue label="評価標準化補正率" value={percent(row.adjustment.evaluationMultiplier)} />
                <SummaryValue label="総合補正後" value={yen(row.adjustment.finalBonus)} />
                <div className="rounded bg-mint px-4 py-3 text-right">
                  <div className="text-xs font-bold text-clinic">最終賞与</div>
                  <div className="text-2xl font-bold text-clinic">{yen(row.finalBonus)}</div>
                </div>
              </div>

              <details className="mt-3 rounded border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-base font-bold text-ink">総合補正の詳細・入力欄を開く</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-[160px_220px_220px_1fr]">
                  <label className="space-y-1">
                    <span className="text-sm font-bold text-slate-600">基本給</span>
                    <input inputMode="numeric" value={row.input.baseSalary} onChange={(event) => update(row.person.id, { baseSalary: event.target.value })} className="h-12 w-full rounded border border-slate-300 px-3 text-right" placeholder="例 250000" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-bold text-slate-600">基準賞与額</span>
                    <div className="flex gap-2">
                      <input inputMode="numeric" value={mode === "pool" && row.usesAutoBaseBonus ? String(Math.round(row.suggestedBaseBonus)) : row.input.baseBonus} onChange={(event) => updateBaseBonus(row.person.id, event.target.value)} className="h-12 min-w-0 flex-1 rounded border border-slate-300 px-3 text-right" placeholder="例 300000" />
                      {mode === "pool" && !row.usesAutoBaseBonus ? <button type="button" onClick={() => resetBaseBonusToAuto(row.person.id)} className="grid h-12 w-12 place-items-center rounded border border-clinic text-clinic" title="自動配分額に戻す"><RotateCcw size={18} /></button> : null}
                    </div>
                    {mode === "pool" ? <span className="block text-xs text-slate-500">均等配分額: {yen(row.suggestedBaseBonus)}。入力すると個別上書きになります。</span> : null}
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-bold text-slate-600">最終賞与</span>
                    <div className="flex gap-2">
                      <input inputMode="numeric" value={row.finalBonusOverride === null ? String(Math.round(row.finalBonus)) : row.input.finalBonus} onChange={(event) => updateFinalBonus(row.person.id, event.target.value)} className="h-12 min-w-0 flex-1 rounded border border-slate-300 px-3 text-right" placeholder="例 300000" />
                      {row.finalBonusOverride !== null ? <button type="button" onClick={() => resetFinalBonusToAuto(row.person.id)} className="grid h-12 w-12 place-items-center rounded border border-clinic text-clinic" title="自動計算に戻す"><RotateCcw size={18} /></button> : null}
                    </div>
                    <span className="block text-xs text-slate-500">入力すると最終賞与を固定します。空欄にすると自動計算へ戻ります。</span>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-bold text-slate-600">メモ</span>
                    <input value={row.input.memo} onChange={(event) => update(row.person.id, { memo: event.target.value })} className="h-12 w-full rounded border border-slate-300 px-3" placeholder="メモ" />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-5">
                  <RateSelect id={"employment-" + row.person.id} label="雇用形態補正" value={row.input.employmentAdjustmentRate} onChange={(value) => update(row.person.id, { employmentAdjustmentRate: value })} />
                  <RateSelect id={"work-hours-" + row.person.id} label="勤務時間補正" value={row.input.workHoursAdjustmentRate} onChange={(value) => update(row.person.id, { workHoursAdjustmentRate: value })} />
                  <RateSelect id={"attendance-" + row.person.id} label="出勤日数補正" value={row.input.attendanceAdjustmentRate} onChange={(value) => update(row.person.id, { attendanceAdjustmentRate: value })} />
                  <label className="space-y-1">
                    <span className="text-sm font-bold text-slate-600">個別調整</span>
                    <input inputMode="numeric" value={row.input.individualAdjustmentAmount} onChange={(event) => update(row.person.id, { individualAdjustmentAmount: event.target.value })} className="h-12 w-full rounded border border-slate-300 px-3 text-right" placeholder="例 -10000" />
                  </label>
                  <div className="rounded bg-white p-3 text-sm leading-7">
                    <div>評価標準化補正率: <b>{percent(row.adjustment.evaluationMultiplier)}</b></div>
                    <div>補正後の重み: <b>{yen(row.poolWeight)}</b></div>
                    <div>雇用形態補正: <b>{percent(row.adjustment.employmentMultiplier)}</b></div>
                    <div>勤務時間補正: <b>{percent(row.adjustment.workHoursMultiplier)}</b></div>
                    <div>出勤日数補正: <b>{percent(row.adjustment.attendanceMultiplier)}</b></div>
                    <div>総合補正: <b>{percent(row.adjustment.overallMultiplier)}</b></div>
                    <div>個別調整: <b>{yen(row.adjustment.individualAdjustmentAmount)}</b></div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded bg-mint/60 p-3 text-sm md:grid-cols-4">
                  <div><div className="text-slate-600">基準賞与</div><b>{yen(row.baseBonus)}</b></div>
                  <div><div className="text-slate-600">評価反映後</div><b>{yen(row.adjustment.evaluationAdjustedBonus)}</b></div>
                  <div><div className="text-slate-600">総合補正後</div><b>{yen(row.adjustment.finalBonus)}</b></div>
                  <div><div className="text-slate-600">最終賞与</div><b>{yen(row.finalBonus)}</b></div>
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">補正計算の考え方</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          基準賞与額に評価標準化補正と総合補正を掛けた値をスタッフごとの重みとして扱います。自動配分モードでは、その重みに応じて総賞与額を全額配分し、円単位の差額も調整します。計算ロジックは <code className="rounded bg-slate-100 px-2 py-1">lib/bonusAdjustment.ts</code> に独立しています。
        </p>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">評価標準化補正</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">{evaluationStandardizationAdjustmentDescription}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {["3.0 → 80%", "3.5 → 100%", "3.8 → 112%", "4.0 → 120%", "4.5 → 140%"].map((item) => <div key={item} className="rounded bg-slate-50 p-4 text-center font-bold text-ink">{item}</div>)}
        </div>
      </section>
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 px-4 py-3 text-right">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="text-xl font-bold text-ink">{value}</div>
    </div>
  );
}

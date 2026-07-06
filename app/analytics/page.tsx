import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { ThemeRadarChart } from "@/components/ThemeRadarChart";
import { getCurrentUser } from "@/lib/auth";
import { get360SummaryForCycle, getEvaluationCycles, getEvaluations, getStaffList } from "@/lib/db";
import { getEvaluationCompletionStats } from "@/lib/evaluationCompletion";
import { calculateEvaluationStandardization } from "@/lib/evaluationStandardization";
import { isDirectorRole } from "@/lib/permissions";

type SortMode = "low" | "high";
type TypeFilter = "all" | "self" | "peer" | "director";
type Search = { sort?: SortMode; cycleId?: string; type?: TypeFilter };

type Summary = ReturnType<typeof get360SummaryForCycle>;
type StaffSummary = Summary["staff_summaries"][number];
type ThemeRow = StaffSummary["theme_breakdown"][number];
type RankingRow = Summary["item_rankings"][number];

function fmt(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toFixed(2);
}

function signed(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : (value > 0 ? "+" : "") + value.toFixed(2);
}

function average(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function barWidth(value: number | null | undefined) {
  return String(Math.max(0, Math.min(100, ((value ?? 0) / 5) * 100))) + "%";
}

function scoreTone(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-slate-400";
  if (value < 3) return "text-red-600";
  if (value >= 4) return "text-clinic";
  return "text-ink";
}

function typeLabel(type: TypeFilter) {
  if (type === "self") return "自己評価";
  if (type === "peer") return "360°評価";
  if (type === "director") return "院長評価";
  return "全評価";
}

function staffAverage(row: StaffSummary, type: TypeFilter) {
  if (type === "self") return row.self_average;
  if (type === "peer") return row.peer_average;
  if (type === "director") return row.director_average;
  return average([row.self_average, row.peer_average, row.director_average]);
}

function themeAverage(row: ThemeRow, type: TypeFilter) {
  if (type === "self") return row.self_average;
  if (type === "peer") return row.peer_average;
  if (type === "director") return row.director_average;
  return row.overall_average;
}

function sortByMode<T>(rows: T[], getter: (row: T) => number | null | undefined, sortMode: SortMode) {
  return [...rows].sort((a, b) => sortMode === "high" ? (getter(b) ?? -1) - (getter(a) ?? -1) : (getter(a) ?? 99) - (getter(b) ?? 99));
}

function hrefFor(params: Search, patch: Partial<Search>) {
  const next = new URLSearchParams();
  const merged: Search = { ...params, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== "" && value !== "all") next.set(key, String(value));
  }
  const query = next.toString();
  return "/analytics" + (query ? "?" + query : "");
}

function SimpleBarChart({ rows }: { rows: Array<{ label: string; value: number | null; note?: string }> }) {
  return (
    <div className="space-y-3">
      {rows.length ? rows.map((row) => (
        <div key={row.label} className="grid gap-2 md:grid-cols-[180px_1fr_70px]">
          <div className="font-bold text-ink">{row.label}{row.note ? <span className="ml-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">{row.note}</span> : null}</div>
          <div className="h-9 overflow-hidden rounded bg-slate-100">
            <div className="flex h-full items-center justify-end rounded bg-clinic px-2 text-sm font-bold text-white" style={{ width: barWidth(row.value) }}>{fmt(row.value)}</div>
          </div>
          <div className="text-right text-lg font-bold text-clinic">{fmt(row.value)}</div>
        </div>
      )) : <p className="text-slate-500">表示できるデータがありません。</p>}
    </div>
  );
}

function LineTrendChart({ rows }: { rows: Array<{ label: string; value: number | null }> }) {
  const width = 720;
  const points = rows.map((row, index) => {
    const x = rows.length <= 1 ? width / 2 : 40 + (index * (width - 80)) / (rows.length - 1);
    const y = row.value === null ? null : 180 - (Math.max(0, Math.min(5, row.value)) / 5) * 140;
    return { ...row, x, y };
  });
  const line = points.filter((point): point is typeof point & { y: number } => point.y !== null).map((point) => point.x.toFixed(1) + "," + point.y.toFixed(1)).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 720 240" className="min-w-[620px] rounded border border-slate-200 bg-white" role="img" aria-label="時系列推移グラフ">
        <g>{[1, 2, 3, 4, 5].map((score) => {
          const y = 180 - (score / 5) * 140;
          return <g key={score}><line x1="40" x2="680" y1={y} y2={y} stroke="#e2e8f0" /><text x="16" y={y + 4} className="fill-slate-500 text-[11px]">{score}</text></g>;
        })}</g>
        {line ? <polyline points={line} fill="none" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.map((point) => (
          <g key={point.label}>
            <text x={point.x} y="218" textAnchor="middle" className="fill-slate-600 text-[11px] font-bold">{point.label}</text>
            {point.y !== null ? <><circle cx={point.x} cy={point.y} r="6" fill="#0f766e" /><text x={point.x} y={point.y - 12} textAnchor="middle" className="fill-slate-700 text-[12px] font-bold">{fmt(point.value)}</text></> : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");

  const query = searchParams ? await searchParams : {};
  const sortMode: SortMode = query.sort === "high" ? "high" : "low";
  const typeFilter: TypeFilter = query.type === "self" || query.type === "peer" || query.type === "director" ? query.type : "all";
  const cycles = getEvaluationCycles();
  const selectedCycle = cycles.find((cycle) => cycle.id === Number(query.cycleId)) ?? cycles.find((cycle) => cycle.status === "active") ?? cycles[0];
  const summary = selectedCycle ? get360SummaryForCycle(selectedCycle.id) : get360SummaryForCycle(cycles[0]?.id ?? 0);
  const allEvaluations = getEvaluations();
  const completion = getEvaluationCompletionStats(getStaffList(), allEvaluations, selectedCycle ?? null);
  const listedEvaluations = completion.completedStaffEvaluations;
  const completedStaffRows = summary.staff_summaries.filter((row) => completion.completedStaffIds.has(row.staff.id));
  const standardization = calculateEvaluationStandardization(listedEvaluations);
  const standardizedByStaff = new Map(standardization.staffScores.map((score) => [score.staffId, score]));
  const clinicOverall = average(completedStaffRows.map((row) => staffAverage(row, typeFilter)));
  const sortedStaff = sortByMode(completedStaffRows, (row) => staffAverage(row, typeFilter), sortMode);
  const itemRankings = sortByMode(summary.item_rankings, (row) => row.average, sortMode).slice(0, 20);
  const highItems = sortByMode(summary.item_rankings, (row) => row.average, "high").slice(0, 5);
  const lowItems = sortByMode(summary.item_rankings, (row) => row.average, "low").slice(0, 5);
  const themes = summary.theme_rankings.map((item) => item.theme);
  const radarValues = summary.theme_rankings.map((item) => ({ theme: item.theme, average: item.average }));
  const trendRows = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate)).map((cycle) => {
    const cycleSummary = get360SummaryForCycle(cycle.id);
    return { label: cycle.name, value: average(cycleSummary.staff_summaries.map((row) => staffAverage(row, typeFilter))) };
  });
  const params: Search = { cycleId: selectedCycle ? String(selectedCycle.id) : undefined, sort: sortMode, type: typeFilter };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">集計分析</h1>
          <p className="mt-1 text-slate-600">全体傾向・項目別分析・ランキングを確認します。</p>
        </div>
        <Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link>
      </div>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">分析条件</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <FilterGroup label="評価期間">{cycles.map((cycle) => <Link key={cycle.id} href={hrefFor(params, { cycleId: String(cycle.id) })} className={(selectedCycle?.id === cycle.id ? "bg-clinic text-white" : "border border-clinic text-clinic") + " rounded px-4 py-3 font-bold"}>{cycle.name}</Link>)}</FilterGroup>
          <FilterGroup label="評価種別">{(["all", "self", "peer", "director"] as TypeFilter[]).map((type) => <Link key={type} href={hrefFor(params, { type })} className={(typeFilter === type ? "bg-clinic text-white" : "border border-clinic text-clinic") + " rounded px-4 py-3 font-bold"}>{typeLabel(type)}</Link>)}</FilterGroup>
          <FilterGroup label="並び順">
            <Link href={hrefFor(params, { sort: "low" })} className={(sortMode === "low" ? "bg-clinic text-white" : "border border-clinic text-clinic") + " inline-flex min-h-11 items-center gap-2 rounded px-4 py-2 font-bold"}><ArrowDownAZ size={18} />低い順</Link>
            <Link href={hrefFor(params, { sort: "high" })} className={(sortMode === "high" ? "bg-clinic text-white" : "border border-clinic text-clinic") + " inline-flex min-h-11 items-center gap-2 rounded px-4 py-2 font-bold"}><ArrowUpAZ size={18} />高い順</Link>
          </FilterGroup>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="全体平均" value={fmt(clinicOverall)} />
        <SummaryCard label="評価件数" value={String(listedEvaluations.length)} />
        <SummaryCard label="評価者数" value={String(standardization.evaluatorAverages.length)} />
        <SummaryCard label="評価期間" value={selectedCycle?.name ?? "-"} compact />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="スタッフランキング" description="スタッフ別の平均点を比較します。少人数の360°評価は参考値として表示します。">
          <SimpleBarChart rows={sortedStaff.map((row) => ({ label: row.staff.name, value: staffAverage(row, typeFilter), note: row.peer_evaluator_count > 0 && row.peer_evaluator_count < 3 ? "参考値" : undefined }))} />
        </Panel>
        <Panel title="カテゴリ別レーダーチャート" description="評価シートのセクション別平均を確認します。">
          <ThemeRadarChart themes={themes} series={[{ label: typeLabel(typeFilter), color: "#0f766e", values: radarValues }]} />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="項目別平均" description="医院全体で高い項目・低い項目を確認します。">
          <SimpleBarChart rows={itemRankings.map((item: RankingRow) => ({ label: item.item_name, value: item.average, note: item.count > 0 && item.count < 3 ? "参考値" : undefined }))} />
        </Panel>
        <Panel title="前回比較" description="評価期間ごとの全体平均の推移です。">
          <LineTrendChart rows={trendRows} />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="評価が高い項目" description="医院全体の強みになっている項目です。">
          <div className="space-y-3">{highItems.map((item) => <div key={item.item_id} className="flex items-center justify-between rounded bg-mint p-4"><span className="font-bold">{item.item_name}</span><span className="text-xl font-bold text-clinic">{fmt(item.average)}</span></div>)}</div>
        </Panel>
        <Panel title="評価が低い項目" description="医院全体で優先して育成・改善したい項目です。">
          <div className="space-y-3">{lowItems.map((item) => <div key={item.item_id} className="flex items-center justify-between rounded border border-slate-200 p-4"><span className="font-bold">{item.item_name}</span><span className="text-xl font-bold text-ink">{fmt(item.average)}</span></div>)}</div>
        </Panel>
      </section>

      <Panel title="評価者ごとの甘辛傾向" description="評価者ごとの平均点と補正量を分析用に確認します。">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="border-b text-sm text-slate-500"><th className="py-3">評価者</th><th>平均</th><th>件数</th><th>補正値</th></tr></thead>
            <tbody>
              {standardization.evaluatorAverages.length ? standardization.evaluatorAverages.map((row) => (
                <tr key={row.evaluatorKey} className="border-b last:border-0">
                  <td className="py-3 font-bold">{row.evaluatorKey}</td>
                  <td className={"font-bold " + scoreTone(row.average)}>{fmt(row.average)}</td>
                  <td>{row.count}</td>
                  <td>{signed(row.adjustment)}</td>
                </tr>
              )) : <tr><td colSpan={4} className="py-8 text-center text-slate-500">表示できる評価者データはありません。</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="評価標準化（分析用）" description="賞与計算へ渡す前に、評価者ごとの甘辛傾向をならしたスコアを確認します。">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="border-b text-sm text-slate-500"><th className="py-3">スタッフ</th><th>スタッフ評価平均</th><th>評価標準化</th><th>賞与反映評価</th><th>評価件数</th></tr></thead>
            <tbody>
              {sortedStaff.map((row) => {
                const standardized = standardizedByStaff.get(row.staff.id);
                return (
                  <tr key={row.staff.id} className="border-b last:border-0">
                    <td className="py-3 font-bold">{row.staff.name}</td>
                    <td>{fmt(standardized?.rawAverage ?? staffAverage(row, typeFilter))}</td>
                    <td className="font-bold text-clinic">{fmt(standardized?.standardizedScore)}</td>
                    <td className="font-bold text-clinic">{fmt(standardized?.bonusScore)}</td>
                    <td>{standardized?.evaluationCount ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-bold text-slate-600">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SummaryCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
      <div className="text-sm font-bold text-slate-500">{label}</div>
      <div className={(compact ? "text-xl" : "text-3xl") + " mt-2 font-bold text-clinic"}>{value}</div>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

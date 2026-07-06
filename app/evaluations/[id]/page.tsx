import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Edit3, FileText } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ThemeRadarChart } from "@/components/ThemeRadarChart";
import { canViewEvaluation, getCurrentUser } from "@/lib/auth";
import { get360Summary, get360SummaryForCycle, getEvaluation, getEvaluationItemsForEvaluation, getEvaluationScores, getPreviousComparison, getRatingCriteriaText } from "@/lib/db";
import { calculateSummary, parseComments } from "@/lib/scoring";
import { isDirectorRole } from "@/lib/permissions";

type ItemRow = {
  item_id: number;
  item_name: string;
  section_name: string;
  item_order: number;
  self_average: number | null;
  peer_average: number | null;
  director_average: number | null;
  overall_average: number | null;
  clinic_average: number | null;
  difference_from_average: number | null;
};

function fmt(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toFixed(2);
}

function average(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function typeLabel(type: string) {
  if (type === "self") return "自己評価";
  if (type === "peer") return "360°評価";
  if (type === "director") return "院長評価";
  return "その他評価";
}

function diffText(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return (value > 0 ? "+" : "") + value.toFixed(2);
}

function fallbackItemRows(evaluationId: number): ItemRow[] {
  const items = getEvaluationItemsForEvaluation(evaluationId);
  const scores = getEvaluationScores(evaluationId);
  const scoreMap = new Map(scores.map((score) => [score.item_id, score.not_applicable || score.score === null ? null : Number(score.score)]));
  return items.map((item) => {
    const score = scoreMap.has(item.id) ? scoreMap.get(item.id) ?? null : null;
    return {
      item_id: item.id,
      item_name: item.item_name,
      section_name: item.section_name,
      item_order: item.item_order,
      self_average: null,
      peer_average: null,
      director_average: null,
      overall_average: score,
      clinic_average: null,
      difference_from_average: null,
    };
  });
}

function ComparisonList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? items.map((item) => <span key={item} className="rounded bg-slate-100 px-3 py-2 text-sm">{item}</span>) : <span className="text-sm text-slate-500">なし</span>}
      </div>
    </div>
  );
}

export default async function EvaluationResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/growth");
  const { id } = await params;
  const evaluation = getEvaluation(Number(id));
  if (!evaluation || !canViewEvaluation(user, evaluation)) notFound();

  const items = getEvaluationItemsForEvaluation(evaluation.id);
  const scores = getEvaluationScores(evaluation.id);
  const summary = calculateSummary(items, scores);
  const comments = parseComments(evaluation.comments);
  const comparison = isDirectorRole(user.role) ? getPreviousComparison(evaluation.id) : null;
  const ratingCriteriaText = getRatingCriteriaText();
  const cycleSummary = evaluation.evaluation_cycle_id ? get360SummaryForCycle(evaluation.evaluation_cycle_id) : get360Summary(evaluation.evaluation_month);
  const staffSummary = cycleSummary.staff_summaries.find((row) => row.staff.id === evaluation.staff_id);
  const itemRows: ItemRow[] = (staffSummary?.item_breakdown.length ? staffSummary.item_breakdown : fallbackItemRows(evaluation.id)).sort((a, b) => a.section_name.localeCompare(b.section_name, "ja") || a.item_order - b.item_order || a.item_name.localeCompare(b.item_name, "ja"));
  const rankedItems = itemRows.filter((item): item is ItemRow & { overall_average: number } => item.overall_average !== null && Number.isFinite(item.overall_average));
  const strengths = [...rankedItems].sort((a, b) => b.overall_average - a.overall_average).slice(0, 3);
  const improvements = [...rankedItems].sort((a, b) => a.overall_average - b.overall_average).slice(0, 3);
  const finalAverage = staffSummary ? average([staffSummary.self_average, staffSummary.peer_average, staffSummary.director_average]) : summary.averageScore;
  const radarItems = rankedItems.slice(0, 16);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">評価結果 個人詳細</h1>
          <p className="mt-1 text-slate-600">{evaluation.staff_name} / {evaluation.evaluation_cycle_name ?? evaluation.evaluation_month} / {evaluation.entry_date}</p>
        </div>
        <div className="flex gap-2">
          <Link href={"/evaluations/" + evaluation.id + "/edit"} className="flex items-center gap-2 rounded border border-clinic px-5 py-4 font-bold text-clinic"><Edit3 size={20} />再編集</Link>
          <Link href={"/evaluations/" + evaluation.id + "/print"} target="_blank" className="flex items-center gap-2 rounded bg-clinic px-5 py-4 font-bold text-white"><FileText size={20} />PDF出力</Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="総合評価" value={fmt(finalAverage)} />
        <StatCard label="自己評価" value={fmt(staffSummary?.self_average)} />
        <StatCard label="360°評価平均" value={fmt(staffSummary?.peer_average)} />
        <StatCard label="院長評価" value={fmt(staffSummary?.director_average)} tone="accent" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold">項目別平均レーダーチャート</h2>
          <p className="mt-1 text-sm text-slate-600">項目別平均点を使った個人別チャートです。項目が多い場合は上位16項目を表示します。</p>
          {radarItems.length ? <ThemeRadarChart themes={radarItems.map((item) => item.item_name)} series={[{ label: "項目平均", color: "#0f766e", values: radarItems.map((item) => ({ theme: item.item_name, average: item.overall_average })) }]} /> : <p className="mt-4 text-sm text-slate-500">表示できる項目別平均がありません。</p>}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-bold">強みTOP3</h2>
            <div className="mt-4 space-y-3">
              {strengths.length ? strengths.map((item, index) => (
                <div key={item.item_id} className="rounded bg-mint p-4">
                  <div className="text-sm font-bold text-clinic">{index + 1}位</div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="font-bold">{item.item_name}</span>
                    <span className="text-2xl font-bold text-clinic">{fmt(item.overall_average)}</span>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">表示できる項目がありません。</p>}
            </div>
          </section>

          <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-bold">改善候補TOP3</h2>
            <div className="mt-4 space-y-3">
              {improvements.length ? improvements.map((item, index) => (
                <div key={item.item_id} className="rounded border border-slate-200 p-4">
                  <div className="text-sm font-bold text-slate-500">{index + 1}位</div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="font-bold">{item.item_name}</span>
                    <span className="text-2xl font-bold text-ink">{fmt(item.overall_average)}</span>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">表示できる項目がありません。</p>}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">項目別平均点一覧</h2>
        <p className="mt-1 text-sm text-slate-600">各評価項目について、自己評価・360°評価平均・院長評価・項目別平均点・医院平均との差を表示します。</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead>
              <tr className="border-b text-sm text-slate-500">
                <th className="py-3">評価項目</th>
                <th>セクション</th>
                <th className="text-center">自己評価</th>
                <th className="text-center">360°評価平均</th>
                <th className="text-center">院長評価</th>
                <th className="text-center">項目別平均点</th>
                <th className="text-center">医院平均</th>
                <th className="text-center">平均との差</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.length ? itemRows.map((item) => (
                <tr key={item.item_id} className="border-b last:border-0">
                  <td className="py-3 font-bold">{item.item_name}</td>
                  <td className="text-sm text-slate-600">{item.section_name}</td>
                  <td className="text-center font-bold">{fmt(item.self_average)}</td>
                  <td className="text-center font-bold">{fmt(item.peer_average)}</td>
                  <td className="text-center font-bold">{fmt(item.director_average)}</td>
                  <td className="text-center text-lg font-bold text-clinic">{fmt(item.overall_average)}</td>
                  <td className="text-center">{fmt(item.clinic_average)}</td>
                  <td className={(item.difference_from_average ?? 0) < 0 ? "text-center font-bold text-red-600" : "text-center font-bold text-clinic"}>{diffText(item.difference_from_average)}</td>
                </tr>
              )) : <tr><td colSpan={8} className="py-8 text-center text-slate-500">項目別平均点はまだありません。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">セクション別スコア</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {summary.sectionScores.map((section) => (
            <div key={section.section} className="rounded border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3"><div className="font-bold">{section.section}</div><div className="text-lg font-bold text-clinic">{section.average.toFixed(2)}</div></div>
              <div className="mt-3 h-3 overflow-hidden rounded bg-slate-100"><div className="h-full bg-coral" style={{ width: String((section.average / 5) * 100) + "%" }} /></div>
              <div className="mt-2 text-sm text-slate-500">{section.total} / {section.max}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">評価点の全体基準</h2>
        <p className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-4 text-sm leading-7 text-slate-600">{ratingCriteriaText}</p>
      </section>

      {comparison ? (
        <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold">前回比較</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <StatCard label="前回合計点" value={String(comparison.previousTotal)} />
              <StatCard label="今回合計点" value={String(comparison.currentTotal)} />
              <StatCard label="差分" value={(comparison.difference > 0 ? "+" : "") + String(comparison.difference)} tone="accent" />
            </div>
            <ComparisonList title="上がった項目" items={comparison.up} />
            <ComparisonList title="下がった項目" items={comparison.down} />
            <ComparisonList title="変化なしの項目" items={comparison.same} />
          </div>
        </section>
      ) : null}

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">コメント</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {Object.entries(comments).filter(([, value]) => value).length ? Object.entries(comments).filter(([, value]) => value).map(([key, value]) => (
            <div key={key} className="rounded border border-slate-200 p-4">
              <div className="font-bold text-clinic">{key}</div>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{String(value)}</p>
            </div>
          )) : <p className="text-sm text-slate-500">コメントはありません。</p>}
        </div>
      </section>
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { canViewEvaluation, getCurrentUser } from "@/lib/auth";
import { get360SummaryForCycle, getEvaluation, getEvaluationItemsForEvaluation, getEvaluationScores, getRatingCriteriaText } from "@/lib/db";
import { calculateSummary, parseComments } from "@/lib/scoring";
import { isDirectorRole } from "@/lib/permissions";

function fmt(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toFixed(2);
}

function average(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function commentText(raw: string) {
  return Object.entries(parseComments(raw))
    .filter(([key, value]) => key !== "__360_comment_meta" && String(value ?? "").trim())
    .map(([key, value]) => ({ key, value: String(value) }));
}

export default async function PrintEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const evaluation = getEvaluation(Number(id));
  if (!evaluation || !isDirectorRole(user.role) || !canViewEvaluation(user, evaluation)) notFound();

  const summaryForCycle = evaluation.evaluation_cycle_id ? get360SummaryForCycle(evaluation.evaluation_cycle_id) : null;
  const staffSummary = summaryForCycle?.staff_summaries.find((row) => row.staff.id === evaluation.staff_id);
  const directorEvaluation = staffSummary?.evaluations.filter((item) => item.evaluation_type === "director").sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0];
  const directorComments = commentText(directorEvaluation?.comments ?? evaluation.comments);
  const ratingCriteriaText = getRatingCriteriaText();

  const fallbackItems = getEvaluationItemsForEvaluation(evaluation.id);
  const fallbackScores = getEvaluationScores(evaluation.id);
  const fallbackSummary = calculateSummary(fallbackItems, fallbackScores);
  const fallbackScoreMap = new Map(fallbackScores.map((score) => [score.item_id, score.not_applicable ? "評価しない" : String(score.score ?? 1)]));
  const itemRows = staffSummary?.item_breakdown.length ? staffSummary.item_breakdown : fallbackItems.map((item) => ({
    item_id: item.id,
    section_name: item.section_name,
    item_name: item.item_name,
    self_average: null,
    peer_average: null,
    director_average: null,
    overall_average: Number(fallbackScoreMap.get(item.id)) || null,
  }));
  const finalAverage = staffSummary ? average([staffSummary.self_average, staffSummary.peer_average, staffSummary.director_average]) : fallbackSummary.averageScore;

  return (
    <div className="print-page mx-auto max-w-5xl bg-white p-8 shadow-soft">
      <PrintButton />
      <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('load',()=>setTimeout(()=>window.print(),300));" }} />
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold">業務評価 面談シート</h1>
          <p className="mt-1 text-sm text-slate-600">スタッフ1名用 / 印刷・PDF保存用</p>
        </div>
        <div className="text-right text-sm">
          <div>印刷日</div>
          <b>{new Date().toLocaleDateString("ja-JP")}</b>
        </div>
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>氏名: <b>{evaluation.staff_name}</b></div>
        <div>評価期間: <b>{evaluation.evaluation_cycle_name ?? evaluation.evaluation_month}</b></div>
        <div>記載日: <b>{evaluation.entry_date}</b></div>
        <div>最終評価: <b>{fmt(finalAverage)}</b></div>
      </section>

      <section className="mt-5 grid grid-cols-4 gap-3 text-center">
        <div className="border p-3"><div className="text-xs">総合評価</div><b>{fmt(finalAverage)}</b></div>
        <div className="border p-3"><div className="text-xs">自己評価</div><b>{fmt(staffSummary?.self_average)}</b></div>
        <div className="border p-3"><div className="text-xs">360°評価平均</div><b>{fmt(staffSummary?.peer_average)}</b></div>
        <div className="border p-3"><div className="text-xs">院長評価</div><b>{fmt(staffSummary?.director_average)}</b></div>
      </section>

      <div className="mt-4 whitespace-pre-wrap border-y py-3 text-xs leading-5">
        <b>評価点の全体基準</b>
        <br />
        {ratingCriteriaText}
      </div>

      <section className="mt-5 break-inside-avoid">
        <h2 className="border-b pb-2 text-xl font-bold">項目別評価</h2>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr>
              <th className="w-[22%] py-2">セクション</th>
              <th className="py-2">項目</th>
              <th className="w-16 text-center">自己</th>
              <th className="w-20 text-center">360°</th>
              <th className="w-16 text-center">院長</th>
              <th className="w-16 text-center">最終</th>
            </tr>
          </thead>
          <tbody>
            {itemRows.map((item) => (
              <tr key={item.item_id} className="border-t align-top">
                <td className="py-2 pr-2 font-bold">{item.section_name}</td>
                <td className="py-2 pr-2">{item.item_name}</td>
                <td className="py-2 text-center font-bold">{fmt(item.self_average)}</td>
                <td className="py-2 text-center font-bold">{fmt(item.peer_average)}</td>
                <td className="py-2 text-center font-bold">{fmt(item.director_average)}</td>
                <td className="py-2 text-center font-bold">{fmt(item.overall_average)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="border-b pb-2 text-xl font-bold">院長コメント</h2>
        <div className="mt-3 space-y-3">
          {directorComments.length ? directorComments.map((comment) => (
            <div key={comment.key}>
              <b>{comment.key}</b>
              <p className="whitespace-pre-wrap text-sm">{comment.value}</p>
            </div>
          )) : <p className="text-sm text-slate-500">院長コメントはありません。</p>}
        </div>
      </section>
    </div>
  );
}

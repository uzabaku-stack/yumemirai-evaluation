import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { canViewEvaluation, getCurrentUser } from "@/lib/auth";
import { getEvaluation, getEvaluationItemsForEvaluation, getEvaluationScores, getRatingCriteriaText } from "@/lib/db";
import { calculateSummary, parseComments } from "@/lib/scoring";
import { isDirectorRole } from "@/lib/permissions";

export default async function PrintEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const evaluation = getEvaluation(Number(id));
  if (!evaluation || !isDirectorRole(user.role) || !canViewEvaluation(user, evaluation)) notFound();
  const items = getEvaluationItemsForEvaluation(evaluation.id);
  const scores = getEvaluationScores(evaluation.id);
  const summary = calculateSummary(items, scores);
  const comments = parseComments(evaluation.comments);
  const scoreMap = new Map(scores.map((score) => [score.item_id, score.not_applicable ? "評価しない" : String(score.score ?? 1)]));
  const grouped = items.reduce((acc, item) => { (acc[item.section_name] ||= []).push(item); return acc; }, {} as Record<string, typeof items>);
  const ratingCriteriaText = getRatingCriteriaText();

  return <div className="print-page mx-auto max-w-5xl bg-white p-8 shadow-soft"><PrintButton /><script dangerouslySetInnerHTML={{ __html: "window.addEventListener('load',()=>setTimeout(()=>window.print(),300));" }} /><h1 className="text-3xl font-bold">業務評価シート</h1><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div>氏名: <b>{evaluation.staff_name}</b></div><div>記載日: <b>{evaluation.entry_date}</b></div><div>評価年月: <b>{evaluation.evaluation_month}</b></div><div>評価者: <b>{evaluation.evaluator_name}</b></div><div>評価タイプ: <b>{evaluation.evaluation_type === 'self' ? '本人評価' : '他者評価'}</b></div><div>ランク: <b>{summary.rank}</b></div></div><div className="mt-4 whitespace-pre-wrap border-y py-3 text-xs leading-5"><b>評価点の全体基準</b><br />{ratingCriteriaText}</div>{Object.entries(grouped).map(([section, sectionItems]) => <section key={section} className="mt-5 break-inside-avoid"><h2 className="border-b pb-2 text-xl font-bold">{section}</h2><table className="mt-2 w-full text-left text-sm"><thead><tr><th className="w-[30%] py-2">項目</th><th className="py-2">ⓘ 評価基準</th><th className="w-16 text-center">点数</th></tr></thead><tbody>{sectionItems.map((item) => <tr key={item.id} className="border-t align-top"><td className="py-2 pr-3 font-bold">{item.item_name}</td><td className="whitespace-pre-wrap py-2 pr-3 text-xs leading-5 text-slate-700">{item.criteria || '-'}</td><td className="py-2 text-center text-lg font-bold">{scoreMap.get(item.id) ?? 1}</td></tr>)}</tbody></table></section>)}<section className="mt-6 grid grid-cols-4 gap-3 text-center"><div className="border p-3"><div className="text-xs">合計点</div><b>{summary.totalScore}</b></div><div className="border p-3"><div className="text-xs">満点</div><b>{summary.maxScore}</b></div><div className="border p-3"><div className="text-xs">平均点</div><b>{summary.averageScore.toFixed(2)}</b></div><div className="border p-3"><div className="text-xs">評価ランク</div><b>{summary.rank}</b></div></section><section className="mt-6 break-inside-avoid"><h2 className="border-b pb-2 text-xl font-bold">総合評価</h2><div className="mt-3 space-y-3">{Object.entries(comments).map(([key, value]) => <div key={key}><b>{key}</b><p className="whitespace-pre-wrap text-sm">{value || '-'}</p></div>)}</div></section></div>;
}

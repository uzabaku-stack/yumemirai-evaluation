import Link from "next/link";
import { redirect } from "next/navigation";
import { Edit3 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getEvaluations } from "@/lib/db";

function statusLabel(evaluations: Array<{ max_score: number; average_score: number }>) {
  return evaluations.length && evaluations.every((evaluation) => evaluation.max_score > 0 && evaluation.average_score > 0) ? "入力済み" : "未入力";
}

export default async function MyEvaluationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "director") redirect("/360/results");
  const evaluations = getEvaluations().filter((evaluation) => evaluation.is_360 === 1 && evaluation.evaluator_user_id === user.id && (evaluation.evaluation_type === "self" || evaluation.evaluation_type === "peer"));
  const rows = Array.from(evaluations.reduce((map, evaluation) => {
    const row = map.get(evaluation.evaluation_month) ?? { month: evaluation.evaluation_month, entryDate: evaluation.entry_date, evaluations: [] as typeof evaluations };
    row.evaluations.push(evaluation);
    if (evaluation.entry_date > row.entryDate) row.entryDate = evaluation.entry_date;
    map.set(evaluation.evaluation_month, row);
    return map;
  }, new Map<string, { month: string; entryDate: string; evaluations: typeof evaluations }>()).values()).sort((a, b) => b.month.localeCompare(a.month));

  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">自分が入力した評価を編集</h1><p className="mt-1 text-slate-600">360°評価1回につき、月ごとに1つの編集画面を開きます。</p></div><Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link></div><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b text-sm text-slate-500"><th className="py-3">評価年月</th><th>入力日</th><th>状態</th><th className="text-right">操作</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.month} className="border-b last:border-0"><td className="py-4 font-bold">{row.month}</td><td>{row.entryDate}</td><td>{statusLabel(row.evaluations)}</td><td className="text-right"><Link href={"/360?month=" + row.month} className="inline-flex items-center gap-2 rounded bg-clinic px-4 py-3 font-bold text-white"><Edit3 size={18} />編集</Link></td></tr>) : <tr><td colSpan={4} className="py-6 text-center text-slate-500">まだ入力した評価がありません。</td></tr>}</tbody></table></div></section></div>;
}

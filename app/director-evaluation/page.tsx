import Link from "next/link";
import { redirect } from "next/navigation";
import { EvaluationCommentForm } from "@/components/EvaluationCommentForm";
import { getCurrentUser } from "@/lib/auth";
import { getEvaluation, getOrCreate360Evaluation, getStaffList } from "@/lib/db";
import { parseComments } from "@/lib/scoring";

const directorFields = ["総合所見", "強み", "課題", "期待すること", "来期目標"];

export default async function DirectorEvaluationCommentPage({ searchParams }: { searchParams?: Promise<{ saved?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "director") redirect("/");
  const query = searchParams ? await searchParams : {};
  const targets = getStaffList().map((staff) => {
    const evaluationId = getOrCreate360Evaluation(user, staff.id);
    const evaluation = getEvaluation(evaluationId);
    if (!evaluation) throw new Error("Evaluation not found");
    return { staff, evaluation, comments: parseComments(evaluation.comments) };
  });
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link></div>{query.saved === "1" ? <div className="rounded border border-teal-200 bg-mint px-5 py-4 font-bold text-clinic shadow-soft">院長評価コメントを保存しました。</div> : null}<EvaluationCommentForm user={user} targets={targets} fields={directorFields} title="院長評価コメント" description="院長評価のコメントを入力します。点数は院長評価入力画面で保存します。" backHref="/director-evaluation" /></div>;
}

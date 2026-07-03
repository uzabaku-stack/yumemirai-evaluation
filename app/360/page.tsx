import Link from "next/link";
import { redirect } from "next/navigation";
import { Evaluation360Matrix } from "@/components/Evaluation360Matrix";
import { RatingCriteriaAccordion } from "@/components/RatingCriteriaAccordion";
import { getCurrentUser } from "@/lib/auth";
import { getEvaluation, getEvaluationItems, getEvaluationScores, getOrCreate360Evaluation, getStaffList } from "@/lib/db";
import { parseComments } from "@/lib/scoring";

const evaluation360CriteriaText = [
  "1点：できていない",
  "・業務として任せられない",
  "・毎回の指示や確認が必要",
  "",
  "2点：一部できるが不安定",
  "・基本的な理解はあるが、抜けやミスがある",
  "・一人で任せるには確認が必要",
  "",
  "3点：標準レベル",
  "・基本的には一人で実施できる",
  "・医院の標準として求める水準",
  "",
  "4点：良好",
  "・安定して実施できる",
  "・状況に応じた判断や配慮ができる",
  "",
  "5点：非常に優れている",
  "・高い水準で安定して実施できる",
  "・後輩への指導や改善提案ができる"
].join("\n");

export default async function Evaluation360Page({ searchParams }: { searchParams?: Promise<{ saved?: string; month?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = searchParams ? await searchParams : {};
  const staff = getStaffList();
  const items = getEvaluationItems();
  const month = query.month || new Date().toISOString().slice(0, 7);
  if (!staff.length) return <div className="rounded border border-teal-900/10 bg-white p-6 shadow-soft">評価対象スタッフが登録されていません。</div>;
  const targets = staff.map((person) => {
    const evaluationId = getOrCreate360Evaluation(user, person.id, month);
    const evaluation = getEvaluation(evaluationId);
    if (!evaluation) throw new Error("Evaluation not found");
    return { staff: person, evaluation, scores: getEvaluationScores(evaluation.id), comments: parseComments(evaluation.comments) };
  });
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">{user.role === "director" ? "院長評価入力" : "360°評価入力"}</h1><p className="mt-1 text-slate-600">評価者: {user.name}</p></div><Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link></div><RatingCriteriaAccordion text={evaluation360CriteriaText} />{query.saved === "1" ? <div className="rounded border border-teal-200 bg-mint px-5 py-4 font-bold text-clinic shadow-soft">評価を保存しました。</div> : null}<Evaluation360Matrix user={user} items={items} targets={targets} ratingCriteriaText={evaluation360CriteriaText} afterSavePath={"/360?month=" + month + "&saved=1"} /></div>;
}

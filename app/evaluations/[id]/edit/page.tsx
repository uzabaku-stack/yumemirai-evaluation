import { notFound, redirect } from "next/navigation";
import { EvaluationEditor } from "@/components/EvaluationEditor";
import { canEditEvaluation, getCurrentUser } from "@/lib/auth";
import { getEvaluation, getEvaluationItemsForEvaluation, getEvaluationScores, getRatingCriteriaText } from "@/lib/db";
import { parseComments } from "@/lib/scoring";

export default async function EditEvaluationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ from?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const evaluation = getEvaluation(Number(id));
  if (!evaluation || !canEditEvaluation(user, evaluation)) notFound();
  return <div className="space-y-5"><h1 className="text-3xl font-bold">評価入力</h1><EvaluationEditor evaluation={evaluation} items={getEvaluationItemsForEvaluation(evaluation.id)} scores={getEvaluationScores(evaluation.id)} comments={parseComments(evaluation.comments)} user={user} ratingCriteriaText={getRatingCriteriaText()} allowNotApplicable={evaluation.evaluation_type !== "self"} afterSavePath={query.from === "360" ? "/360?saved=1" : undefined} /></div>;
}

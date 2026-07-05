import Link from "next/link";
import { redirect } from "next/navigation";
import { BonusCalculator } from "@/components/BonusCalculator";
import { getCurrentUser } from "@/lib/auth";
import { getEvaluations, getStaffList } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";
import { calculateEvaluationStandardization } from "@/lib/evaluationStandardization";

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export default async function BonusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");

  const evaluations = getEvaluations();
  const standardized = calculateEvaluationStandardization(evaluations);
  const standardizedByStaff = new Map(standardized.staffScores.map((score) => [score.staffId, score]));
  const staff = getStaffList().map((person) => {
    const scores = evaluations
      .filter((evaluation) => evaluation.staff_id === person.id && Number.isFinite(evaluation.average_score) && evaluation.average_score > 0)
      .map((evaluation) => evaluation.average_score);
    const rawAverage = average(scores);
    const standard = standardizedByStaff.get(person.id);
    return { id: person.id, name: person.name, role: person.role, averageScore: rawAverage, standardizedScore: standard?.standardizedScore ?? rawAverage, bonusScore: standard?.bonusScore ?? rawAverage };
  });

  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">賞与計算</h1><p className="mt-1 text-slate-600">評価平均点・評価標準化・基本給・基準賞与額・休み調整率から、スタッフ別の賞与目安を計算します。</p></div><Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link></div><BonusCalculator staff={staff} /></div>;
}

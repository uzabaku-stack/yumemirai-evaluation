import type { Evaluation, EvaluationCycle, Staff } from "@/lib/types";

export type MissingEvaluationRow = {
  staffId: number;
  staffName: string;
  evaluationType: "自己評価";
  status: "未回答";
};

export type EvaluationCompletionStats = {
  cycleEvaluations: Evaluation[];
  completedStaffIds: Set<number>;
  completedCount: number;
  targetStaffCount: number;
  missingCount: number;
  missingRows: MissingEvaluationRow[];
  completedStaffEvaluations: Evaluation[];
  averageScore: number | null;
};

export function isEvaluationInCycle(evaluation: Evaluation, cycle: EvaluationCycle | null | undefined) {
  if (!cycle) return true;
  if (evaluation.evaluation_cycle_id) return evaluation.evaluation_cycle_id === cycle.id;
  const cycleMonth = cycle.startDate.slice(0, 7);
  return evaluation.evaluation_month === cycleMonth;
}

function hasSubmittedScore(evaluation: Evaluation) {
  const score = Number(evaluation.average_score);
  return Number.isFinite(score) && score > 0;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function getSelfSubmittedStaffIds(evaluations: Evaluation[]) {
  return new Set(
    evaluations
      .filter((evaluation) => evaluation.evaluation_type === "self" && hasSubmittedScore(evaluation))
      .map((evaluation) => evaluation.staff_id),
  );
}

export function getEvaluationCompletionStats(staff: Staff[], evaluations: Evaluation[], cycle: EvaluationCycle | null | undefined): EvaluationCompletionStats {
  const cycleEvaluations = evaluations.filter((evaluation) => isEvaluationInCycle(evaluation, cycle));
  const completedStaffIds = getSelfSubmittedStaffIds(cycleEvaluations);
  const completedStaffEvaluations = cycleEvaluations.filter((evaluation) => completedStaffIds.has(evaluation.staff_id));
  const averageScore = average(
    completedStaffEvaluations
      .map((evaluation) => Number(evaluation.average_score))
      .filter((score) => Number.isFinite(score) && score > 0),
  );
  const missingRows = staff
    .filter((member) => !completedStaffIds.has(member.id))
    .map((member) => ({ staffId: member.id, staffName: member.name, evaluationType: "自己評価" as const, status: "未回答" as const }));

  return {
    cycleEvaluations,
    completedStaffIds,
    completedCount: staff.filter((member) => completedStaffIds.has(member.id)).length,
    targetStaffCount: staff.length,
    missingCount: missingRows.length,
    missingRows,
    completedStaffEvaluations,
    averageScore,
  };
}

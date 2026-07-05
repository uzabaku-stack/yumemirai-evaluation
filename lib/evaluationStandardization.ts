import type { Evaluation } from "./types";

export type StandardizationConfig = {
  evaluatorBiasWeight: number;
  maxEvaluatorAdjustment: number;
  maxDistanceFromClinicAverage: number;
  minScore: number;
  maxScore: number;
};

export type StandardizedEvaluation = {
  evaluationId: number;
  staffId: number;
  evaluatorKey: string;
  rawAverage: number;
  evaluatorAverage: number;
  evaluatorAdjustment: number;
  cappedRawAverage: number;
  standardizedScore: number;
};

export type StaffStandardizedScore = {
  staffId: number;
  rawAverage: number | null;
  standardizedScore: number | null;
  bonusScore: number | null;
  evaluationCount: number;
};

export type EvaluationStandardizationResult = {
  clinicAverage: number | null;
  config: StandardizationConfig;
  evaluatorAverages: Array<{ evaluatorKey: string; average: number; count: number; adjustment: number }>;
  evaluations: StandardizedEvaluation[];
  staffScores: StaffStandardizedScore[];
};

export const defaultStandardizationConfig: StandardizationConfig = {
  evaluatorBiasWeight: 0.5,
  maxEvaluatorAdjustment: 0.3,
  maxDistanceFromClinicAverage: 1.0,
  minScore: 1,
  maxScore: 5,
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function usableAverage(evaluation: Evaluation) {
  return Number.isFinite(evaluation.average_score) && evaluation.average_score > 0 ? evaluation.average_score : null;
}

export function evaluatorKeyForEvaluation(evaluation: Evaluation) {
  if (evaluation.evaluator_user_id !== null && evaluation.evaluator_user_id !== undefined) return "user:" + evaluation.evaluator_user_id;
  if (evaluation.evaluator_staff_id !== null && evaluation.evaluator_staff_id !== undefined) return "staff:" + evaluation.evaluator_staff_id;
  return "name:" + (evaluation.evaluator_name || "未設定");
}

export function calculateEvaluationStandardization(evaluations: Evaluation[], config: StandardizationConfig = defaultStandardizationConfig): EvaluationStandardizationResult {
  const usable = evaluations
    .map((evaluation) => ({ evaluation, rawAverage: usableAverage(evaluation) }))
    .filter((entry): entry is { evaluation: Evaluation; rawAverage: number } => entry.rawAverage !== null);
  const clinicAverage = average(usable.map((entry) => entry.rawAverage));
  if (clinicAverage === null) return { clinicAverage: null, config, evaluatorAverages: [], evaluations: [], staffScores: [] };

  const byEvaluator = new Map<string, number[]>();
  for (const entry of usable) {
    const key = evaluatorKeyForEvaluation(entry.evaluation);
    const values = byEvaluator.get(key) ?? [];
    values.push(entry.rawAverage);
    byEvaluator.set(key, values);
  }

  const evaluatorAverages = Array.from(byEvaluator.entries()).map(([evaluatorKey, values]) => {
    const evaluatorAverage = average(values) ?? clinicAverage;
    const adjustment = clamp((clinicAverage - evaluatorAverage) * config.evaluatorBiasWeight, -config.maxEvaluatorAdjustment, config.maxEvaluatorAdjustment);
    return { evaluatorKey, average: evaluatorAverage, count: values.length, adjustment };
  });
  const adjustmentByEvaluator = new Map(evaluatorAverages.map((item) => [item.evaluatorKey, item.adjustment]));
  const averageByEvaluator = new Map(evaluatorAverages.map((item) => [item.evaluatorKey, item.average]));

  const standardizedEvaluations = usable.map(({ evaluation, rawAverage }) => {
    const evaluatorKey = evaluatorKeyForEvaluation(evaluation);
    const cappedRawAverage = clamp(rawAverage, clinicAverage - config.maxDistanceFromClinicAverage, clinicAverage + config.maxDistanceFromClinicAverage);
    const evaluatorAdjustment = adjustmentByEvaluator.get(evaluatorKey) ?? 0;
    const standardizedScore = clamp(cappedRawAverage + evaluatorAdjustment, config.minScore, config.maxScore);
    return {
      evaluationId: evaluation.id,
      staffId: evaluation.staff_id,
      evaluatorKey,
      rawAverage,
      evaluatorAverage: averageByEvaluator.get(evaluatorKey) ?? clinicAverage,
      evaluatorAdjustment,
      cappedRawAverage,
      standardizedScore,
    };
  });

  const staffIds = Array.from(new Set(usable.map((entry) => entry.evaluation.staff_id))).sort((a, b) => a - b);
  const staffScores = staffIds.map((staffId) => {
    const rawValues = usable.filter((entry) => entry.evaluation.staff_id === staffId).map((entry) => entry.rawAverage);
    const adjustedValues = standardizedEvaluations.filter((entry) => entry.staffId === staffId).map((entry) => entry.standardizedScore);
    const rawAverage = average(rawValues);
    const standardizedScore = average(adjustedValues);
    return { staffId, rawAverage, standardizedScore, bonusScore: standardizedScore, evaluationCount: adjustedValues.length };
  });

  return { clinicAverage, config, evaluatorAverages, evaluations: standardizedEvaluations, staffScores };
}

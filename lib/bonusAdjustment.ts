export type BonusAdjustmentInput = {
  baseBonus: number;
  evaluationMultiplier: number;
  employmentMultiplier: number;
  workHoursMultiplier: number;
  attendanceMultiplier: number;
  individualAdjustmentAmount: number;
};

export type BonusAdjustmentBreakdown = {
  baseBonus: number;
  evaluationMultiplier: number;
  evaluationAdjustedBonus: number;
  overallMultiplier: number;
  employmentMultiplier: number;
  workHoursMultiplier: number;
  attendanceMultiplier: number;
  individualAdjustmentAmount: number;
  finalBonus: number;
};

export const evaluationStandardizationAdjustmentDescription = "3.5点を100%の基準とし、評価点0.1ごとに4%補正します。補正率は70〜140%の範囲です。";

function clampMultiplier(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(2, value));
}

export function calculateEvaluationStandardizationMultiplier(standardizedScore: number | null | undefined) {
  if (standardizedScore === null || standardizedScore === undefined || !Number.isFinite(standardizedScore)) return 1;
  const rawRate = 1 + (standardizedScore - 3.5) * 0.4;
  return Math.min(1.4, Math.max(0.7, rawRate));
}

export function ratePercentToMultiplier(ratePercent: number) {
  if (!Number.isFinite(ratePercent)) return 1;
  return clampMultiplier(ratePercent / 100);
}

export function calculateBonusAdjustment(input: BonusAdjustmentInput): BonusAdjustmentBreakdown {
  const baseBonus = Number.isFinite(input.baseBonus) ? input.baseBonus : 0;
  const evaluationMultiplier = clampMultiplier(input.evaluationMultiplier);
  const employmentMultiplier = clampMultiplier(input.employmentMultiplier);
  const workHoursMultiplier = clampMultiplier(input.workHoursMultiplier);
  const attendanceMultiplier = clampMultiplier(input.attendanceMultiplier);
  const individualAdjustmentAmount = Number.isFinite(input.individualAdjustmentAmount) ? input.individualAdjustmentAmount : 0;
  const evaluationAdjustedBonus = baseBonus * evaluationMultiplier;
  const overallMultiplier = employmentMultiplier * workHoursMultiplier * attendanceMultiplier;
  const finalBonus = evaluationAdjustedBonus * overallMultiplier + individualAdjustmentAmount;

  return {
    baseBonus,
    evaluationMultiplier,
    evaluationAdjustedBonus,
    overallMultiplier,
    employmentMultiplier,
    workHoursMultiplier,
    attendanceMultiplier,
    individualAdjustmentAmount,
    finalBonus,
  };
}

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

function clampMultiplier(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(2, value));
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

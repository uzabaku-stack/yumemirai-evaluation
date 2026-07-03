import type { EvaluationItem, EvaluationScore, RatingCriterion } from "./types";

export const defaultRatingCriteria = [
  {
    "score": 1,
    "label": "できていない",
    "description": "業務として任せられない\n毎回の指示や確認が必要\n理解や実施に大きな課題がある",
    "criterion_order": 1
  },
  {
    "score": 2,
    "label": "一部できるが不安定",
    "description": "基本的な理解はあるが、抜けやミスがある\n一人で任せるには確認が必要\n継続的な指導が必要",
    "criterion_order": 2
  },
  {
    "score": 3,
    "label": "標準レベル",
    "description": "基本的には一人で実施できる\n大きな問題なく業務を行える\n医院の標準として求める水準",
    "criterion_order": 3
  },
  {
    "score": 4,
    "label": "良好",
    "description": "安定して実施できる\n周囲にも良い影響がある\n状況に応じた判断や配慮ができる",
    "criterion_order": 4
  },
  {
    "score": 5,
    "label": "非常に優れている",
    "description": "高い水準で安定して実施できる\n後輩への指導や改善提案ができる\n医院全体に貢献している",
    "criterion_order": 5
  }
] satisfies RatingCriterion[];

export const ratingCriteria = defaultRatingCriteria;
export const ratingLabels = defaultRatingCriteria.map((item) => item.label);
export function formatRatingCriteria(criteria: RatingCriterion[]) {
  return [...criteria]
    .sort((a, b) => a.criterion_order - b.criterion_order || a.score - b.score)
    .map((item) => String(item.score) + "点：" + item.label + "\n" + item.description.split(/\r?\n/).filter(Boolean).map((line) => "・" + line).join("\n"))
    .join("\n\n");
}
export const ratingCriteriaText = formatRatingCriteria(defaultRatingCriteria);
export const commentFields = ["評価者所見", "強み", "課題", "期待すること", "今後追加してほしい評価項目", "本人コメント", "自己評価", "反省点", "来期目標"];
export function rankForAverage(average: number) { if (average >= 4.3) return "A"; if (average >= 3.6) return "B"; if (average >= 3.0) return "C"; return "D"; }
export function calculateSummary(items: EvaluationItem[], scores: EvaluationScore[]) {
  const byItem = new Map(scores.map((score) => [score.item_id, score.score ?? 1]));
  const sections = new Map<string, { total: number; count: number }>();
  const excluded = new Set(scores.filter((score) => score.not_applicable).map((score) => score.item_id));
  for (const item of items) { if (excluded.has(item.id)) continue; const value = byItem.get(item.id) ?? 1; const current = sections.get(item.section_name) ?? { total: 0, count: 0 }; current.total += value; current.count += 1; sections.set(item.section_name, current); }
  const sectionScores = Array.from(sections.entries()).map(([section, value]) => ({ section, total: value.total, max: value.count * 5, average: value.count ? value.total / value.count : 0, count: value.count }));
  const totalScore = sectionScores.reduce((sum, section) => sum + section.total, 0);
  const scoredItemCount = sectionScores.reduce((sum, section) => sum + section.count, 0);
  const maxScore = scoredItemCount * 5;
  const averageScore = scoredItemCount ? totalScore / scoredItemCount : 0;
  return { totalScore, maxScore, averageScore, rank: rankForAverage(averageScore), sectionScores };
}
export function parseComments(raw: string | null | undefined) { if (!raw) return {} as Record<string, string>; try { return JSON.parse(raw) as Record<string, string>; } catch { return {} as Record<string, string>; } }

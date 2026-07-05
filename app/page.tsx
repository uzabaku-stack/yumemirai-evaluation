import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, CalendarCheck, ChevronRight, CircleDollarSign, ClipboardList, Settings, Sparkles, UserCheck, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEvaluationCycle, getEvaluationCycles, getEvaluations, getStaffList } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";
import type { Evaluation, EvaluationCycle } from "@/lib/types";

type DirectorCard = {
  title: string;
  description: string;
  href: string;
  icon: typeof Users;
  accent?: boolean;
};

const directorCards: DirectorCard[] = [
  {
    title: "スタッフ管理",
    description: "スタッフ情報を管理します。",
    href: "/staff",
    icon: Users,
  },
  {
    title: "評価管理",
    description: "院長評価・360°評価・回答状況を管理します。",
    href: "/director-evaluation",
    icon: ClipboardList,
    accent: true,
  },
  {
    title: "評価結果",
    description: "スタッフごとの評価結果・履歴・削除を管理します。",
    href: "/360/results",
    icon: UserCheck,
  },
  {
    title: "賞与計算",
    description: "評価から賞与を自動計算します。",
    href: "/bonus",
    icon: CircleDollarSign,
  },
  {
    title: "集計分析",
    description: "全体傾向・項目別分析・ランキングを確認します。",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    title: "設定",
    description: "評価項目や各種設定を管理します。",
    href: "/evaluation-items",
    icon: Settings,
  },
];

const staffCards = [
  {
    title: "360°評価を開始",
    description: "自己評価と他スタッフへの評価をまとめて入力します。",
    href: "/360",
    icon: Sparkles,
    accent: true,
  },
  {
    title: "自分が入力した評価を編集",
    description: "過去に自分が入力した評価だけを確認・編集します。",
    href: "/my-evaluations",
    icon: CalendarCheck,
  },
];

type BonusCalculationStatus = "未実施" | "計算中" | "確定済み";

type EvaluationDashboardStats = {
  cycleName: string;
  missingCount: number;
  completedCount: number;
  targetStaffCount: number;
  averageScore: number | null;
  bonusStatus: BonusCalculationStatus;
};

function isEvaluationInCycle(evaluation: Evaluation, cycle: EvaluationCycle | null) {
  if (!cycle) return true;
  if (evaluation.evaluation_cycle_id) return evaluation.evaluation_cycle_id === cycle.id;
  const cycleMonth = cycle.startDate.slice(0, 7);
  return evaluation.evaluation_month === cycleMonth;
}

function getAverageScore(evaluations: Evaluation[]) {
  const values = evaluations
    .map((evaluation) => Number(evaluation.average_score))
    .filter((score) => Number.isFinite(score) && score > 0);

  if (values.length === 0) return null;
  return values.reduce((sum, score) => sum + score, 0) / values.length;
}

function getBonusCalculationStatus(completedCount: number, targetStaffCount: number): BonusCalculationStatus {
  if (targetStaffCount > 0 && completedCount >= targetStaffCount) return "計算中";
  return "未実施";
}

function getEvaluationDashboardStats(): EvaluationDashboardStats {
  const staff = getStaffList();
  const cycles = getEvaluationCycles();
  const selectedCycle = getActiveEvaluationCycle() ?? cycles[0] ?? null;
  const cycleEvaluations = getEvaluations().filter((evaluation) => isEvaluationInCycle(evaluation, selectedCycle));
  const completedStaffIds = new Set(
    cycleEvaluations
      .filter((evaluation) => Number.isFinite(Number(evaluation.average_score)) && Number(evaluation.average_score) > 0)
      .map((evaluation) => evaluation.staff_id),
  );
  const targetStaffCount = staff.length;
  const completedCount = staff.filter((member) => completedStaffIds.has(member.id)).length;

  return {
    cycleName: selectedCycle?.name ?? "評価期間未設定",
    missingCount: Math.max(targetStaffCount - completedCount, 0),
    completedCount,
    targetStaffCount,
    averageScore: getAverageScore(cycleEvaluations),
    bonusStatus: getBonusCalculationStatus(completedCount, targetStaffCount),
  };
}

function EvaluationStatusDashboard({ stats }: { stats: EvaluationDashboardStats }) {
  const statItems = [
    { label: "評価期間", value: stats.cycleName },
    { label: "未回答", value: `${stats.missingCount}名` },
    { label: "評価完了", value: `${stats.completedCount} / ${stats.targetStaffCount}名` },
    { label: "平均評価", value: stats.averageScore === null ? "-" : stats.averageScore.toFixed(2) },
    { label: "賞与計算", value: stats.bonusStatus },
  ];

  return (
    <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-clinic">評価状況ダッシュボード</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">現在の評価状況</h2>
        </div>
        <span className="w-fit rounded-full bg-mint px-4 py-2 text-sm font-bold text-clinic">
          {stats.bonusStatus}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statItems.map((item) => (
          <div key={item.label} className="rounded border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
function DirectorHome() {
  const dashboardStats = getEvaluationDashboardStats();

  return (
    <div className="space-y-6">
      <section className="rounded border border-teal-900/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-bold text-clinic">院長ホーム</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">院長ダッシュボード</h1>
        <p className="mt-2 text-slate-600">業務評価・賞与計算・分析をここから管理します。</p>
      </section>

      <EvaluationStatusDashboard stats={dashboardStats} />

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {directorCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className={(card.accent ? "border-clinic/30 bg-mint/70" : "border-teal-900/10 bg-white") + " group block min-h-56 rounded border p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-clinic focus:ring-offset-2"}
            >
              <div className="flex items-start justify-between gap-4">
                <div className={(card.accent ? "bg-clinic text-white" : "bg-slate-100 text-clinic") + " grid h-14 w-14 shrink-0 place-items-center rounded"}>
                  <Icon size={28} />
                </div>
                <ChevronRight className="mt-3 text-slate-400 transition group-hover:translate-x-1 group-hover:text-clinic" />
              </div>
              <h2 className="mt-6 text-2xl font-bold text-ink">{card.title}</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{card.description}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function StaffHome() {
  return (
    <div className="space-y-6">
      <section className="rounded border border-teal-900/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-bold text-clinic">スタッフホーム</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">評価入力</h1>
        <p className="mt-2 text-slate-600">スタッフ画面では、360°評価の入力と自分が入力した評価の編集だけを行えます。</p>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {staffCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className={(card.accent ? "bg-clinic text-white" : "border border-teal-900/10 bg-white text-ink") + " flex min-h-44 items-start gap-4 rounded p-7 shadow-soft"}>
              <Icon size={32} className={card.accent ? "text-white" : "text-clinic"} />
              <span>
                <span className="block text-2xl font-bold">{card.title}</span>
                <span className={(card.accent ? "text-white/90" : "text-slate-600") + " mt-2 block text-sm leading-6"}>{card.description}</span>
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return isDirectorRole(user.role) ? <DirectorHome /> : <StaffHome />;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, CalendarCheck, ChevronRight, CircleDollarSign, ClipboardList, Settings, Sparkles, UserCheck, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isDirectorRole } from "@/lib/permissions";

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

function DirectorHome() {
  return (
    <div className="space-y-6">
      <section className="rounded border border-teal-900/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-bold text-clinic">院長ホーム</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">院長ダッシュボード</h1>
        <p className="mt-2 text-slate-600">業務評価・賞与計算・分析をここから管理します。</p>
      </section>

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

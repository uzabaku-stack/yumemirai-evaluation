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
  links?: { label: string; href: string }[];
};

const directorCards: DirectorCard[] = [
  {
    title: "スタッフ管理",
    description: "スタッフの登録・編集・職種・権限とパスワードを管理します。",
    href: "/staff",
    icon: Users,
    links: [{ label: "スタッフ一覧", href: "/staff" }],
  },
  {
    title: "評価管理",
    description: "院長評価入力、360°評価、回答状況の確認をまとめて行います。",
    href: "/360",
    icon: ClipboardList,
    accent: true,
    links: [
      { label: "360°評価", href: "/360" },
      { label: "院長評価", href: "/director-evaluation" },
      { label: "評価回管理", href: "/evaluation-cycles" },
    ],
  },
  {
    title: "評価結果",
    description: "評価一覧、院長コメント、評価履歴、詳細確認を見ます。",
    href: "/360/results",
    icon: UserCheck,
    links: [
      { label: "結果一覧", href: "/360/results" },
      { label: "評価履歴", href: "/evaluation-history" },
    ],
  },
  {
    title: "賞与計算",
    description: "評価標準化と総合補正を反映して賞与目安を計算します。",
    href: "/bonus",
    icon: CircleDollarSign,
    links: [{ label: "賞与計算", href: "/bonus" }],
  },
  {
    title: "集計分析",
    description: "評価傾向、ランキング、セクション別の分析を確認します。",
    href: "/360/results",
    icon: BarChart3,
    links: [{ label: "分析を見る", href: "/360/results" }],
  },
  {
    title: "設定",
    description: "評価項目、評価基準、院長設定などシステム全体を整えます。",
    href: "/evaluation-items",
    icon: Settings,
    links: [
      { label: "評価項目", href: "/evaluation-items" },
      { label: "評価基準", href: "/rating-criteria" },
      { label: "院長設定", href: "/settings" },
    ],
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
        <h1 className="mt-2 text-3xl font-bold text-ink">やりたいことから選ぶ</h1>
        <p className="mt-2 text-slate-600">よく使う操作を6つに整理しました。管理、入力、確認、分析、設定をここから迷わず始められます。</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {directorCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className={(card.accent ? "border-clinic/30 bg-mint/70" : "border-teal-900/10 bg-white") + " rounded border p-5 shadow-soft"}>
              <Link href={card.href} className="group block rounded focus:outline-none focus:ring-2 focus:ring-clinic focus:ring-offset-2">
                <div className="flex items-start justify-between gap-4">
                  <div className={(card.accent ? "bg-clinic text-white" : "bg-slate-100 text-clinic") + " grid h-14 w-14 shrink-0 place-items-center rounded"}>
                    <Icon size={28} />
                  </div>
                  <ChevronRight className="mt-3 text-slate-400 transition group-hover:translate-x-1 group-hover:text-clinic" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-ink">{card.title}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{card.description}</p>
              </Link>
              {card.links?.length ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  {card.links.map((link) => (
                    <Link key={link.href + link.label} href={link.href} className="rounded border border-clinic/20 bg-white px-3 py-2 text-sm font-bold text-clinic hover:bg-mint">
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { DirectorPasswordForm } from "@/components/DirectorPasswordForm";
import { getCurrentUser } from "@/lib/auth";
import { isDirectorRole } from "@/lib/permissions";

const settingLinks = [
  {
    title: "評価項目管理",
    description: "評価項目、説明文、対象職種、表示状態を管理します。",
    href: "/evaluation-items",
  },
  {
    title: "評価基準設定",
    description: "1点から5点までの全体評価基準を編集します。",
    href: "/rating-criteria",
  },
  {
    title: "評価期間管理",
    description: "評価回の作成、編集、状態変更を管理します。",
    href: "/evaluation-cycles",
  },
];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">院長設定</h1>
          <p className="mt-2 text-slate-600">院長アカウントと各種設定を管理します。</p>
        </div>
        <Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">
          トップへ戻る
        </Link>
      </div>

      <DirectorPasswordForm />

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">各種設定</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {settingLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex min-h-32 items-start justify-between gap-3 rounded border border-slate-200 bg-slate-50 p-4 transition hover:border-clinic hover:bg-mint"
            >
              <span>
                <span className="block text-lg font-bold text-ink">{link.title}</span>
                <span className="mt-2 block text-sm leading-6 text-slate-600">{link.description}</span>
              </span>
              <ChevronRight className="mt-1 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-clinic" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

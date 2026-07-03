import Link from "next/link";
import { redirect } from "next/navigation";
import { EvaluationCycleManager } from "@/components/EvaluationCycleManager";
import { getCurrentUser } from "@/lib/auth";
import { getEvaluationCycles } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export default async function EvaluationCyclesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">評価回管理</h1>
        <p className="mt-2 text-slate-600">夏評価・冬評価など、評価期間ごとの履歴を管理します。</p>
      </div>
      <Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link>
    </div>
    <EvaluationCycleManager initialCycles={getEvaluationCycles()} />
  </div>;
}

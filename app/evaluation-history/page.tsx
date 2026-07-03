import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getAllStaffList, getStaffEvaluationHistory } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

function fmt(value: number | null) { return value === null ? "-" : value.toFixed(2); }
function period(row: { cycle: { startDate: string; endDate: string } }) { return row.cycle.startDate + " 〜 " + row.cycle.endDate; }

export default async function EvaluationHistoryPage({ searchParams }: { searchParams?: Promise<{ staffId?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = searchParams ? await searchParams : {};
  const isDirector = isDirectorRole(user.role);
  const staffList = isDirector ? getAllStaffList() : [];
  const staffId = isDirector ? Number(query.staffId || staffList[0]?.id) : Number(user.staff_id);
  if (!staffId) redirect("/");
  const histories = getStaffEvaluationHistory(staffId);
  const staff = isDirector ? staffList.find((item) => item.id === staffId) : null;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">評価履歴</h1>
        <p className="mt-2 text-slate-600">評価回ごとの成長の記録を確認できます。</p>
      </div>
      <Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link>
    </div>
    {isDirector ? <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
      <h2 className="text-xl font-bold">スタッフ選択</h2>
      <div className="mt-3 flex flex-wrap gap-2">{staffList.map((person) => <Link key={person.id} href={"/evaluation-history?staffId=" + person.id} className={(person.id === staffId ? "bg-clinic text-white" : "border border-clinic text-clinic") + " rounded px-4 py-3 font-bold"}>{person.name}</Link>)}</div>
    </section> : null}
    <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-2"><History className="text-clinic" /><h2 className="text-xl font-bold">{isDirector ? (staff?.name ?? "スタッフ") : "自分"}の評価履歴</h2></div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead><tr className="border-b text-sm text-slate-500"><th className="py-3">評価回名</th><th>評価期間</th><th>総合平均</th><th>テーマ別平均</th><th>コメント</th><th>詳細</th></tr></thead>
          <tbody>{histories.length ? histories.map((row) => <tr key={row.cycle.id} className="border-b last:border-0 align-top"><td className="py-4 font-bold">{row.cycle.name}</td><td>{period(row)}</td><td className="text-lg font-bold text-clinic">{fmt(row.overall_average)}</td><td><div className="flex flex-wrap gap-2">{row.themes.map((theme) => <span key={theme.theme} className="rounded bg-slate-100 px-3 py-1 text-sm">{theme.theme}: {fmt(theme.average)}</span>)}</div></td><td>{row.comment_exists ? "あり" : "なし"}</td><td><Link href={"/evaluation-history/" + row.cycle.id + (isDirector ? "?staffId=" + staffId : "")} className="rounded bg-clinic px-4 py-3 font-bold text-white">詳細を見る</Link></td></tr>) : <tr><td colSpan={6} className="py-8 text-center text-slate-500">評価履歴はまだありません。</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

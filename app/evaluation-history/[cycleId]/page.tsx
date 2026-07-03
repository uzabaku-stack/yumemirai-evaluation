import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeRadarChart } from "@/components/ThemeRadarChart";
import { getCurrentUser } from "@/lib/auth";
import { getStaffEvaluationHistoryDetail } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";
import { parseComments } from "@/lib/scoring";

function fmt(value: number | null) { return value === null ? "-" : value.toFixed(2); }
function visibleComments(raw: string) { return Object.entries(parseComments(raw)).filter(([, value]) => String(value ?? "").trim()); }

export default async function EvaluationHistoryDetailPage({ params, searchParams }: { params: Promise<{ cycleId: string }>; searchParams?: Promise<{ staffId?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { cycleId } = await params;
  const query = searchParams ? await searchParams : {};
  const isDirector = isDirectorRole(user.role);
  const staffId = isDirector ? Number(query.staffId) : Number(user.staff_id);
  if (!staffId) redirect("/evaluation-history");
  const detail = getStaffEvaluationHistoryDetail(staffId, Number(cycleId));
  if (!detail) redirect("/evaluation-history");
  const comments = visibleComments(detail.self_comments);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">{detail.cycle.name}</h1>
        <p className="mt-2 text-slate-600">{detail.staff.name} / {detail.cycle.startDate} 〜 {detail.cycle.endDate}</p>
      </div>
      <Link href={"/evaluation-history" + (isDirector ? "?staffId=" + staffId : "")} className="rounded border border-clinic px-5 py-4 font-bold text-clinic">履歴へ戻る</Link>
    </div>
    <section className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">レーダーチャート</h2><ThemeRadarChart themes={detail.themes.map((item) => item.theme)} series={[{ label: "平均", color: "#0f766e", values: detail.themes }]} /></div>
      <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">テーマ別平均</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{detail.themes.map((theme) => <div key={theme.theme} className="rounded border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><span className="font-bold">{theme.theme}</span><span className="text-2xl font-bold text-clinic">{fmt(theme.average)}</span></div></div>)}</div></div>
    </section>
    <section className="grid gap-5 md:grid-cols-2"><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">強みTOP3</h2><div className="mt-3 space-y-2">{detail.strengths.map((item, index) => <div key={item.theme} className="flex items-center justify-between rounded bg-mint px-4 py-3"><span className="font-bold">{index + 1}. {item.theme}</span><span className="text-xl font-bold text-clinic">{fmt(item.average)}</span></div>)}</div></div><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">改善テーマTOP3</h2><div className="mt-3 space-y-2">{detail.improvements.map((item, index) => <div key={item.theme} className="flex items-center justify-between rounded bg-slate-50 px-4 py-3"><span className="font-bold">{index + 1}. {item.theme}</span><span className="text-xl font-bold text-clinic">{fmt(item.average)}</span></div>)}</div></div></section>
    <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">項目別平均</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b text-sm text-slate-500"><th className="py-3">評価項目</th><th>セクション</th><th>平均</th><th>件数</th></tr></thead><tbody>{detail.item_averages.length ? detail.item_averages.map((item) => <tr key={item.item_id} className="border-b last:border-0"><td className="py-3 font-bold">{item.item_name}</td><td>{item.section_name}</td><td className="text-lg font-bold text-clinic">{fmt(item.average)}</td><td>{item.count}</td></tr>) : <tr><td colSpan={4} className="py-8 text-center text-slate-500">項目別平均はまだありません。</td></tr>}</tbody></table></div></section>
    <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">コメント</h2>{comments.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{comments.map(([key, value]) => <div key={key} className="rounded border border-slate-200 p-4"><div className="font-bold text-clinic">{key}</div><p className="mt-2 whitespace-pre-wrap text-slate-700">{String(value)}</p></div>)}</div> : <p className="mt-3 text-slate-500">コメントはありません。</p>}</section>
  </div>;
}

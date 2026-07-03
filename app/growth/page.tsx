import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getStaffGrowthSummary } from "@/lib/db";
import { parseComments } from "@/lib/scoring";
import { ThemeRadarChart } from "@/components/ThemeRadarChart";
import { PrintButton } from "@/components/PrintButton";
import { isDirectorRole } from "@/lib/permissions";

const medal = ["1", "2", "3"];
const selfCommentFields = ["本人コメント", "自己評価（振り返り）", "反省点", "来期目標"];

function fmt(value: number | null | undefined) { return value === null || value === undefined ? "-" : value.toFixed(2); }
function barWidth(value: number | null | undefined) { return String(Math.max(0, Math.min(100, ((value ?? 0) / 5) * 100))) + "%"; }

export default async function GrowthPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isDirectorRole(user.role)) redirect("/360/results");
  if (!user.staff_id) redirect("/");
  const summary = getStaffGrowthSummary(user.staff_id);
  if (!summary) redirect("/");
  const themes = summary.themes.map((item) => item.theme);
  const comments = parseComments(summary.self_comments);
  return <div className="print-page space-y-6"><div className="no-print flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">成長の見える化</h1><p className="mt-1 text-slate-600">評価者別の点数や比較は表示せず、評価シートのセクション別平均だけを表示します。</p></div><div className="flex flex-wrap gap-2"><PrintButton /><Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link></div></div><section className="print-section rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4"><div><h1 className="text-2xl font-bold">評価面談資料</h1><p className="mt-1 text-sm text-slate-600">スタッフ用サマリー</p></div><div className="grid gap-2 text-sm sm:grid-cols-2"><div>氏名: <b>{summary.staff.name}</b></div><div>評価期間: <b>{summary.month}</b></div></div></div><div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><div><h2 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="text-clinic" />セクション別レーダーチャート</h2><p className="mt-1 text-sm text-slate-600">表示しているのは、全評価をまとめたセクション別平均の1本のみです。</p><ThemeRadarChart themes={themes} series={[{ label: "平均", color: "#0f766e", values: summary.themes }]} /></div><div className="rounded bg-mint p-5"><h2 className="text-xl font-bold">テーマ別平均</h2><div className="mt-4 space-y-4">{summary.themes.map((item) => <div key={item.theme}><div className="flex items-center justify-between gap-3"><span className="font-bold">{item.theme}</span><span className="text-lg font-bold text-clinic">{fmt(item.average)}</span></div><div className="mt-2 h-3 overflow-hidden rounded bg-white"><div className="h-full bg-clinic" style={{ width: barWidth(item.average) }} /></div></div>)}</div></div></div></section><section className="print-section grid gap-5 md:grid-cols-2"><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">強みTOP3</h2><div className="mt-4 space-y-3">{summary.strengths.map((item, index) => <div key={item.theme} className="rounded bg-mint p-4"><div className="text-sm font-bold text-clinic">{medal[index]}位</div><div className="mt-1 flex items-center justify-between gap-3"><span className="text-lg font-bold">{item.theme}</span><span className="text-2xl font-bold text-clinic">{fmt(item.average)}</span></div></div>)}</div></div><div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">改善テーマTOP3</h2><div className="mt-4 space-y-3">{summary.improvements.map((item, index) => <div key={item.theme} className="rounded border border-slate-200 p-4"><div className="text-sm font-bold text-slate-500">{index + 1}位</div><div className="mt-1 flex items-center justify-between gap-3"><span className="text-lg font-bold">{item.theme}</span><span className="text-2xl font-bold text-ink">{fmt(item.average)}</span></div></div>)}</div></div></section><section className="print-section rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">コメント</h2><p className="mt-1 text-sm text-slate-600">自分が入力した自己評価コメントのみを表示します。</p><div className="mt-4 grid gap-4 md:grid-cols-2">{selfCommentFields.map((field) => <div key={field} className="rounded border border-slate-200 p-4"><div className="font-bold text-clinic">{field}</div><p className="mt-2 whitespace-pre-wrap text-slate-700">{comments[field] || "-"}</p></div>)}</div></section></div>;
}

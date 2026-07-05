import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, CalendarDays, ClipboardList, FileText, History, KeyRound, Settings, UserCheck, Users, Edit3 as Edit3Icon, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getEvaluationCycles, getEvaluations, getStaffList } from "@/lib/db";
import { EvaluationResultsTable } from "@/components/EvaluationResultsTable";
import { StatCard } from "@/components/StatCard";
import { isDirectorRole } from "@/lib/permissions";
import type { Evaluation, EvaluationCycle, Staff } from "@/lib/types";

type SubmissionRow = {
  staff: Staff;
  selfSubmitted: boolean;
  peerSubmitted: boolean;
  directorSubmitted: boolean;
  lastUpdated: string | null;
};

type SubmissionCycle = {
  cycle: EvaluationCycle;
  rows: SubmissionRow[];
  missingSelf: Staff[];
  missingPeer: Staff[];
  missingDirector: Staff[];
  submittedCount: number;
  totalCount: number;
  submissionRate: number;
};

function dateLabel(value: string | null) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

function statusBadge(done: boolean, doneLabel: string, missingLabel: string) {
  return <span className={(done ? "bg-mint text-clinic" : "bg-red-50 text-red-700") + " inline-flex min-h-9 items-center rounded px-3 py-2 text-sm font-bold"}>{done ? doneLabel : missingLabel}</span>;
}

function evaluationInCycle(evaluation: Evaluation, cycle: EvaluationCycle) {
  if (evaluation.evaluation_cycle_id !== null && evaluation.evaluation_cycle_id !== undefined) return evaluation.evaluation_cycle_id === cycle.id;
  const month = cycle.startDate.slice(0, 7);
  return evaluation.evaluation_month === month;
}

function buildSubmissionStatus(staff: Staff[], evaluations: Evaluation[], cycles: EvaluationCycle[]): SubmissionCycle[] {
  return cycles.map((cycle) => {
    const cycleEvaluations = evaluations.filter((evaluation) => evaluationInCycle(evaluation, cycle));
    const rows = staff.map((person) => {
      const asTarget = cycleEvaluations.filter((evaluation) => evaluation.staff_id === person.id);
      const asEvaluator = cycleEvaluations.filter((evaluation) => evaluation.is_360 === 1 && (evaluation.evaluator_staff_id === person.id || (!evaluation.evaluator_staff_id && evaluation.evaluator_name === person.name)));
      const selfSubmitted = asTarget.some((evaluation) => evaluation.evaluation_type === "self");
      const peerSubmitted = asEvaluator.some((evaluation) => evaluation.evaluation_type === "peer" || (evaluation.evaluation_type === "self" && evaluation.staff_id === person.id));
      const directorSubmitted = asTarget.some((evaluation) => evaluation.evaluation_type === "director");
      const lastUpdated = [...asTarget, ...asEvaluator].map((evaluation) => evaluation.updated_at || evaluation.created_at).filter(Boolean).sort((a, b) => b.localeCompare(a))[0] ?? null;
      return { staff: person, selfSubmitted, peerSubmitted, directorSubmitted, lastUpdated };
    });
    const submittedCount = rows.reduce((count, row) => count + (row.selfSubmitted ? 1 : 0) + (row.peerSubmitted ? 1 : 0) + (row.directorSubmitted ? 1 : 0), 0);
    const totalCount = rows.length * 3;
    return {
      cycle,
      rows,
      missingSelf: rows.filter((row) => !row.selfSubmitted).map((row) => row.staff),
      missingPeer: rows.filter((row) => !row.peerSubmitted).map((row) => row.staff),
      missingDirector: rows.filter((row) => !row.directorSubmitted).map((row) => row.staff),
      submittedCount,
      totalCount,
      submissionRate: totalCount ? submittedCount / totalCount : 0,
    };
  });
}

function missingNames(items: Staff[]) {
  return items.length ? items.map((staff) => staff.name).join("、") : "なし";
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ deleted?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = searchParams ? await searchParams : {};
  const isDirector = isDirectorRole(user.role);
  const staff = isDirector ? getStaffList() : [];
  const allEvaluations = isDirector ? getEvaluations() : [];
  const evaluations = allEvaluations.slice(0, 50);
  const cycles = isDirector ? getEvaluationCycles() : [];
  const submissionStatus = isDirector ? buildSubmissionStatus(staff, allEvaluations, cycles).slice(0, 4) : [];

  if (!isDirector) {
    return <div className="space-y-6"><section className="rounded border border-teal-900/10 bg-white p-6 shadow-soft"><h1 className="text-3xl font-bold">スタッフ画面</h1><p className="mt-2 text-slate-600">360°評価の入力と、自分が入力した評価の編集を行います。</p></section><section className="grid gap-4 md:grid-cols-3"><Link href="/360" className="flex min-h-40 items-center gap-4 rounded bg-clinic p-7 text-xl font-bold text-white shadow-soft"><UserCheck size={30} />360°評価を開始</Link><Link href="/my-evaluations" className="flex min-h-40 items-center gap-4 rounded border border-teal-900/10 bg-white p-7 text-xl font-bold shadow-soft"><Edit3Icon />自分が入力した評価を編集</Link><Link href="/growth" className="flex min-h-40 items-center gap-4 rounded border border-teal-900/10 bg-white p-7 text-xl font-bold shadow-soft"><Sparkles />成長サマリーを見る</Link><Link href="/evaluation-history" className="flex min-h-40 items-center gap-4 rounded border border-teal-900/10 bg-white p-7 text-xl font-bold shadow-soft"><History />評価履歴</Link></section></div>;
  }

  return <div className="space-y-6">{query.deleted === "1" ? <div className="rounded border border-teal-200 bg-mint px-5 py-4 font-bold text-clinic shadow-soft">評価を削除しました。</div> : null}<section className="rounded border border-teal-900/10 bg-white p-6 shadow-soft"><h1 className="text-3xl font-bold">院長画面</h1><p className="mt-2 text-slate-600">スタッフ管理、評価入力、結果確認、集計分析を行います。</p></section><section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6"><Link href="/staff" className="flex min-h-32 items-center gap-4 rounded border border-teal-900/10 bg-white p-6 text-lg font-bold shadow-soft"><Users />スタッフ管理</Link><Link href="/evaluation-cycles" className="flex min-h-32 items-center gap-4 rounded border border-teal-900/10 bg-white p-6 text-lg font-bold shadow-soft"><CalendarDays />評価回管理</Link><Link href="/settings" className="flex min-h-32 items-center gap-4 rounded border border-teal-900/10 bg-white p-6 text-lg font-bold shadow-soft"><KeyRound />院長設定</Link><Link href="/evaluation-items" className="flex min-h-32 items-center gap-4 rounded border border-teal-900/10 bg-white p-6 text-lg font-bold shadow-soft"><Settings />評価項目管理</Link><Link href="/360" className="flex min-h-32 items-center gap-4 rounded bg-clinic p-6 text-lg font-bold text-white shadow-soft"><ClipboardList />院長評価入力</Link><Link href="/360/results" className="flex min-h-32 items-center gap-4 rounded border border-teal-900/10 bg-white p-6 text-lg font-bold shadow-soft"><UserCheck />360°評価閲覧</Link><Link href="/director-evaluation" className="flex min-h-32 items-center gap-4 rounded border border-teal-900/10 bg-white p-6 text-lg font-bold shadow-soft"><FileText />院長評価コメント</Link><a href="#results" className="flex min-h-32 items-center gap-4 rounded border border-teal-900/10 bg-white p-6 text-lg font-bold shadow-soft"><FileText />評価結果一覧</a><Link href="/360/results" className="flex min-h-32 items-center gap-4 rounded border border-teal-900/10 bg-white p-6 text-lg font-bold shadow-soft"><BarChart3 />集計分析</Link><Link href="/evaluation-history" className="flex min-h-32 items-center gap-4 rounded border border-teal-900/10 bg-white p-6 text-lg font-bold shadow-soft"><History />評価履歴</Link></section><section className="grid gap-4 md:grid-cols-3"><StatCard label="登録スタッフ" value={String(staff.length)} /><StatCard label="表示中の評価" value={String(evaluations.length)} /><StatCard label="権限" value="院長" tone="accent" /></section><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">提出状況</h2><p className="mt-1 text-sm text-slate-600">評価期間ごとに、自己評価・360評価・院長評価の提出状況を確認できます。</p></div><Link href="/360/results" className="rounded border border-clinic px-5 py-3 font-bold text-clinic">集計分析を開く</Link></div><div className="mt-5 space-y-6">{submissionStatus.length ? submissionStatus.map((status) => <section key={status.cycle.id} className="rounded border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-xl font-bold">{status.cycle.name}</h3><p className="mt-1 text-sm text-slate-600">{status.cycle.startDate} 〜 {status.cycle.endDate}</p></div><div className="min-w-48"><div className="flex items-end justify-between gap-3"><span className="text-sm font-bold text-slate-500">提出率</span><span className="text-3xl font-bold text-clinic">{Math.round(status.submissionRate * 100)}%</span></div><div className="mt-2 h-3 overflow-hidden rounded bg-slate-100"><div className="h-full bg-clinic" style={{ width: String(Math.round(status.submissionRate * 100)) + "%" }} /></div><p className="mt-1 text-xs text-slate-500">{status.submittedCount} / {status.totalCount}</p></div></div><div className="mt-4 grid gap-3 lg:grid-cols-3"><div className="rounded bg-slate-50 p-3 text-sm"><b className="text-ink">自己評価 未提出</b><p className="mt-1 text-slate-600">{missingNames(status.missingSelf)}</p></div><div className="rounded bg-slate-50 p-3 text-sm"><b className="text-ink">360評価 未提出</b><p className="mt-1 text-slate-600">{missingNames(status.missingPeer)}</p></div><div className="rounded bg-slate-50 p-3 text-sm"><b className="text-ink">院長評価 未記載</b><p className="mt-1 text-slate-600">{missingNames(status.missingDirector)}</p></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead><tr className="border-b text-sm text-slate-500"><th className="py-3">スタッフ名</th><th>自己評価</th><th>360評価</th><th>院長評価</th><th>最終更新日時</th></tr></thead><tbody>{status.rows.map((row) => <tr key={row.staff.id} className="border-b last:border-0"><td className="py-3 font-bold">{row.staff.name}</td><td>{statusBadge(row.selfSubmitted, "提出済み", "未提出")}</td><td>{statusBadge(row.peerSubmitted, "提出済み", "未提出")}</td><td>{statusBadge(row.directorSubmitted, "記載済み", "未記載")}</td><td className="text-sm text-slate-600">{dateLabel(row.lastUpdated)}</td></tr>)}</tbody></table></div></section>) : <p className="rounded bg-slate-50 p-4 text-slate-600">評価期間がまだ登録されていません。</p>}</div></section><section id="results" className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">評価結果一覧</h2><p className="mt-1 text-sm text-slate-600">チェックした評価をまとめて削除できます。従来どおり1件ずつの削除も可能です。</p></div></div><EvaluationResultsTable evaluations={evaluations} /></section></div>;
}

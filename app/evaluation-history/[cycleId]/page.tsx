import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { EvaluationExportButtons, StaffEvaluationSheetButton, type StaffExportReport } from "@/components/EvaluationExportButtons";
import { ThemeRadarChart } from "@/components/ThemeRadarChart";
import { getCurrentUser } from "@/lib/auth";
import { getStaffEvaluationHistoryDetail } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";
import { parseComments } from "@/lib/scoring";
import type { Evaluation } from "@/lib/types";

function fmt(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
}

function visibleComments(raw: string) {
  return Object.entries(parseComments(raw)).filter(([, value]) => String(value ?? "").trim());
}

function commentText(raw: string) {
  return visibleComments(raw).map(([key, value]) => key + ": " + String(value)).join("\n");
}

function typeLabel(type: Evaluation["evaluation_type"]) {
  if (type === "self") return "自己評価";
  if (type === "peer") return "360°評価";
  if (type === "director") return "院長評価";
  return "その他評価";
}

function average(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function buildReport(detail: NonNullable<ReturnType<typeof getStaffEvaluationHistoryDetail>>): StaffExportReport {
  const selfAverage = average(detail.evaluations.filter((evaluation) => evaluation.evaluation_type === "self").map((evaluation) => evaluation.average_score));
  const peerAverage = average(detail.evaluations.filter((evaluation) => evaluation.evaluation_type === "peer").map((evaluation) => evaluation.average_score));
  const directorAverage = average(detail.evaluations.filter((evaluation) => evaluation.evaluation_type === "director").map((evaluation) => evaluation.average_score));
  const directorEvaluation = [...detail.evaluations].filter((evaluation) => evaluation.evaluation_type === "director").sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0];
  return {
    staffId: detail.staff.id,
    staffName: detail.staff.name,
    evaluationPeriod: detail.cycle.name,
    overallAverage: detail.overall_average,
    rank: 1,
    selfAverage,
    peerAverage,
    directorAverage,
    finalEvaluation: detail.overall_average,
    baseBonus: null,
    finalBonus: null,
    comments: detail.evaluations.map((evaluation) => commentText(evaluation.comments)).filter(Boolean).join("\n\n"),
    directorComment: directorEvaluation ? commentText(directorEvaluation.comments) : "",
    items: detail.item_averages.map((item) => ({
      itemId: item.item_id,
      sectionName: item.section_name,
      itemName: item.item_name,
      selfAverage: null,
      peerAverage: null,
      directorAverage: null,
      finalAverage: item.average,
    })),
  };
}

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
  const fileBaseName = "evaluation-history-" + detail.cycle.id + "-" + detail.staff.id;
  const report = buildReport(detail);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{detail.cycle.name}</h1>
          <p className="mt-2 text-slate-600">{detail.staff.name} / {detail.cycle.startDate} ～ {detail.cycle.endDate}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDirector ? <EvaluationExportButtons evaluations={detail.evaluations} fileBaseName={fileBaseName} /> : null}
          {isDirector ? <StaffEvaluationSheetButton report={report} fileBaseName={fileBaseName + "-sheet"} /> : null}
          <Link href={"/evaluation-history" + (isDirector ? "?staffId=" + staffId : "")} className="rounded border border-clinic px-5 py-4 font-bold text-clinic">履歴へ戻る</Link>
        </div>
      </div>

      {isDirector ? (
        <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold">過去帳票の再出力</h2>
          <p className="mt-1 text-sm text-slate-600">この評価回に保存されている評価データから、PDF・Excel評価シート・CSVを再生成します。</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {detail.evaluations.length ? detail.evaluations.map((evaluation) => (
              <Link key={evaluation.id} href={"/evaluations/" + evaluation.id + "/print"} target="_blank" className="inline-flex min-h-12 items-center gap-2 rounded border border-clinic bg-white px-4 py-3 font-bold text-clinic">
                <FileText size={18} />{typeLabel(evaluation.evaluation_type)} PDF出力（1人用）
              </Link>
            )) : <span className="rounded bg-slate-50 px-4 py-3 text-sm text-slate-500">再出力できる評価はまだありません。</span>}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold">レーダーチャート</h2>
          <ThemeRadarChart themes={detail.themes.map((item) => item.theme)} series={[{ label: "平均", color: "#0f766e", values: detail.themes }]} />
        </div>
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold">テーマ別平均</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {detail.themes.map((theme) => (
              <div key={theme.theme} className="rounded border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{theme.theme}</span>
                  <span className="text-2xl font-bold text-clinic">{fmt(theme.average)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold">強みTOP3</h2>
          <div className="mt-3 space-y-2">
            {detail.strengths.map((item, index) => <div key={item.theme} className="flex items-center justify-between rounded bg-mint px-4 py-3"><span className="font-bold">{index + 1}. {item.theme}</span><span className="text-xl font-bold text-clinic">{fmt(item.average)}</span></div>)}
          </div>
        </div>
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold">改善テーマTOP3</h2>
          <div className="mt-3 space-y-2">
            {detail.improvements.map((item, index) => <div key={item.theme} className="flex items-center justify-between rounded bg-slate-50 px-4 py-3"><span className="font-bold">{index + 1}. {item.theme}</span><span className="text-xl font-bold text-clinic">{fmt(item.average)}</span></div>)}
          </div>
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">項目別平均</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b text-sm text-slate-500">
                <th className="py-3">評価項目</th>
                <th>セクション</th>
                <th>平均</th>
                <th>件数</th>
              </tr>
            </thead>
            <tbody>
              {detail.item_averages.length ? detail.item_averages.map((item) => (
                <tr key={item.item_id} className="border-b last:border-0">
                  <td className="py-3 font-bold">{item.item_name}</td>
                  <td>{item.section_name}</td>
                  <td className="text-lg font-bold text-clinic">{fmt(item.average)}</td>
                  <td>{item.count}</td>
                </tr>
              )) : <tr><td colSpan={4} className="py-8 text-center text-slate-500">項目別平均はまだありません。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">コメント</h2>
        {comments.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{comments.map(([key, value]) => <div key={key} className="rounded border border-slate-200 p-4"><div className="font-bold text-clinic">{key}</div><p className="mt-2 whitespace-pre-wrap text-slate-700">{String(value)}</p></div>)}</div> : <p className="mt-3 text-slate-500">コメントはありません。</p>}
      </section>
    </div>
  );
}

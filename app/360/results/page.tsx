import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, History, MessageSquareText, UserCheck } from "lucide-react";
import { EvaluationResultsTable } from "@/components/EvaluationResultsTable";
import type { StaffExportReport } from "@/components/EvaluationExportButtons";
import { getCurrentUser } from "@/lib/auth";
import { get360SummaryForCycle, getEvaluationCycles, getEvaluations, getStaffList } from "@/lib/db";
import { getEvaluationCompletionStats } from "@/lib/evaluationCompletion";
import { isDirectorRole } from "@/lib/permissions";
import { parseComments } from "@/lib/scoring";

type Search = { cycleId?: string; staffId?: string };
type Summary = ReturnType<typeof get360SummaryForCycle>;
type StaffSummary = Summary["staff_summaries"][number];
type ItemBreakdown = StaffSummary["item_breakdown"][number];

function fmt(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toFixed(2);
}

function signed(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : (value > 0 ? "+" : "") + value.toFixed(2);
}

function average(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function visibleComments(raw: string) {
  return Object.entries(parseComments(raw)).filter(([key, value]) => key !== "__360_comment_meta" && typeof value === "string" && value.trim());
}

function commentText(raw: string) {
  return visibleComments(raw).map(([key, value]) => key + ": " + String(value)).join("\n");
}

function staffAverage(row: StaffSummary) {
  return average([row.self_average, row.peer_average, row.director_average]);
}

function hrefFor(params: Search, patch: Partial<Search>) {
  const next = new URLSearchParams();
  const merged = { ...params, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== "") next.set(key, String(value));
  }
  const query = next.toString();
  return "/360/results" + (query ? "?" + query : "");
}

function latestComment(row: StaffSummary) {
  for (const evaluation of [...row.evaluations].sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))) {
    const comments = visibleComments(evaluation.comments);
    if (comments.length) return { evaluation, comments };
  }
  return null;
}

function sortedItemBreakdown(items: ItemBreakdown[]) {
  return [...items].sort((a, b) => a.section_name.localeCompare(b.section_name, "ja") || a.item_order - b.item_order || a.item_name.localeCompare(b.item_name, "ja"));
}

function buildStaffReports(rows: StaffSummary[], periodName: string): StaffExportReport[] {
  const ranked = rows.map((row) => ({ row, overall: staffAverage(row) })).sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
  const rankByStaffId = new Map(ranked.map((entry, index) => [entry.row.staff.id, index + 1]));

  return rows.map((row) => {
    const directorEvaluation = [...row.evaluations]
      .filter((evaluation) => evaluation.evaluation_type === "director")
      .sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0];
    const comments = row.evaluations.map((evaluation) => commentText(evaluation.comments)).filter(Boolean).join("\n\n");
    return {
      staffId: row.staff.id,
      staffName: row.staff.name,
      evaluationPeriod: periodName,
      overallAverage: staffAverage(row),
      rank: rankByStaffId.get(row.staff.id) ?? 0,
      selfAverage: row.self_average,
      peerAverage: row.peer_average,
      directorAverage: row.director_average,
      finalEvaluation: staffAverage(row),
      baseBonus: null,
      finalBonus: null,
      comments,
      directorComment: directorEvaluation ? commentText(directorEvaluation.comments) : "",
      items: row.item_breakdown.map((item) => ({
        itemId: item.item_id,
        sectionName: item.section_name,
        itemName: item.item_name,
        selfAverage: item.self_average,
        peerAverage: item.peer_average,
        directorAverage: item.director_average,
        finalAverage: item.overall_average,
      })),
    };
  });
}

function ItemAnalysisTable({ items }: { items: ItemBreakdown[] }) {
  const rows = sortedItemBreakdown(items);
  const ranked = rows.filter((item) => item.overall_average !== null && Number.isFinite(item.overall_average));
  const strengths = [...ranked].sort((a, b) => (b.overall_average ?? 0) - (a.overall_average ?? 0)).slice(0, 3);
  const improvements = [...ranked].sort((a, b) => (a.overall_average ?? 0) - (b.overall_average ?? 0)).slice(0, 3);

  return (
    <section className="mt-5 rounded border border-teal-900/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-bold">評価項目ごとの分析</h4>
          <p className="mt-1 text-sm text-slate-600">
            自己評価・360°評価平均・院長評価・項目別平均に加えて、医院平均との差を表示します。
          </p>
        </div>
        <div className="text-sm font-bold text-clinic">項目数 {rows.length}件</div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded bg-mint p-4">
          <div className="font-bold text-clinic">強みTOP3</div>
          <div className="mt-3 space-y-2">
            {strengths.length ? strengths.map((item, index) => (
              <div key={item.item_id} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2">
                <span className="font-bold">{index + 1}. {item.item_name}</span>
                <span className="text-lg font-bold text-clinic">{fmt(item.overall_average)}</span>
              </div>
            )) : <p className="text-sm text-slate-500">表示できる項目がありません。</p>}
          </div>
        </div>
        <div className="rounded bg-slate-50 p-4">
          <div className="font-bold text-ink">改善候補TOP3</div>
          <div className="mt-3 space-y-2">
            {improvements.length ? improvements.map((item, index) => (
              <div key={item.item_id} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2">
                <span className="font-bold">{index + 1}. {item.item_name}</span>
                <span className="text-lg font-bold text-ink">{fmt(item.overall_average)}</span>
              </div>
            )) : <p className="text-sm text-slate-500">表示できる項目がありません。</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left">
          <thead>
            <tr className="border-b text-sm text-slate-500">
              <th className="py-3">項目</th>
              <th>セクション</th>
              <th className="text-center">自己</th>
              <th className="text-center">360°評価平均</th>
              <th className="text-center">院長</th>
              <th className="text-center">項目別平均</th>
              <th className="text-center">医院平均</th>
              <th className="text-center">平均との差</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((item) => (
              <tr key={item.item_id} className="border-b last:border-0">
                <td className="py-3 font-bold">{item.item_name}</td>
                <td className="text-sm text-slate-600">{item.section_name}</td>
                <td className="text-center font-bold">{fmt(item.self_average)}</td>
                <td className="text-center font-bold">{fmt(item.peer_average)}</td>
                <td className="text-center font-bold">{fmt(item.director_average)}</td>
                <td className="text-center text-lg font-bold text-clinic">{fmt(item.overall_average)}</td>
                <td className="text-center">{fmt(item.clinic_average)}</td>
                <td className={(item.difference_from_average ?? 0) < 0 ? "text-center font-bold text-red-600" : "text-center font-bold text-clinic"}>
                  {signed(item.difference_from_average)}
                </td>
              </tr>
            )) : <tr><td colSpan={8} className="py-8 text-center text-slate-500">項目別平均はまだありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function EvaluationResultsPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");

  const query = searchParams ? await searchParams : {};
  const cycles = getEvaluationCycles();
  const selectedCycle = cycles.find((cycle) => cycle.id === Number(query.cycleId)) ?? cycles.find((cycle) => cycle.status === "active") ?? cycles[0];
  const summary = selectedCycle ? get360SummaryForCycle(selectedCycle.id) : get360SummaryForCycle(cycles[0]?.id ?? 0);
  const completion = getEvaluationCompletionStats(getStaffList(), getEvaluations(), selectedCycle ?? null);
  const listedEvaluations = completion.completedStaffEvaluations.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  const selectedStaffId = query.staffId ? Number(query.staffId) : null;
  const completedStaffRows = summary.staff_summaries.filter((row) => completion.completedStaffIds.has(row.staff.id));
  const staffRows = selectedStaffId ? completedStaffRows.filter((row) => row.staff.id === selectedStaffId) : completedStaffRows;
  const params: Search = { cycleId: selectedCycle ? String(selectedCycle.id) : undefined, staffId: selectedStaffId ? String(selectedStaffId) : undefined };
  const staffReports = buildStaffReports(staffRows, selectedCycle?.name ?? "-");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">評価結果</h1>
          <p className="mt-1 text-slate-600">スタッフごとの評価結果・履歴・削除を管理します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/analytics" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">集計分析へ</Link>
          <Link href="/" className="rounded bg-clinic px-5 py-4 font-bold text-white">トップへ戻る</Link>
        </div>
      </div>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">表示条件</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-bold text-slate-600">評価期間</div>
            <div className="flex flex-wrap gap-2">
              {cycles.map((cycle) => (
                <Link key={cycle.id} href={hrefFor(params, { cycleId: String(cycle.id), staffId: undefined })} className={(selectedCycle?.id === cycle.id ? "bg-clinic text-white" : "border border-clinic text-clinic") + " rounded px-4 py-3 font-bold"}>
                  {cycle.name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-bold text-slate-600">スタッフ</div>
            <div className="flex flex-wrap gap-2">
              <Link href={hrefFor(params, { staffId: undefined })} className={(selectedStaffId ? "border border-clinic text-clinic" : "bg-clinic text-white") + " rounded px-4 py-3 font-bold"}>全員</Link>
              {completedStaffRows.map((row) => (
                <Link key={row.staff.id} href={hrefFor(params, { staffId: String(row.staff.id) })} className={(selectedStaffId === row.staff.id ? "bg-clinic text-white" : "border border-clinic text-clinic") + " rounded px-4 py-3 font-bold"}>
                  {row.staff.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><FileText size={18} />評価件数</div>
          <div className="mt-2 text-3xl font-bold text-clinic">{listedEvaluations.length}</div>
        </div>
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><UserCheck size={18} />評価完了</div>
          <div className="mt-2 text-3xl font-bold text-clinic">{completion.completedCount} / {completion.targetStaffCount}</div>
        </div>
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><History size={18} />評価期間</div>
          <div className="mt-2 text-xl font-bold text-ink">{selectedCycle?.name ?? "-"}</div>
        </div>
        <div className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><MessageSquareText size={18} />コメントあり</div>
          <div className="mt-2 text-3xl font-bold text-clinic">{staffRows.filter((row) => row.evaluations.some((evaluation) => visibleComments(evaluation.comments).length)).length}</div>
        </div>
      </section>

      {completion.missingCount ? (
        <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          未回答者 {completion.missingCount}名は、自己評価が提出されるまで評価完了・平均評価の集計対象に含めません。
        </section>
      ) : null}

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <h2 className="text-2xl font-bold">評価一覧・帳票出力</h2>
        <p className="mt-1 text-sm text-slate-600">
          PDF出力（1人用）、Excel一覧（全スタッフ）、Excel評価シート（1人用）、CSV出力を用途別に操作できます。
        </p>
        <EvaluationResultsTable evaluations={selectedStaffId ? listedEvaluations.filter((evaluation) => evaluation.staff_id === selectedStaffId) : listedEvaluations} staffReports={staffReports} />
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold">スタッフごとの評価結果</h2>
        {staffRows.length ? staffRows.map((row) => {
          const comment = latestComment(row);
          return (
            <article key={row.staff.id} className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold">{row.staff.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">総合評価に加えて、評価項目ごとの平均点と医院平均との差を確認できます。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={hrefFor(params, { staffId: String(row.staff.id) })} className="rounded border border-clinic px-4 py-3 font-bold text-clinic">このスタッフだけ表示</Link>
                  <Link href={"/evaluation-history?staffId=" + row.staff.id} className="rounded border border-clinic px-4 py-3 font-bold text-clinic">評価履歴</Link>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded bg-mint p-4"><div className="text-sm font-bold text-clinic">総合平均</div><div className="mt-1 text-2xl font-bold text-clinic">{fmt(staffAverage(row))}</div></div>
                <div className="rounded bg-slate-50 p-4"><div className="text-sm font-bold text-slate-500">自己評価</div><div className="mt-1 text-2xl font-bold">{fmt(row.self_average)}</div></div>
                <div className="rounded bg-slate-50 p-4"><div className="text-sm font-bold text-slate-500">360°評価平均</div><div className="mt-1 text-2xl font-bold">{fmt(row.peer_average)}</div></div>
                <div className="rounded bg-slate-50 p-4"><div className="text-sm font-bold text-slate-500">院長評価</div><div className="mt-1 text-2xl font-bold">{fmt(row.director_average)}</div></div>
              </div>

              <ItemAnalysisTable items={row.item_breakdown} />

              {comment ? (
                <section className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
                  <h4 className="font-bold text-ink">最新コメント</h4>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {comment.comments.slice(0, 4).map(([key, value]) => (
                      <div key={key} className="rounded bg-white p-3">
                        <div className="font-bold text-clinic">{key}</div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : <p className="mt-4 rounded bg-slate-50 p-4 text-sm text-slate-500">コメントはまだありません。</p>}
            </article>
          );
        }) : <p className="rounded bg-white p-5 text-slate-500 shadow-soft">自己評価提出済みのスタッフ評価はまだありません。</p>}
      </section>
    </div>
  );
}

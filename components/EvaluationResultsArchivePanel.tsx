"use client";

import { Download, Printer } from "lucide-react";
import type { StaffExportReport } from "@/components/EvaluationExportButtons";

export type Raw360ScoreExport = {
  sectionName: string;
  itemName: string;
  score: number | null;
  notApplicable: number;
};

export type Raw360EvaluationExport = {
  evaluationId: number;
  cycleName: string;
  entryDate: string;
  evaluatorName: string;
  evaluatorStaffName: string;
  targetStaffName: string;
  evaluationType: string;
  averageScore: number | null;
  scoreCount: number;
  notApplicableCount: number;
  updatedAt: string;
  scores: Raw360ScoreExport[];
};

type Props = {
  cycleName: string;
  savedAt?: string | null;
  staffReports: StaffExportReport[];
  raw360Rows: Raw360EvaluationExport[];
};

function labelType(type: string) {
  if (type === "self") return "自己評価";
  if (type === "peer") return "360°評価";
  if (type === "director") return "院長評価";
  return "その他";
}

function fmt(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toFixed(2);
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_");
}

export function EvaluationResultsArchivePanel({ cycleName, savedAt, staffReports, raw360Rows }: Props) {
  function printArchive() {
    document.body.classList.add("printing-evaluation-archive");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-evaluation-archive"), 300);
  }

  function exportSummaryCsv() {
    const rows = [
      ["評価期間", "氏名", "総合平均", "自己評価", "360°評価平均", "院長評価", "項目数", "コメント"],
      ...staffReports.map((report) => [
        report.evaluationPeriod,
        report.staffName,
        fmt(report.overallAverage),
        fmt(report.selfAverage),
        fmt(report.peerAverage),
        fmt(report.directorAverage),
        report.items.length,
        report.comments,
      ]),
    ];
    downloadCsv(safeFileName(cycleName) + "-evaluation-results-all.csv", rows);
  }

  function exportRaw360Csv() {
    const rows = [
      ["評価期間", "記載日", "評価者", "評価者スタッフ", "評価対象", "評価種別", "セクション", "評価項目", "点数", "評価しない", "更新日時"],
      ...raw360Rows.flatMap((evaluation) =>
        evaluation.scores.map((score) => [
          evaluation.cycleName,
          evaluation.entryDate,
          evaluation.evaluatorName,
          evaluation.evaluatorStaffName,
          evaluation.targetStaffName,
          labelType(evaluation.evaluationType),
          score.sectionName,
          score.itemName,
          score.notApplicable ? "" : score.score ?? "",
          score.notApplicable ? "評価しない" : "",
          evaluation.updatedAt,
        ]),
      ),
    ];
    downloadCsv(safeFileName(cycleName) + "-360-raw-data.csv", rows);
  }

  return (
    <section className="evaluation-archive-print rounded border border-teal-900/10 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">全体データ確認・保存</h2>
          <p className="mt-1 text-sm text-slate-600">
            この評価期間の全スタッフ分の評価結果と、360°評価で入力された元データを確認・出力できます。
          </p>
          <p className="mt-2 text-sm font-bold text-clinic">
            評価期間: {cycleName} / 保存状態: {savedAt ? new Date(savedAt).toLocaleString("ja-JP") + " 保存済み" : "未保存"}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" onClick={printArchive} className="inline-flex min-h-12 items-center gap-2 rounded border border-clinic px-4 py-3 font-bold text-clinic">
            <Printer size={18} /> 全体を印刷
          </button>
          <button type="button" onClick={exportSummaryCsv} className="inline-flex min-h-12 items-center gap-2 rounded border border-clinic px-4 py-3 font-bold text-clinic">
            <Download size={18} /> 評価結果CSV
          </button>
          <button type="button" onClick={exportRaw360Csv} className="inline-flex min-h-12 items-center gap-2 rounded bg-clinic px-4 py-3 font-bold text-white">
            <Download size={18} /> 360°入力データCSV
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded bg-slate-50 p-4">
          <div className="text-sm font-bold text-slate-500">評価対象スタッフ</div>
          <div className="mt-1 text-2xl font-bold text-ink">{staffReports.length}名</div>
        </div>
        <div className="rounded bg-slate-50 p-4">
          <div className="text-sm font-bold text-slate-500">360°評価データ</div>
          <div className="mt-1 text-2xl font-bold text-ink">{raw360Rows.length}件</div>
        </div>
        <div className="rounded bg-mint p-4">
          <div className="text-sm font-bold text-clinic">入力済み項目</div>
          <div className="mt-1 text-2xl font-bold text-clinic">
            {raw360Rows.reduce((sum, row) => sum + row.scoreCount, 0)}件
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-lg font-bold">全スタッフ評価結果</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b text-sm text-slate-500">
                <th className="py-3">氏名</th>
                <th className="text-center">総合平均</th>
                <th className="text-center">自己評価</th>
                <th className="text-center">360°評価平均</th>
                <th className="text-center">院長評価</th>
                <th className="text-center">項目数</th>
              </tr>
            </thead>
            <tbody>
              {staffReports.length ? staffReports.map((report) => (
                <tr key={report.staffId} className="border-b last:border-0">
                  <td className="py-3 font-bold">{report.staffName}</td>
                  <td className="text-center font-bold text-clinic">{fmt(report.overallAverage)}</td>
                  <td className="text-center">{fmt(report.selfAverage)}</td>
                  <td className="text-center">{fmt(report.peerAverage)}</td>
                  <td className="text-center">{fmt(report.directorAverage)}</td>
                  <td className="text-center">{report.items.length}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">表示できる評価結果がありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-bold">360°評価の入力元データ</h3>
        <p className="mt-1 text-sm text-slate-600">誰が誰を評価したか、入力件数、評価しない件数を全体で確認できます。項目ごとの点数はCSVに出力できます。</p>
        <div className="mt-3 max-h-[520px] overflow-auto rounded border border-slate-200">
          <table className="w-full min-w-[900px] text-left">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-sm text-slate-500">
                <th className="px-3 py-3">記載日</th>
                <th>評価者</th>
                <th>評価対象</th>
                <th>種別</th>
                <th className="text-center">平均</th>
                <th className="text-center">入力項目</th>
                <th className="text-center">評価しない</th>
                <th>更新日時</th>
              </tr>
            </thead>
            <tbody>
              {raw360Rows.length ? raw360Rows.map((row) => (
                <tr key={row.evaluationId} className="border-b last:border-0">
                  <td className="px-3 py-3">{row.entryDate}</td>
                  <td className="font-bold">{row.evaluatorStaffName || row.evaluatorName}</td>
                  <td className="font-bold">{row.targetStaffName}</td>
                  <td>{labelType(row.evaluationType)}</td>
                  <td className="text-center font-bold text-clinic">{fmt(row.averageScore)}</td>
                  <td className="text-center">{row.scoreCount}</td>
                  <td className="text-center">{row.notApplicableCount}</td>
                  <td className="text-sm text-slate-600">{row.updatedAt ? new Date(row.updatedAt).toLocaleString("ja-JP") : "-"}</td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="py-6 text-center text-slate-500">360°評価の入力データがありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

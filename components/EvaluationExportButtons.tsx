"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { calculateEvaluationStandardizationMultiplier } from "@/lib/bonusAdjustment";
import type { Evaluation, EvaluationType } from "@/lib/types";

export type StaffExportItem = {
  itemId: number;
  sectionName: string;
  itemName: string;
  selfAverage: number | null;
  peerAverage: number | null;
  directorAverage: number | null;
  finalAverage: number | null;
};

export type StaffExportReport = {
  staffId: number;
  staffName: string;
  evaluationPeriod: string;
  overallAverage: number | null;
  rank: number;
  selfAverage: number | null;
  peerAverage: number | null;
  directorAverage: number | null;
  finalEvaluation: number | null;
  standardizedScore?: number | null;
  bonusScore?: number | null;
  baseBonus?: number | null;
  finalBonus?: number | null;
  comments: string;
  directorComment: string;
  items: StaffExportItem[];
};

type Props = {
  evaluations: Evaluation[];
  fileBaseName?: string;
  compact?: boolean;
  staffReports?: StaffExportReport[];
};

type BonusRowInput = {
  baseBonus?: string;
  baseBonusMode?: "auto" | "manual";
  finalBonus?: string;
  finalBonusMode?: "auto" | "manual";
  employmentAdjustmentRate?: string;
  workHoursAdjustmentRate?: string;
  attendanceAdjustmentRate?: string;
  individualAdjustmentAmount?: string;
};

function typeLabel(type: EvaluationType) {
  if (type === "self") return "自己評価";
  if (type === "peer") return "360°評価";
  if (type === "director") return "院長評価";
  return "その他評価";
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_");
}

function fmt(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : Number(value.toFixed(2));
}

function yenValue(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : Math.round(value);
}

function numberValue(value: string | number | null | undefined) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function multiplier(percent: string | number | null | undefined) {
  return numberValue(percent) / 100;
}

function distributeEvenly(total: number, count: number) {
  if (!total || count <= 0) return [] as number[];
  const base = Math.floor(total / count);
  let remainder = Math.round(total) - base * count;
  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return value;
  });
}

function distributePoolByWeight(total: number, weights: number[], fixedAdjustments: number[]) {
  if (!weights.length) return [] as number[];
  const roundedTotal = Math.round(total);
  if (!roundedTotal) return weights.map(() => 0);
  const fixedTotal = fixedAdjustments.reduce((sum, value) => sum + value, 0);
  const distributableTotal = Math.max(0, roundedTotal - fixedTotal);
  const totalWeight = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  const raw = weights.map((weight, index) => {
    const variablePart = totalWeight > 0 ? (distributableTotal * Math.max(0, weight)) / totalWeight : distributableTotal / weights.length;
    return variablePart + (fixedAdjustments[index] ?? 0);
  });
  const rounded = raw.map((value) => Math.round(value));
  let diff = roundedTotal - rounded.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, value })).sort((a, b) => b.value - a.value);
  let cursor = 0;
  while (diff !== 0 && order.length) {
    const target = order[cursor % order.length].index;
    rounded[target] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
    cursor += 1;
  }
  return rounded;
}

function distributePoolByWeightWithLockedFinals(total: number, weights: number[], fixedAdjustments: number[], lockedFinals: Array<number | null>) {
  if (!weights.length) return [] as number[];
  const results = lockedFinals.map((value) => value === null ? 0 : Math.max(0, Math.round(value)));
  const unlockedIndexes = weights.map((_, index) => index).filter((index) => lockedFinals[index] === null);
  if (!unlockedIndexes.length) return results;
  const lockedTotal = results.reduce((sum, value, index) => sum + (lockedFinals[index] === null ? 0 : value), 0);
  const unlockedBonuses = distributePoolByWeight(
    Math.max(0, Math.round(total) - lockedTotal),
    unlockedIndexes.map((index) => weights[index]),
    unlockedIndexes.map((index) => fixedAdjustments[index]),
  );
  unlockedIndexes.forEach((index, cursor) => {
    results[index] = unlockedBonuses[cursor] ?? 0;
  });
  return results;
}

function loadBonusSettings() {
  try {
    const stored = window.localStorage.getItem("yumemirai_bonus_calculator_v5")
      ?? window.localStorage.getItem("yumemirai_bonus_calculator_v4")
      ?? window.localStorage.getItem("yumemirai_bonus_calculator_v3")
      ?? window.localStorage.getItem("yumemirai_bonus_calculator_v2");
    if (!stored) return null;
    return JSON.parse(stored) as { rows?: Record<string, BonusRowInput>; mode?: "base" | "pool"; totalPool?: string };
  } catch {
    return null;
  }
}

function reportsWithBonus(reports: StaffExportReport[]) {
  const settings = loadBonusSettings();
  if (!settings?.rows) return reports;
  const mode = settings.mode === "pool" ? "pool" : "base";
  const totalPool = numberValue(settings.totalPool);
  const autoBaseBonuses = mode === "pool" ? distributeEvenly(totalPool, reports.length) : reports.map(() => 0);
  const prepared = reports.map((report, index) => {
    const input = settings.rows?.[String(report.staffId)] ?? {};
    const baseBonusMode = input.baseBonusMode === "manual" || input.baseBonusMode === "auto" ? input.baseBonusMode : (input.baseBonus ? "manual" : "auto");
    const baseBonus = mode === "pool" && baseBonusMode !== "manual" ? (autoBaseBonuses[index] ?? 0) : numberValue(input.baseBonus);
    const coefficient = calculateEvaluationStandardizationMultiplier(report.bonusScore ?? report.standardizedScore ?? report.finalEvaluation);
    const overallMultiplier = multiplier(input.employmentAdjustmentRate ?? "100") * multiplier(input.workHoursAdjustmentRate ?? "100") * multiplier(input.attendanceAdjustmentRate ?? "100");
    const individualAdjustment = numberValue(input.individualAdjustmentAmount);
    const finalBonusOverride = input.finalBonusMode === "manual" && input.finalBonus !== undefined && input.finalBonus !== "" ? Math.max(0, numberValue(input.finalBonus)) : null;
    const referenceFinal = baseBonus * coefficient * overallMultiplier + individualAdjustment;
    const poolWeight = Math.max(0, baseBonus) * coefficient * overallMultiplier;
    return { report, baseBonus, referenceFinal, poolWeight, individualAdjustment, finalBonusOverride };
  });
  const poolFinals = mode === "pool" ? distributePoolByWeightWithLockedFinals(totalPool, prepared.map((row) => row.poolWeight), prepared.map((row) => row.individualAdjustment), prepared.map((row) => row.finalBonusOverride)) : [];
  return prepared.map((row, index) => ({ ...row.report, baseBonus: row.baseBonus, finalBonus: mode === "pool" ? (poolFinals[index] ?? 0) : (row.finalBonusOverride ?? row.referenceFinal) }));
}

function csvRows(evaluations: Evaluation[]) {
  return [
    ["ID", "スタッフ名", "評価期間", "評価年月", "記載日", "評価種別", "評価者", "合計点", "満点", "平均点", "ランク", "更新日時"],
    ...evaluations.map((evaluation) => [
      evaluation.id,
      evaluation.staff_name ?? "",
      evaluation.evaluation_cycle_name ?? "",
      evaluation.evaluation_month,
      evaluation.entry_date,
      typeLabel(evaluation.evaluation_type),
      evaluation.evaluator_staff_name || evaluation.evaluator_name || "",
      evaluation.total_score,
      evaluation.max_score,
      fmt(evaluation.average_score),
      evaluation.rank,
      evaluation.updated_at || evaluation.created_at || "",
    ]),
  ];
}

function allStaffRows(reports: StaffExportReport[]) {
  const itemNames = Array.from(new Set(reports.flatMap((report) => report.items.map((item) => item.itemName))));
  return [
    ["氏名", "総合評価", "順位", "基準賞与", "最終賞与", ...itemNames, "コメント"],
    ...reports.map((report) => {
      const itemMap = new Map(report.items.map((item) => [item.itemName, item.finalAverage]));
      return [
        report.staffName,
        fmt(report.overallAverage),
        report.rank,
        yenValue(report.baseBonus),
        yenValue(report.finalBonus),
        ...itemNames.map((itemName) => fmt(itemMap.get(itemName))),
        report.comments,
      ];
    }),
  ];
}

function staffSheetRows(report: StaffExportReport) {
  return [
    ["業務評価シート"],
    ["氏名", report.staffName, "評価期間", report.evaluationPeriod],
    ["総合評価", fmt(report.overallAverage), "最終評価", fmt(report.finalEvaluation)],
    ["自己評価", fmt(report.selfAverage), "360°評価平均", fmt(report.peerAverage), "院長評価", fmt(report.directorAverage)],
    [],
    ["項目別評価"],
    ["セクション", "評価項目", "自己評価", "360°評価平均", "院長評価", "最終評価"],
    ...report.items.map((item) => [item.sectionName, item.itemName, fmt(item.selfAverage), fmt(item.peerAverage), fmt(item.directorAverage), fmt(item.finalAverage)]),
    [],
    ["院長コメント"],
    [report.directorComment || "-"],
    [],
    ["コメント"],
    [report.comments || "-"],
    [],
    ["印刷日", new Date().toLocaleDateString("ja-JP")],
  ];
}

function escapeCsv(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName(fileName);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadEvaluationsCsv(evaluations: Evaluation[], fileBaseName = "evaluations") {
  const rows = csvRows(evaluations);
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), fileBaseName + ".csv");
}

function xmlEscape(value: string | number | null | undefined) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let value = "";
  let n = index + 1;
  while (n > 0) {
    const mod = (n - 1) % 26;
    value = String.fromCharCode(65 + mod) + value;
    n = Math.floor((n - 1) / 26);
  }
  return value;
}

function worksheetXml(rows: Array<Array<string | number | null | undefined>>, options?: { sheetMode?: "list" | "sheet" }) {
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  const lastColumn = columnName(columnCount - 1);
  const lastRow = Math.max(rows.length, 1);
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = columnName(columnIndex) + String(rowIndex + 1);
      const style = options?.sheetMode === "sheet" && rowIndex === 0 ? ' s="1"' : "";
      if (typeof value === "number" && Number.isFinite(value)) return '<c r="' + ref + '"' + style + '><v>' + String(value) + "</v></c>";
      return '<c r="' + ref + '" t="inlineStr"' + style + '><is><t>' + xmlEscape(value) + "</t></is></c>";
    }).join("");
    return '<row r="' + String(rowIndex + 1) + '">' + cells + "</row>";
  }).join("");
  const filter = options?.sheetMode === "list" ? '<autoFilter ref="A1:' + lastColumn + String(lastRow) + '"/>' : "";
  const pageSetup = options?.sheetMode === "sheet" ? '<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>' : "";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + '<sheetFormatPr defaultColWidth="14" defaultRowHeight="18"/>'
    + '<sheetData>' + body + '</sheetData>' + filter + pageSetup
    + '</worksheet>';
}

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function writeUint16(output: number[], value: number) {
  output.push(value & 255, (value >>> 8) & 255);
}

function writeUint32(output: number[], value: number) {
  output.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function createZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const output: number[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localOffset = offset;
    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint32(output, crc);
    writeUint32(output, data.length);
    writeUint32(output, data.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    output.push(...nameBytes, ...data);
    offset = output.length;
    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, crc);
    writeUint32(central, data.length);
    writeUint32(central, data.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, localOffset);
    central.push(...nameBytes);
  }

  const centralOffset = output.length;
  output.push(...central);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, central.length);
  writeUint32(output, centralOffset);
  writeUint16(output, 0);
  return new Blob([new Uint8Array(output)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function xlsxBlob(rows: Array<Array<string | number | null | undefined>>, sheetName: string, mode: "list" | "sheet") {
  const files = [
    { name: "[Content_Types].xml", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: "_rels/.rels", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: "xl/workbook.xml", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xmlEscape(sheetName).slice(0, 31) + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: "xl/_rels/workbook.xml.rels", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: "xl/styles.xml", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Yu Gothic"/></font><font><b/><sz val="16"/><name val="Yu Gothic"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>' },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(rows, { sheetMode: mode }) },
  ];
  return createZip(files);
}

export function downloadEvaluationsXlsx(evaluations: Evaluation[], fileBaseName = "evaluations") {
  downloadBlob(xlsxBlob(csvRows(evaluations), "評価一覧", "list"), fileBaseName + ".xlsx");
}

export function downloadAllStaffEvaluationXlsx(reports: StaffExportReport[], fileBaseName = "evaluation-all-staff") {
  downloadBlob(xlsxBlob(allStaffRows(reportsWithBonus(reports)), "全スタッフ評価一覧", "list"), fileBaseName + ".xlsx");
}

export function downloadStaffEvaluationSheetXlsx(report: StaffExportReport, fileBaseName = "evaluation-sheet") {
  downloadBlob(xlsxBlob(staffSheetRows(report), "評価シート", "sheet"), fileBaseName + ".xlsx");
}

export function EvaluationExportButtons({ evaluations, staffReports = [], fileBaseName = "evaluations", compact = false }: Props) {
  const baseClass = compact
    ? "inline-flex min-h-11 items-center gap-2 rounded px-3 py-2 text-left font-bold text-ink hover:bg-slate-50"
    : "inline-flex min-h-12 items-center gap-2 rounded border border-clinic bg-white px-4 py-3 font-bold text-clinic";

  return (
    <>
      {staffReports.length ? (
        <button type="button" onClick={() => downloadAllStaffEvaluationXlsx(staffReports, fileBaseName + "-all-staff")} className={baseClass}>
          <FileSpreadsheet size={18} />Excel一覧（全スタッフ）
        </button>
      ) : null}
      <button type="button" onClick={() => downloadEvaluationsCsv(evaluations, fileBaseName)} className={baseClass}>
        <Download size={18} />CSV出力
      </button>
    </>
  );
}

export function StaffEvaluationSheetButton({ report, fileBaseName, compact = false }: { report: StaffExportReport; fileBaseName?: string; compact?: boolean }) {
  const className = compact
    ? "inline-flex min-h-11 items-center gap-2 rounded px-3 py-2 text-left font-bold text-ink hover:bg-slate-50"
    : "inline-flex min-h-12 items-center gap-2 rounded border border-clinic bg-white px-4 py-3 font-bold text-clinic";
  return (
    <button type="button" onClick={() => downloadStaffEvaluationSheetXlsx(report, fileBaseName ?? "evaluation-sheet-" + report.staffName)} className={className}>
      <FileSpreadsheet size={18} />Excel評価シート（1人用）
    </button>
  );
}

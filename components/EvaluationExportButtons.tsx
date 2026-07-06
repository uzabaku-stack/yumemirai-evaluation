"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import type { Evaluation } from "@/lib/types";

type Props = {
  evaluations: Evaluation[];
  fileBaseName?: string;
  compact?: boolean;
};

function typeLabel(type: Evaluation["evaluation_type"]) {
  if (type === "self") return "自己評価";
  if (type === "peer") return "360°評価";
  if (type === "director") return "院長評価";
  return "その他評価";
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_");
}

function exportRows(evaluations: Evaluation[]) {
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
      Number.isFinite(evaluation.average_score) ? Number(evaluation.average_score.toFixed(2)) : "",
      evaluation.rank,
      evaluation.updated_at || evaluation.created_at || "",
    ]),
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
  const rows = exportRows(evaluations);
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), fileBaseName + ".csv");
}

function xmlEscape(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function worksheetXml(rows: Array<Array<string | number | null | undefined>>) {
  const lastColumn = columnName(Math.max(rows[0]?.length ?? 1, 1) - 1);
  const lastRow = Math.max(rows.length, 1);
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = columnName(columnIndex) + String(rowIndex + 1);
      if (typeof value === "number" && Number.isFinite(value)) return '<c r="' + ref + '"><v>' + String(value) + "</v></c>";
      return '<c r="' + ref + '" t="inlineStr"><is><t>' + xmlEscape(value) + "</t></is></c>";
    }).join("");
    return '<row r="' + String(rowIndex + 1) + '">' + cells + "</row>";
  }).join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetData>' + body + '</sheetData>' +
    '<autoFilter ref="A1:' + lastColumn + String(lastRow) + '"/>' +
    '</worksheet>';
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

export function downloadEvaluationsXlsx(evaluations: Evaluation[], fileBaseName = "evaluations") {
  const rows = exportRows(evaluations);
  const files = [
    { name: "[Content_Types].xml", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: "_rels/.rels", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: "xl/workbook.xml", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="評価一覧" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: "xl/_rels/workbook.xml.rels", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: "xl/styles.xml", content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Yu Gothic"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>' },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(rows) },
  ];
  downloadBlob(createZip(files), fileBaseName + ".xlsx");
}

export function EvaluationExportButtons({ evaluations, fileBaseName = "evaluations", compact = false }: Props) {
  const baseClass = compact
    ? "inline-flex min-h-11 items-center gap-2 rounded px-3 py-2 text-left font-bold text-ink hover:bg-slate-50"
    : "inline-flex min-h-12 items-center gap-2 rounded border border-clinic bg-white px-4 py-3 font-bold text-clinic";

  return (
    <>
      <button type="button" onClick={() => downloadEvaluationsXlsx(evaluations, fileBaseName)} className={baseClass}>
        <FileSpreadsheet size={18} />Excel出力
      </button>
      <button type="button" onClick={() => downloadEvaluationsCsv(evaluations, fileBaseName)} className={baseClass}>
        <Download size={18} />CSV出力
      </button>
    </>
  );
}

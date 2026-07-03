"use client";
export function PrintButton() { return <button onClick={() => window.print()} className="no-print mb-4 rounded bg-clinic px-5 py-3 font-bold text-white">PDFとして保存</button>; }

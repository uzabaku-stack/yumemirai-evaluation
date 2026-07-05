"use client";
import { isDirectorRole } from "@/lib/permissions";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Info, Save, XCircle } from "lucide-react";
import { commentFields } from "@/lib/scoring";
import type { CurrentUser, Evaluation, EvaluationItem, EvaluationScore } from "@/lib/types";

const scoreOptions = [1, 2, 3, 4, 5];

type EvaluationEditorProps = {
  evaluation: Evaluation;
  items: EvaluationItem[];
  scores: EvaluationScore[];
  comments: Record<string, string>;
  user: CurrentUser;
  ratingCriteriaText: string;
  allowNotApplicable?: boolean;
  afterSavePath?: string;
};

export function EvaluationEditor({ evaluation, items, scores, comments, user, ratingCriteriaText, allowNotApplicable = false, afterSavePath }: EvaluationEditorProps) {
  const router = useRouter();
  const [scoreValues, setScoreValues] = useState<Record<number, number | null>>(() => scores.reduce((acc, score) => ({ ...acc, [score.item_id]: score.score }), {} as Record<number, number | null>));
  const [notApplicableValues, setNotApplicableValues] = useState<Record<number, boolean>>(() => scores.reduce((acc, score) => ({ ...acc, [score.item_id]: !!score.not_applicable }), {} as Record<number, boolean>));
  const [commentValues, setCommentValues] = useState<Record<string, string>>(comments);
  const [openCriteriaFor, setOpenCriteriaFor] = useState<number | "all" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const grouped = useMemo(() => items.reduce((acc, item) => { (acc[item.section_name] ||= []).push(item); return acc; }, {} as Record<string, EvaluationItem[]>), [items]);
  const isSelf = evaluation.evaluation_type === "self";

  function bulkSet(targetItems: EvaluationItem[], score: number, message: string) {
    if (!targetItems.length) return;
    if (!window.confirm(message)) return;
    setScoreValues((current) => {
      const next = { ...current };
      for (const item of targetItems) next[item.id] = score;
      return next;
    });
    setNotApplicableValues((current) => {
      const next = { ...current };
      for (const item of targetItems) next[item.id] = false;
      return next;
    });
  }

  function bulkAll(score: number) {
    bulkSet(items, score, "表示中の全評価項目を" + score + "点に変更します。よろしいですか？");
  }

  function bulkSection(section: string, sectionItems: EvaluationItem[], score: number) {
    bulkSet(sectionItems, score, "「" + section + "」の全評価項目を" + score + "点に変更します。よろしいですか？");
  }

  function setItemScore(itemId: number, value: number) {
    setScoreValues((current) => ({ ...current, [itemId]: value }));
    setNotApplicableValues((current) => ({ ...current, [itemId]: false }));
  }

  function setNotApplicable(itemId: number) {
    setScoreValues((current) => ({ ...current, [itemId]: null }));
    setNotApplicableValues((current) => ({ ...current, [itemId]: true }));
  }

  async function save() {
    if (isSelf && items.some((item) => !scoreValues[item.id] || notApplicableValues[item.id])) {
      alert("自己評価は全項目の入力が必要です。");
      return;
    }
    setSaving(true);
    setSaveMessage("");
    const payload = {
      scores: items.map((item) => ({ item_id: item.id, score: scoreValues[item.id] ?? null, comment: "", not_applicable: allowNotApplicable && notApplicableValues[item.id] ? 1 : 0 })),
      comments: commentValues,
    };
    try {
      const response = await fetch("/api/evaluations/" + evaluation.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const error = data?.error || "保存できませんでした";
          console.error("save evaluation failed", { status: response.status, ok: response.ok, data, error });
          throw new Error(error);
        }
      setSaveMessage("保存しました");
      try {
        router.push(afterSavePath ?? "/evaluations/" + evaluation.id);
        router.refresh();
      } catch (reloadError) {
        console.error("reload after save failed", reloadError);
        setSaveMessage("保存しました。ただし再読み込みに失敗しました");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存できませんでした";
      console.error("save evaluation failed", { status: null, ok: false, data: null, error: message });
      setSaveMessage(message);
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  function criteriaPanel(target: number | "all") {
    return openCriteriaFor === target ? <div className="rounded border border-teal-900/10 bg-mint/70 p-4 text-sm leading-7 text-ink"><div className="mb-2 font-bold text-clinic">評価点の全体基準</div><p className="whitespace-pre-wrap">{ratingCriteriaText}</p></div> : null;
  }

  function toggleCriteria(target: number | "all") {
    setOpenCriteriaFor((current) => current === target ? null : target);
  }

  function typeLabel() {
    if (evaluation.evaluation_type === "self") return "自己評価";
    if (evaluation.evaluation_type === "peer") return "他人評価";
    if (evaluation.evaluation_type === "director") return "院長評価";
    return "他者評価";
  }

  return <div className="space-y-6"><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="grid gap-3 md:grid-cols-4"><div><div className="text-sm text-slate-500">評価対象</div><div className="text-2xl font-bold">{evaluation.staff_name}</div></div><div><div className="text-sm text-slate-500">評価年月</div><div className="text-xl font-bold">{evaluation.evaluation_month}</div></div><div><div className="text-sm text-slate-500">記載日</div><div className="text-xl font-bold">{evaluation.entry_date}</div></div><div><div className="text-sm text-slate-500">評価種別</div><div className="text-xl font-bold">{typeLabel()}</div></div></div>{allowNotApplicable ? <p className="mt-4 rounded bg-slate-50 px-4 py-3 text-sm text-slate-600">わからない項目は「評価しない」を選べます。集計では1点扱いにせず、平均から除外します。</p> : null}</section><section className="rounded border-2 border-clinic/20 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">全項目を一括設定</h2><p className="mt-1 text-sm text-slate-600">現在表示されている評価項目だけに反映します。反映後も各項目は個別に修正できます。</p></div><button type="button" onClick={() => toggleCriteria("all")} className="flex min-h-12 items-center gap-2 rounded border border-clinic px-5 py-3 font-bold text-clinic"><Info size={20} />評価基準を見る</button></div><div className="mt-5 hidden gap-3 md:grid md:grid-cols-[1.4fr_repeat(4,1fr)]"><button type="button" onClick={() => bulkAll(3)} className="min-h-16 rounded bg-clinic px-5 py-4 text-xl font-bold text-white shadow-soft">全項目を3点にする</button>{[1, 2, 4, 5].map((score) => <button key={score} type="button" onClick={() => bulkAll(score)} className="min-h-16 rounded bg-slate-100 px-5 py-4 text-lg font-bold text-ink hover:bg-mint">全項目を{score}点にする</button>)}</div><div className="mt-4 grid grid-cols-5 gap-2 md:hidden">{scoreOptions.map((score) => <button key={score} type="button" onClick={() => bulkAll(score)} className={(score === 3 ? "bg-clinic text-white" : "bg-slate-100 text-ink") + " min-h-14 rounded px-3 py-3 text-base font-bold"}>{score}点</button>)}</div><div className="mt-4">{criteriaPanel("all")}</div></section>{Object.entries(grouped).map(([section, sectionItems]) => <section key={section} className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">{section}</h2><p className="mt-1 text-sm text-slate-600">このセクションを一括設定</p></div><div className="grid grid-cols-5 gap-2">{scoreOptions.map((score) => <button key={score} type="button" onClick={() => bulkSection(section, sectionItems, score)} className={(score === 3 ? "border-clinic bg-mint text-clinic" : "border-slate-200 bg-white text-ink") + " min-h-12 rounded border px-3 py-2 text-sm font-bold hover:bg-mint"}>{score}点</button>)}</div></div><div className="mt-4 space-y-4">{sectionItems.map((item) => <div key={item.id} className="grid gap-3 border-t pt-4 lg:grid-cols-[1fr_420px]"><div><div className="text-lg font-bold">{item.item_name}</div><div className="mt-3 rounded border border-teal-900/10 bg-mint/60 p-4 text-sm leading-7 text-ink"><div className="font-bold text-clinic">ⓘ 評価基準</div><p className="mt-2 whitespace-pre-wrap">{item.criteria || "説明文は未設定です。"}</p></div></div><div className="space-y-3"><button type="button" onClick={() => toggleCriteria(item.id)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded border border-clinic px-3 py-2 text-sm font-bold text-clinic"><Info size={18} />評価点の全体基準を見る</button><div className="grid grid-cols-5 gap-2">{scoreOptions.map((value) => <button type="button" key={value} onClick={() => setItemScore(item.id, value)} className={(scoreValues[item.id] === value && !notApplicableValues[item.id] ? "bg-clinic text-white" : "bg-slate-100 text-ink") + " h-14 rounded text-xl font-bold"}>{value}</button>)}</div>{allowNotApplicable ? <button type="button" onClick={() => setNotApplicable(item.id)} className={(notApplicableValues[item.id] ? "border-coral bg-coral text-white" : "border-slate-300 bg-white text-slate-700") + " flex min-h-12 w-full items-center justify-center gap-2 rounded border px-4 py-3 font-bold"}><XCircle size={18} />評価しない</button> : null}{criteriaPanel(item.id)}</div></div>)}</div></section>)}<section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h2 className="text-2xl font-bold">コメント</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{commentFields.map((field) => <label key={field} className="space-y-2"><span className="font-bold">{field}</span><textarea value={commentValues[field] ?? ""} onChange={(event) => setCommentValues((current) => ({ ...current, [field]: event.target.value }))} className="min-h-28 w-full rounded border border-slate-300 p-3" /></label>)}</div></section>{saveMessage ? <div className={(saveMessage.includes("できません") || saveMessage.includes("失敗") ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-mint text-clinic") + " rounded border px-4 py-3 font-bold"}>{saveMessage}</div> : null}<div className="sticky bottom-0 -mx-5 flex gap-3 border-t bg-paper/95 p-4 backdrop-blur"><button onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded bg-clinic px-6 py-5 text-xl font-bold text-white disabled:opacity-60"><Save />{saving ? "保存中..." : "保存する"}</button>{isDirectorRole(user.role) ? <button onClick={() => window.open("/evaluations/" + evaluation.id + "/print", "_blank")} className="flex items-center justify-center gap-2 rounded border border-clinic px-6 py-5 font-bold text-clinic"><FileText />PDF</button> : null}</div></div>;
}

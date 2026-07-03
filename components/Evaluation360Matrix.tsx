"use client";
import { isDirectorRole } from "@/lib/permissions";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { CurrentUser, Evaluation, EvaluationItem, EvaluationScore, Staff } from "@/lib/types";

type Target = {
  staff: Staff;
  evaluation: Evaluation;
  scores: EvaluationScore[];
  comments?: Record<string, string>;
};

type CellValue = { score: number | null; not_applicable: boolean };

type Props = {
  user: CurrentUser;
  items: EvaluationItem[];
  targets: Target[];
  ratingCriteriaText: string;
  afterSavePath?: string;
};

const scoreOptions = [1, 2, 3, 4, 5];
const selfCommentFields = ["本人コメント", "自己評価（振り返り）", "反省点", "来期目標"];

function cellKey(evaluationId: number, itemId: number) {
  return evaluationId + ":" + itemId;
}

function appliesToStaff(item: EvaluationItem, staff: Staff) {
  return !item.target_roles?.length || item.target_roles.includes(staff.role);
}

function initialValues(targets: Target[]) {
  const values: Record<string, CellValue> = {};
  for (const target of targets) {
    for (const score of target.scores) {
      values[cellKey(target.evaluation.id, score.item_id)] = { score: score.score, not_applicable: !!score.not_applicable };
    }
  }
  return values;
}

function initialSelfComments(target?: Target) {
  const values: Record<string, string> = {};
  for (const field of selfCommentFields) values[field] = target?.comments?.[field] ?? "";
  return values;
}

function typeLabel(evaluation: Evaluation) {
  if (evaluation.evaluation_type === "self") return "自己評価";
  if (evaluation.evaluation_type === "director") return "院長評価";
  return "他人評価";
}

export function Evaluation360Matrix({ user, items, targets, afterSavePath = "/360?saved=1" }: Props) {
  const router = useRouter();
  const selfTarget = useMemo(() => targets.find((target) => target.evaluation.evaluation_type === "self"), [targets]);
  const [values, setValues] = useState<Record<string, CellValue>>(() => initialValues(targets));
  const [selfComments, setSelfComments] = useState<Record<string, string>>(() => initialSelfComments(selfTarget));
  const [saving, setSaving] = useState(false);
  const grouped = useMemo(() => items.reduce((acc, item) => { (acc[item.section_name] ||= []).push(item); return acc; }, {} as Record<string, EvaluationItem[]>), [items]);
  const isDirectorMode = isDirectorRole(user.role);

  function setCell(evaluationId: number, itemId: number, value: CellValue) {
    setValues((current) => ({ ...current, [cellKey(evaluationId, itemId)]: value }));
  }

  function setScore(evaluationId: number, itemId: number, score: number) {
    setCell(evaluationId, itemId, { score, not_applicable: false });
  }

  function setNotApplicable(evaluationId: number, itemId: number) {
    setCell(evaluationId, itemId, { score: null, not_applicable: true });
  }

  function bulkSet(targetItems: EvaluationItem[], score: number, message: string) {
    if (!window.confirm(message)) return;
    setValues((current) => {
      const next = { ...current };
      for (const target of targets) {
        for (const item of targetItems) {
          if (appliesToStaff(item, target.staff)) next[cellKey(target.evaluation.id, item.id)] = { score, not_applicable: false };
        }
      }
      return next;
    });
  }

  async function save() {
    for (const target of targets) {
      if (target.evaluation.evaluation_type === "self") {
        const missing = items.some((item) => appliesToStaff(item, target.staff) && (!values[cellKey(target.evaluation.id, item.id)]?.score || values[cellKey(target.evaluation.id, item.id)]?.not_applicable));
        if (missing) {
          alert(target.staff.name + "さんの自己評価は全項目の入力が必要です。");
          return;
        }
      }
    }

    setSaving(true);
    try {
      for (const target of targets) {
        const scores = items.filter((item) => appliesToStaff(item, target.staff)).map((item) => {
          const value = values[cellKey(target.evaluation.id, item.id)] ?? { score: null, not_applicable: false };
          const canSkip = target.evaluation.evaluation_type !== "self";
          return { item_id: item.id, score: value.not_applicable && canSkip ? null : value.score, comment: "", not_applicable: value.not_applicable && canSkip ? 1 : 0 };
        });
        const body: { scores: typeof scores; comments?: Record<string, string> } = { scores };
        if (target.evaluation.evaluation_type === "self") {
          const comments = { ...(target.comments ?? {}) };
          for (const field of selfCommentFields) comments[field] = selfComments[field] ?? "";
          body.comments = comments;
        }
        const response = await fetch("/api/evaluations/" + target.evaluation.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error("save failed");
      }
      router.push(afterSavePath);
      router.refresh();
    } catch {
      alert("保存できませんでした。");
      setSaving(false);
    }
  }

  function cell(target: Target, item: EvaluationItem) {
    if (!appliesToStaff(item, target.staff)) return <div className="flex min-h-24 items-center justify-center rounded bg-slate-100 px-3 py-4 text-sm font-bold text-slate-500">対象外</div>;
    const key = cellKey(target.evaluation.id, item.id);
    const value = values[key] ?? { score: null, not_applicable: false };
    const canSkip = target.evaluation.evaluation_type !== "self";
    return <div className="min-h-24 space-y-2 rounded border border-slate-200 bg-white p-2"><div className="grid grid-cols-5 gap-1">{scoreOptions.map((score) => <button key={score} type="button" onClick={() => setScore(target.evaluation.id, item.id, score)} className={(value.score === score && !value.not_applicable ? "bg-clinic text-white" : "bg-slate-100 text-ink") + " min-h-11 rounded text-base font-bold"}>{score}</button>)}</div>{canSkip ? <button type="button" onClick={() => setNotApplicable(target.evaluation.id, item.id)} className={(value.not_applicable ? "border-coral bg-coral text-white" : "border-slate-300 bg-white text-slate-700") + " min-h-10 w-full rounded border px-2 text-sm font-bold"}>評価しない</button> : <div className="min-h-10 rounded bg-mint px-2 py-2 text-center text-xs font-bold text-clinic">自己評価</div>}</div>;
  }

  return <div className="space-y-5"><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">{isDirectorMode ? "院長評価" : "360°評価"}</h1><p className="mt-1 text-slate-600">短時間で全員の点数を入力する画面です。他人評価のコメント欄は表示しません。</p></div><button type="button" onClick={() => bulkSet(items, 3, "全員・全項目を3点に変更します。よろしいですか？")} className="min-h-14 rounded bg-clinic px-6 py-4 text-lg font-bold text-white shadow-soft">全員・全項目を3点にする</button></div></section><div className="space-y-6">{Object.entries(grouped).map(([section, sectionItems]) => <section key={section} className="rounded border border-teal-900/10 bg-white p-4 shadow-soft"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">{section}</h2><div className="flex flex-wrap gap-2"><button type="button" onClick={() => bulkSet(sectionItems, 3, "「" + section + "」を全員3点に変更します。よろしいですか？")} className="min-h-12 rounded bg-mint px-4 py-3 font-bold text-clinic">このセクションを3点</button>{scoreOptions.map((score) => <button key={score} type="button" onClick={() => bulkSet(sectionItems, score, "「" + section + "」を全員" + score + "点に変更します。よろしいですか？")} className="min-h-12 rounded border border-slate-200 bg-white px-4 py-3 font-bold text-ink">{score}点</button>)}</div></div><div className="max-h-[72vh] overflow-auto rounded border border-slate-200"><table className="border-separate border-spacing-0 text-left"><thead><tr><th className="sticky left-0 top-0 z-30 min-w-[280px] border-b border-r border-slate-200 bg-slate-50 p-4 align-bottom text-sm font-bold text-slate-600">評価項目</th>{targets.map((target) => <th key={target.evaluation.id} className="sticky top-0 z-20 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 p-4 text-center"><div className="text-lg font-bold text-ink">{target.staff.name}</div><div className="mt-1 rounded bg-mint px-2 py-1 text-xs font-bold text-clinic">{typeLabel(target.evaluation)}</div></th>)}</tr></thead><tbody>{sectionItems.map((item) => <tr key={item.id}><th className="sticky left-0 z-10 min-w-[280px] border-b border-r border-slate-200 bg-white p-4 align-top"><div className="text-base font-bold text-ink">{item.item_name}</div><div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{item.criteria}</div></th>{targets.map((target) => <td key={target.evaluation.id + '-' + item.id} className="min-w-[220px] border-b border-r border-slate-200 bg-paper/50 p-3 align-top">{cell(target, item)}</td>)}</tr>)}</tbody></table></div></section>)}</div>{selfTarget ? <section className="rounded border-2 border-clinic/20 bg-white p-5 shadow-soft"><div className="border-b border-slate-200 pb-4"><h2 className="text-2xl font-bold">{selfTarget.staff.name}（自己評価）</h2><p className="mt-1 text-sm text-slate-600">このコメントは自分の自己評価にだけ保存されます。他スタッフへの評価にはコメント欄を表示しません。</p></div><div className="mt-5 grid gap-4 md:grid-cols-2">{selfCommentFields.map((field) => <label key={field} className="space-y-2"><span className="font-bold text-ink">{field}</span><textarea value={selfComments[field] ?? ""} onChange={(event) => setSelfComments((current) => ({ ...current, [field]: event.target.value }))} className="min-h-32 w-full rounded border border-slate-300 bg-white p-4 text-base leading-7 outline-none focus:border-clinic focus:ring-2 focus:ring-clinic/20" /></label>)}</div></section> : null}<div className="sticky bottom-0 -mx-5 border-t bg-paper/95 p-4 backdrop-blur"><button type="button" onClick={save} disabled={saving} className="flex min-h-16 w-full items-center justify-center gap-2 rounded bg-clinic px-6 py-5 text-xl font-bold text-white disabled:opacity-60"><Save />{saving ? "保存中..." : (isDirectorMode ? "院長評価を保存" : "360°評価を保存")}</button></div></div>;
}

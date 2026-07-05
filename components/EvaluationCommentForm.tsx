"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { CurrentUser, Evaluation, Staff } from "@/lib/types";

type Target = { staff: Staff; evaluation: Evaluation; comments: Record<string, string> };

type Props = {
  user: CurrentUser;
  targets: Target[];
  fields: string[];
  title: string;
  description: string;
  backHref: string;
};

const metaKey = "__360_comment_meta";

function initialValues(targets: Target[], fields: string[]) {
  const values: Record<number, Record<string, string>> = {};
  for (const target of targets) {
    values[target.evaluation.id] = {};
    for (const field of fields) values[target.evaluation.id][field] = String(target.comments[field] ?? "");
  }
  return values;
}

function publicComments(comments: Record<string, string>) {
  return Object.fromEntries(Object.entries(comments).filter(([key]) => key !== metaKey));
}

export function EvaluationCommentForm({ user, targets, fields, title, description, backHref }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(() => initialValues(targets, fields));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  function setComment(evaluationId: number, field: string, value: string) {
    setValues((current) => ({ ...current, [evaluationId]: { ...(current[evaluationId] ?? {}), [field]: value } }));
  }

  function buildComments(target: Target) {
    const now = new Date().toISOString();
    const current = values[target.evaluation.id] ?? {};
    const comments: Record<string, string | unknown> = publicComments(target.comments);
    for (const field of fields) comments[field] = current[field] ?? "";
    comments[metaKey] = {
      evaluator_id: user.id,
      target_staff_id: target.staff.id,
      evaluation_type: target.evaluation.evaluation_type,
      updated_at: now,
      entries: fields.map((field) => ({ evaluator_id: user.id, target_staff_id: target.staff.id, evaluation_type: target.evaluation.evaluation_type, comment_type: field, body: current[field] ?? "", updated_at: now })),
    };
    return comments;
  }

  async function save() {
    setSaving(true);
    setSaveMessage("");
    try {
      for (const target of targets) {
        const response = await fetch("/api/evaluations/" + target.evaluation.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scores: [], comments: buildComments(target) }) });
        if (!response.ok) throw new Error("save failed");
      }
      setSaveMessage("保存しました");
      router.push(backHref + (backHref.includes("?") ? "&" : "?") + "saved=1");
      router.refresh();
    } catch (error) {
      console.error(error);
      setSaveMessage("保存できませんでした");
      alert("保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-5"><section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><h1 className="text-3xl font-bold">{title}</h1><p className="mt-2 text-slate-600">{description}</p></section><section className="grid gap-4 lg:grid-cols-2">{targets.map((target) => { const current = values[target.evaluation.id] ?? {}; return <div key={target.evaluation.id} className="rounded border border-teal-900/10 bg-white p-5 shadow-soft"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{target.staff.name}</h2><span className="rounded bg-mint px-3 py-1 text-sm font-bold text-clinic">{target.evaluation.evaluation_type === "director" ? "院長評価" : "自己評価"}</span></div><div className="space-y-4">{fields.map((field) => <label key={field} className="block"><span className="font-bold">{field}</span><textarea value={current[field] ?? ""} onChange={(event) => setComment(target.evaluation.id, field, event.target.value)} className="mt-2 min-h-28 w-full rounded border border-slate-300 p-3 text-base" /></label>)}</div></div>; })}</section>{saveMessage ? <div className={(saveMessage.includes("できません") ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-mint text-clinic") + " rounded border px-4 py-3 font-bold"}>{saveMessage}</div> : null}<div className="sticky bottom-0 -mx-5 border-t bg-paper/95 p-4 backdrop-blur"><button onClick={save} disabled={saving} className="flex min-h-16 w-full items-center justify-center gap-2 rounded bg-clinic px-6 py-5 text-xl font-bold text-white disabled:opacity-60"><Save />{saving ? "保存中..." : "コメントを保存"}</button></div></div>;
}

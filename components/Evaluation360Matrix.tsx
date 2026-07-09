"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { isDirectorRole } from "@/lib/permissions";
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
  const targetRoles = (item.target_roles ?? []).map((role) => role.trim()).filter(Boolean);
  const staffRole = staff.role.trim();
  return !targetRoles.length || targetRoles.includes("全職種") || targetRoles.includes("all") || targetRoles.includes(staffRole);
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
  const [saveMessage, setSaveMessage] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const grouped = useMemo(() => items.reduce((acc, item) => { (acc[item.section_name] ||= []).push(item); return acc; }, {} as Record<string, EvaluationItem[]>), [items]);
  const isDirectorMode = isDirectorRole(user.role);
  const inputtableCellCount = useMemo(() => targets.reduce((count, target) => count + items.filter((item) => appliesToStaff(item, target.staff)).length, 0), [items, targets]);

  function setCell(evaluationId: number, itemId: number, value: CellValue) {
    setValues((current) => ({ ...current, [cellKey(evaluationId, itemId)]: value }));
  }

  function setScore(evaluationId: number, itemId: number, score: number) {
    setCell(evaluationId, itemId, { score, not_applicable: false });
  }

  function setNotApplicable(evaluationId: number, itemId: number) {
    setCell(evaluationId, itemId, { score: null, not_applicable: true });
  }

  function bulkSet(targetItems: EvaluationItem[], score: number, mode: "empty" | "overwrite", message: string) {
    const inputtablePairs = targets.flatMap((target) => targetItems.filter((item) => appliesToStaff(item, target.staff)).map((item) => ({ target, item })));
    if (!inputtablePairs.length) {
      setBulkMessage("一括設定できる評価項目がありません。");
      return;
    }
    const modeText = mode === "empty" ? "未入力の項目だけ3点にします。すでに1〜5点が入っている項目と「評価しない」は変更しません。" : "入力済みの点数もすべて3点に上書きします。";
    if (!window.confirm(message + "\n\n" + modeText + "対象外の項目には反映しません。")) return;
    let changedCount = 0;
    setValues((current) => {
      const next = { ...current };
      for (const { target, item } of inputtablePairs) {
        const key = cellKey(target.evaluation.id, item.id);
        const currentValue = current[key];
        const hasScore = currentValue?.score !== null && currentValue?.score !== undefined;
        const isNotApplicable = !!currentValue?.not_applicable;
        if (mode === "empty" && (hasScore || isNotApplicable)) continue;
        next[key] = { score, not_applicable: false };
        changedCount += 1;
      }
      return next;
    });
    setBulkMessage(mode === "empty" ? changedCount + "件の未入力セルを" + score + "点にしました。入力済み項目と評価しない項目は変更していません。" : changedCount + "件の入力可能セルを" + score + "点で上書きしました。対象外の項目には反映していません。");
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
    setSaveMessage("");
    try {
      for (const target of targets) {
        const scores = items.filter((item) => appliesToStaff(item, target.staff)).map((item) => {
          const value = values[cellKey(target.evaluation.id, item.id)] ?? { score: null, not_applicable: false };
          const canSkip = target.evaluation.evaluation_type !== "self";
          return { item_id: item.id, score: value.not_applicable && canSkip ? null : value.score, comment: "", not_applicable: value.not_applicable && canSkip ? 1 : 0 };
        });
        const body: { scores: typeof scores; comments?: Record<string, string>; staff_id: number; evaluator_name: string; evaluation_type: Evaluation["evaluation_type"]; evaluation_month: string; entry_date: string; evaluation_cycle_id?: number | null; is_360: number } = {
          scores,
          staff_id: target.staff.id,
          evaluator_name: target.evaluation.evaluator_name || user.name,
          evaluation_type: target.evaluation.evaluation_type,
          evaluation_month: target.evaluation.evaluation_month,
          entry_date: target.evaluation.entry_date,
          evaluation_cycle_id: target.evaluation.evaluation_cycle_id ?? null,
          is_360: 1,
        };
        if (target.evaluation.evaluation_type === "self") {
          const comments = { ...(target.comments ?? {}) };
          for (const field of selfCommentFields) comments[field] = selfComments[field] ?? "";
          body.comments = comments;
        }
        const response = await fetch("/api/evaluations/" + target.evaluation.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 404 && (data?.reason === "evaluation_not_found" || data?.error === "evaluation_not_found")) {
            const createResponse = await fetch("/api/evaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const createData = await createResponse.json().catch(() => null);
            if (!createResponse.ok) {
              const createError = createData?.error || "保存できませんでした";
              console.error("save evaluation failed", { status: createResponse.status, ok: createResponse.ok, data: createData, error: createError });
              throw new Error(createError);
            }
          } else {
            const error = data?.error || "保存できませんでした";
            console.error("save evaluation failed", { status: response.status, ok: response.ok, data, error });
            throw new Error(error);
          }
        }
      }
      setSaveMessage("保存しました");
      try {
        router.push(afterSavePath);
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

  function cell(target: Target, item: EvaluationItem, compact = false) {
    if (!appliesToStaff(item, target.staff)) return <div className="flex min-h-14 items-center justify-center rounded bg-slate-100 px-3 py-4 text-sm font-bold text-slate-500">対象外</div>;
    const key = cellKey(target.evaluation.id, item.id);
    const value = values[key] ?? { score: null, not_applicable: false };
    const canSkip = target.evaluation.evaluation_type !== "self";
    return (
      <div className={(compact ? "space-y-3" : "min-h-24 space-y-2") + " rounded border border-slate-200 bg-white p-2"}>
        <div className="grid grid-cols-5 gap-2">
          {scoreOptions.map((score) => (
            <button key={score} type="button" onClick={() => setScore(target.evaluation.id, item.id, score)} className={(value.score === score && !value.not_applicable ? "bg-clinic text-white" : "bg-slate-100 text-ink") + " min-h-12 rounded text-base font-bold sm:min-h-11"}>{score}</button>
          ))}
        </div>
        {canSkip ? (
          <button type="button" onClick={() => setNotApplicable(target.evaluation.id, item.id)} className={(value.not_applicable ? "border-coral bg-coral text-white" : "border-slate-300 bg-white text-slate-700") + " min-h-12 w-full rounded border px-3 text-sm font-bold"}>評価しない</button>
        ) : (
          <div className="min-h-12 rounded bg-mint px-3 py-3 text-center text-sm font-bold text-clinic">自己評価</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <section className="rounded border border-teal-900/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{isDirectorMode ? "院長評価" : "360°評価"}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600 md:text-base">短時間で全員の点数を入力する画面です。他人評価のコメント欄は表示しません。</p>
            <p className="mt-2 text-sm font-bold leading-6 text-clinic">一括設定は、入力可能な全スタッフ・全評価項目が対象です。対象外の項目には反映しません。</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-wrap">
            <button type="button" onClick={() => bulkSet(items, 3, "empty", "未入力の評価項目だけ3点にします。よろしいですか？")} className="min-h-14 rounded border border-clinic bg-white px-5 py-4 text-base font-bold text-clinic shadow-soft md:text-lg">未入力だけ3点</button>
            <button type="button" onClick={() => bulkSet(items, 3, "overwrite", "入力可能な全スタッフ・全評価項目を3点に上書きします。よろしいですか？")} className="min-h-14 rounded bg-clinic px-5 py-4 text-base font-bold text-white shadow-soft md:text-lg">全項目を3点に上書き</button>
          </div>
        </div>
        <div className="mt-4 rounded border border-teal-100 bg-mint/50 px-4 py-3 text-sm font-bold leading-6 text-clinic">対象: 入力可能セル {inputtableCellCount} 件。「未入力だけ3点」は入力済みと評価しないを変更しません。「全項目を3点に上書き」は既存点も変更します。</div>
        {bulkMessage ? <div className="mt-3 rounded border border-teal-200 bg-white px-4 py-3 text-sm font-bold leading-6 text-clinic">{bulkMessage}</div> : null}
      </section>

      <div className="space-y-6">
        {Object.entries(grouped).map(([section, sectionItems]) => (
          <section key={section} className="rounded border border-teal-900/10 bg-white p-3 shadow-soft sm:p-4">
            <div className="mb-4 space-y-3 md:flex md:flex-wrap md:items-center md:justify-between md:gap-3 md:space-y-0">
              <h2 className="text-xl font-bold md:text-2xl">{section}</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:flex md:flex-wrap">
                <button type="button" onClick={() => bulkSet(sectionItems, 3, "overwrite", "「" + section + "」を全員3点に変更します。よろしいですか？")} className="col-span-3 min-h-12 rounded bg-mint px-3 py-3 text-sm font-bold text-clinic sm:col-span-1 md:px-4 md:text-base">このセクションを3点</button>
                {scoreOptions.map((score) => (
                  <button key={score} type="button" onClick={() => bulkSet(sectionItems, score, "overwrite", "「" + section + "」を全員" + score + "点に変更します。よろしいですか？")} className="min-h-12 rounded border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-ink md:px-4 md:text-base">{score}点</button>
                ))}
              </div>
            </div>

            <div className="space-y-4 md:hidden">
              {sectionItems.map((item) => (
                <article key={item.id} className="rounded border border-slate-200 bg-paper/50 p-4">
                  <div className="rounded bg-white p-3">
                    <h3 className="text-base font-bold text-ink">{item.item_name}</h3>
                    {item.criteria ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.criteria}</p> : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    {targets.map((target) => (
                      <div key={target.evaluation.id + "-mobile-" + item.id} className="rounded border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="font-bold text-ink">{target.staff.name}</div>
                          <div className="rounded bg-mint px-2 py-1 text-xs font-bold text-clinic">{typeLabel(target.evaluation)}</div>
                        </div>
                        {cell(target, item, true)}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden max-h-[72vh] overflow-auto rounded border border-slate-200 md:block">
              <table className="border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 min-w-[280px] border-b border-r border-slate-200 bg-slate-50 p-4 align-bottom text-sm font-bold text-slate-600">評価項目</th>
                    {targets.map((target) => (
                      <th key={target.evaluation.id} className="sticky top-0 z-20 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 p-4 text-center">
                        <div className="text-lg font-bold text-ink">{target.staff.name}</div>
                        <div className="mt-1 rounded bg-mint px-2 py-1 text-xs font-bold text-clinic">{typeLabel(target.evaluation)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectionItems.map((item) => (
                    <tr key={item.id}>
                      <th className="sticky left-0 z-10 min-w-[280px] border-b border-r border-slate-200 bg-white p-4 align-top">
                        <div className="text-base font-bold text-ink">{item.item_name}</div>
                        <div className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{item.criteria}</div>
                      </th>
                      {targets.map((target) => <td key={target.evaluation.id + "-" + item.id} className="min-w-[220px] border-b border-r border-slate-200 bg-paper/50 p-3 align-top">{cell(target, item)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      {selfTarget ? (
        <section className="rounded border-2 border-clinic/20 bg-white p-4 shadow-soft sm:p-5">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold md:text-2xl">{selfTarget.staff.name}（自己評価）</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">このコメントは自分の自己評価にだけ保存されます。他スタッフへの評価にはコメント欄を表示しません。</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {selfCommentFields.map((field) => (
              <label key={field} className="space-y-2">
                <span className="font-bold text-ink">{field}</span>
                <textarea value={selfComments[field] ?? ""} onChange={(event) => setSelfComments((current) => ({ ...current, [field]: event.target.value }))} className="min-h-32 w-full rounded border border-slate-300 bg-white p-4 text-base leading-7 outline-none focus:border-clinic focus:ring-2 focus:ring-clinic/20" />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {saveMessage ? <div className={(saveMessage.includes("できません") || saveMessage.includes("失敗") ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-mint text-clinic") + " rounded border px-4 py-3 font-bold"}>{saveMessage}</div> : null}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-paper/95 p-3 backdrop-blur md:sticky md:-mx-5 md:p-4">
        <button type="button" onClick={save} disabled={saving} className="flex min-h-14 w-full items-center justify-center gap-2 rounded bg-clinic px-6 py-4 text-lg font-bold text-white disabled:opacity-60 md:min-h-16 md:py-5 md:text-xl"><Save />{saving ? "保存中..." : (isDirectorMode ? "院長評価を保存" : "360°評価を保存")}</button>
      </div>
    </div>
  );
}

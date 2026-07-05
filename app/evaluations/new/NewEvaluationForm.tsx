"use client";
import { isDirectorRole } from "@/lib/permissions";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CurrentUser, Staff } from "@/lib/types";

export function NewEvaluationForm({ staff, user }: { staff: Staff[]; user: CurrentUser }) {
  const router = useRouter();
  const search = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const isDirector = isDirectorRole(user.role);
  const selectedStaffId = isDirector ? (search.get("staff") ?? staff[0]?.id) : user.staff_id;
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      const formData = new FormData(event.currentTarget);
      const body = Object.fromEntries(formData.entries());
      const response = await fetch("/api/evaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = data?.error || "保存できませんでした";
        console.error("save evaluation failed", { status: response.status, ok: response.ok, data, error });
        throw new Error(error);
      }
      setSaveMessage("保存しました");
      try {
        router.push("/evaluations/" + data.id + "/edit");
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
  return <form onSubmit={onSubmit} className="rounded border border-teal-900/10 bg-white p-6 shadow-soft"><div className="grid gap-5 md:grid-cols-2"><label className="space-y-2"><span className="font-bold">評価対象スタッフ</span>{isDirector ? <select name="staff_id" defaultValue={selectedStaffId ?? undefined} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" required>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select> : <><input type="hidden" name="staff_id" value={user.staff_id ?? ""} /><div className="flex h-14 items-center rounded border border-slate-200 bg-slate-50 px-4 text-lg font-bold">{user.name}</div></>}</label><label className="space-y-2"><span className="font-bold">評価者名</span><input name="evaluator_name" defaultValue={isDirector ? "" : user.name} readOnly={!isDirector} className="h-14 w-full rounded border border-slate-300 px-4 text-lg read-only:bg-slate-50" placeholder="院長・副院長など" required /></label><label className="space-y-2"><span className="font-bold">評価タイプ</span>{isDirector ? <select name="evaluation_type" className="h-14 w-full rounded border border-slate-300 px-4 text-lg"><option value="other">他者評価</option><option value="self">本人評価</option></select> : <><input type="hidden" name="evaluation_type" value="self" /><div className="flex h-14 items-center rounded border border-slate-200 bg-slate-50 px-4 text-lg font-bold">本人評価</div></>}</label><label className="space-y-2"><span className="font-bold">評価年月</span><input type="month" name="evaluation_month" defaultValue={month} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" required /></label><label className="space-y-2"><span className="font-bold">記載日</span><input type="date" name="entry_date" defaultValue={today} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" required /></label></div>{saveMessage ? <div className={(saveMessage.includes("できません") || saveMessage.includes("失敗") ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-mint text-clinic") + " mt-5 rounded border px-4 py-3 font-bold"}>{saveMessage}</div> : null}<button disabled={saving} className="mt-7 w-full rounded bg-clinic px-6 py-5 text-xl font-bold text-white disabled:opacity-60">{saving ? "作成中..." : isDirector ? "評価シートを作成" : "自己評価を開始"}</button></form>;
}

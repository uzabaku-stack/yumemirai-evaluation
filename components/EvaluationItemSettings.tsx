"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import type { EvaluationItem } from "@/lib/types";

type EditableItem = EvaluationItem & { local_id: string; target_roles: string[] };

function makeEditable(item: EvaluationItem): EditableItem {
  return { ...item, target_roles: item.target_roles ?? [], local_id: "item-" + item.id };
}

function newItem(order: number, section: string): EditableItem {
  const localId = "new-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  return { id: -Date.now(), local_id: localId, section_name: section || "臨床スキル評価", item_name: "", criteria: "1〜5点で評価", item_order: order, active: 1, target_roles: [] };
}

export function EvaluationItemSettings({ initialItems, initialSections, staffRoles }: { initialItems: EvaluationItem[]; initialSections: string[]; staffRoles: string[] }) {
  const [items, setItems] = useState<EditableItem[]>(() => initialItems.map(makeEditable));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const sections = useMemo(() => Array.from(new Set([...initialSections, ...items.map((item) => item.section_name)].filter(Boolean))), [initialSections, items]);

  function updateItem(localId: string, patch: Partial<EditableItem>) {
    setSaved(false);
    setItems((current) => current.map((item) => item.local_id === localId ? { ...item, ...patch } : item));
  }

  function toggleRole(localId: string, role: string) {
    setSaved(false);
    setItems((current) => current.map((item) => {
      if (item.local_id !== localId) return item;
      const targetRoles = item.target_roles.includes(role) ? item.target_roles.filter((entry) => entry !== role) : [...item.target_roles, role];
      return { ...item, target_roles: targetRoles };
    }));
  }

  function moveItem(localId: string, direction: -1 | 1) {
    setSaved(false);
    setItems((current) => {
      const index = current.findIndex((item) => item.local_id === localId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [target] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, target);
      return copy.map((item, order) => ({ ...item, item_order: order + 1 }));
    });
  }

  function addItem() {
    setSaved(false);
    setItems((current) => [...current, newItem(current.length + 1, sections[0] ?? "臨床スキル評価")]);
  }

  function deleteItem(localId: string) {
    setSaved(false);
    setItems((current) => current.filter((item) => item.local_id !== localId).map((item, order) => ({ ...item, item_order: order + 1 })));
  }

  async function save() {
    const invalid = items.find((item) => !item.item_name.trim() || !item.section_name.trim());
    if (invalid) { alert("項目名とセクションは必須です。"); return; }
    setSaving(true);
    setSaved(false);
    const response = await fetch("/api/evaluation-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((item, index) => ({ id: item.id > 0 ? item.id : undefined, section_name: item.section_name, item_name: item.item_name, criteria: item.criteria, item_order: index + 1, active: item.active ? 1 : 0, target_roles: item.target_roles })) })
    });
    if (!response.ok) { alert("保存できませんでした。"); setSaving(false); return; }
    const data = await response.json();
    setItems((data.items as EvaluationItem[]).map(makeEditable));
    setSaving(false);
    setSaved(true);
  }

  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded border border-teal-900/10 bg-white p-4 shadow-soft"><div><h2 className="text-xl font-bold">評価項目一覧</h2><p className="mt-1 text-sm text-slate-600">対象職種を未選択にすると、全職種に表示される全職種項目になります。</p></div><div className="flex flex-wrap gap-2"><button onClick={addItem} className="flex min-h-12 items-center gap-2 rounded border border-clinic px-5 py-3 font-bold text-clinic"><Plus size={20} />新規項目</button><button onClick={save} disabled={saving} className="flex min-h-12 items-center gap-2 rounded bg-clinic px-6 py-3 font-bold text-white disabled:opacity-60"><Save size={20} />{saving ? "保存中" : "保存"}</button></div>{saved ? <div className="w-full rounded bg-mint px-4 py-3 font-bold text-clinic">保存しました。</div> : null}</div><div className="space-y-4">{items.map((item, index) => <section key={item.local_id} className="rounded border border-teal-900/10 bg-white p-4 shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded bg-slate-100 text-lg font-bold">{index + 1}</span><button onClick={() => updateItem(item.local_id, { active: item.active ? 0 : 1 })} className={(item.active ? "bg-mint text-clinic" : "bg-slate-100 text-slate-500") + " flex min-h-11 items-center gap-2 rounded px-4 py-2 font-bold"}>{item.active ? <Eye size={18} /> : <EyeOff size={18} />}{item.active ? "表示" : "非表示"}</button><span className="rounded bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">{item.target_roles.length ? item.target_roles.join("・") : "全職種"}</span></div><div className="flex gap-2"><button onClick={() => moveItem(item.local_id, -1)} disabled={index === 0} className="grid h-12 w-12 place-items-center rounded border border-slate-300 disabled:opacity-30" aria-label="上へ"><ArrowUp size={20} /></button><button onClick={() => moveItem(item.local_id, 1)} disabled={index === items.length - 1} className="grid h-12 w-12 place-items-center rounded border border-slate-300 disabled:opacity-30" aria-label="下へ"><ArrowDown size={20} /></button><button onClick={() => deleteItem(item.local_id)} className="grid h-12 w-12 place-items-center rounded border border-red-200 text-red-600" aria-label="削除"><Trash2 size={20} /></button></div></div><div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]"><label className="space-y-2"><span className="font-bold">項目名</span><input value={item.item_name} onChange={(event) => updateItem(item.local_id, { item_name: event.target.value })} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" placeholder="評価項目名" /></label><label className="space-y-2"><span className="font-bold">セクション</span><input list="section-options" value={item.section_name} onChange={(event) => updateItem(item.local_id, { section_name: event.target.value })} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" placeholder="セクション名" /><datalist id="section-options">{sections.map((section) => <option key={section} value={section} />)}</datalist></label><fieldset className="space-y-2 lg:col-span-2"><legend className="font-bold">対象職種</legend><div className="flex flex-wrap gap-2"><button type="button" onClick={() => updateItem(item.local_id, { target_roles: [] })} className={(item.target_roles.length === 0 ? "bg-clinic text-white" : "bg-slate-100 text-ink") + " min-h-11 rounded px-4 py-2 font-bold"}>全職種</button>{staffRoles.map((role) => <button type="button" key={role} onClick={() => toggleRole(item.local_id, role)} className={(item.target_roles.includes(role) ? "bg-clinic text-white" : "bg-slate-100 text-ink") + " min-h-11 rounded px-4 py-2 font-bold"}>{role}</button>)}</div></fieldset><label className="space-y-2 lg:col-span-2"><span className="font-bold">説明文（評価基準）</span><textarea value={item.criteria} onChange={(event) => updateItem(item.local_id, { criteria: event.target.value })} className="min-h-32 w-full rounded border border-slate-300 p-4 text-base leading-7" placeholder="評価の目安や注意点を複数行で入力できます" /></label></div></section>)}</div><div className="sticky bottom-0 -mx-5 border-t bg-paper/95 p-4 backdrop-blur"><button onClick={save} disabled={saving} className="flex min-h-14 w-full items-center justify-center gap-2 rounded bg-clinic px-6 py-4 text-xl font-bold text-white disabled:opacity-60"><Save />{saving ? "保存中" : "評価項目を保存"}</button></div></div>;
}

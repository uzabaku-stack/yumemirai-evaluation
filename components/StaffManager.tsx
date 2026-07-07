"use client";

import { FormEvent, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, MoreVertical, Plus, Save, Trash2 } from "lucide-react";
import type { Staff, StaffRole } from "@/lib/types";

export function StaffManager({ initialStaff, initialRoles }: { initialStaff: Staff[]; initialRoles: StaffRole[] }) {
  const [staff, setStaff] = useState(initialStaff);
  const [savedStaff, setSavedStaff] = useState(initialStaff);
  const [roles, setRoles] = useState(initialRoles);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(initialRoles.find((item) => item.active)?.name ?? "その他");
  const [newRoleName, setNewRoleName] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [passwordStaffId, setPasswordStaffId] = useState<number | null>(null);

  const activeRoleNames = useMemo(() => roles.filter((item) => item.active).sort((a, b) => a.role_order - b.role_order || a.id - b.id).map((item) => item.name), [roles]);
  const filteredStaff = useMemo(() => {
    if (filterRole === "all") return staff;
    return staff.filter((person) => {
      const saved = savedStaff.find((item) => item.id === person.id);
      return person.role === filterRole || saved?.role === filterRole;
    });
  }, [filterRole, savedStaff, staff]);

  function roleChoices(currentRole: string) {
    return Array.from(new Set([...activeRoleNames, currentRole].filter(Boolean)));
  }

  function updateDraftPerson(id: number, patch: Partial<Staff>) {
    setStaff((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function hasUnsavedStaffChanges(person: Staff) {
    const saved = savedStaff.find((item) => item.id === person.id);
    return !!saved && (person.name !== saved.name || person.role !== saved.role);
  }

  async function refreshRoles() {
    const response = await fetch("/api/staff-roles");
    if (!response.ok) return;
    const data = await response.json();
    setRoles(data.roles as StaffRole[]);
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, role }) });
    if (!response.ok) {
      alert("スタッフを追加できませんでした。");
      return;
    }
    const data = await response.json();
    setStaff((current) => [...current, data.staff].sort((a, b) => a.id - b.id));
    setSavedStaff((current) => [...current, data.staff].sort((a, b) => a.id - b.id));
    setName("");
    setMessage("スタッフを追加しました。パスワードはハッシュ化され、画面には表示されません。");
    await refreshRoles();
  }

  async function updatePerson(id: number, patch: Partial<Staff>, success: string) {
    const current = staff.find((person) => person.id === id);
    if (!current) return;
    const response = await fetch("/api/staff/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: current.name, role: current.role, active: current.active, ...patch }),
    });
    if (!response.ok) {
      alert("保存できませんでした。");
      return;
    }
    const data = await response.json();
    setStaff((items) => items.map((item) => item.id === id ? data.staff : item));
    setSavedStaff((items) => items.map((item) => item.id === id ? data.staff : item));
    setMessage(success);
    await refreshRoles();
  }

  async function resetPassword(id: number) {
    const target = staff.find((person) => person.id === id);
    if (!target) return;
    if (!window.confirm(target.name + "さんのパスワードを初期化します。よろしいですか？")) return;
    const response = await fetch("/api/staff/" + id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset_password: true }) });
    if (!response.ok) {
      alert("パスワードを初期化できませんでした。");
      return;
    }
    setMessage(target.name + "さんのパスワードを初期化しました。現在のパスワードは表示されません。");
  }

  async function changeStaffPassword(id: number, password: string, confirmation: string) {
    if (password.length < 4) return "パスワードは4文字以上入力してください。";
    if (password !== confirmation) return "新しいパスワードと確認用パスワードが一致しません。";
    const response = await fetch("/api/staff/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change_password: true, password, password_confirmation: confirmation }),
    });
    if (!response.ok) return "パスワードを変更できませんでした。";
    const target = staff.find((person) => person.id === id);
    setMessage((target?.name ?? "スタッフ") + "さんのパスワードを変更しました。現在のパスワードは表示されません。");
    setPasswordStaffId(null);
    return "";
  }

  async function deletePerson(id: number) {
    const target = staff.find((person) => person.id === id);
    if (!target) return;
    const confirmText = target.has_evaluations
      ? "過去評価があるスタッフです。完全削除ではなく非表示を推奨します。完全削除を試しますか？"
      : "このスタッフを完全に削除しますか？この操作は元に戻せません。";
    if (!window.confirm(confirmText)) return;
    const response = await fetch("/api/staff/" + id, { method: "DELETE" });
    if (response.status === 409) {
      alert("過去評価があるため完全削除できません。非表示にしてください。");
      return;
    }
    if (!response.ok) {
      alert("削除できませんでした。");
      return;
    }
    setStaff((items) => items.filter((item) => item.id !== id));
    setSavedStaff((items) => items.filter((item) => item.id !== id));
    setMessage("スタッフを削除しました。");
  }

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newRoleName.trim()) return;
    const response = await fetch("/api/staff-roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newRoleName }) });
    if (!response.ok) {
      alert("職種を追加できませんでした。");
      return;
    }
    const data = await response.json();
    setRoles((current) => [...current, data.role].sort((a, b) => a.role_order - b.role_order || a.id - b.id));
    setNewRoleName("");
    setMessage("職種を追加しました。");
  }

  async function updateRole(id: number, patch: Partial<StaffRole>) {
    const current = roles.find((item) => item.id === id);
    if (!current) return;
    const response = await fetch("/api/staff-roles/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: current.name, active: current.active, ...patch }),
    });
    if (!response.ok) {
      alert("職種を保存できませんでした。");
      return;
    }
    const data = await response.json();
    setRoles((items) => items.map((item) => item.id === id ? data.role : item));
    if (patch.name && current.name !== patch.name) setStaff((items) => items.map((person) => person.role === current.name ? { ...person, role: patch.name ?? person.role } : person));
    if (patch.name && current.name !== patch.name) setSavedStaff((items) => items.map((person) => person.role === current.name ? { ...person, role: patch.name ?? person.role } : person));
    setMessage("職種を保存しました。");
  }

  async function deleteRole(id: number) {
    const target = roles.find((item) => item.id === id);
    if (!target) return;
    if (!window.confirm("この職種を削除しますか？使用中の職種は削除できません。")) return;
    const response = await fetch("/api/staff-roles/" + id, { method: "DELETE" });
    if (response.status === 409) {
      alert("使用中の職種は削除できません。先にスタッフや評価項目から外してください。");
      return;
    }
    if (!response.ok) {
      alert("職種を削除できませんでした。");
      return;
    }
    setRoles((items) => items.filter((item) => item.id !== id));
    if (filterRole === target.name) setFilterRole("all");
    setMessage("職種を削除しました。");
  }

  return (
    <div className="space-y-5">
      <form onSubmit={addStaff} className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 space-y-2">
            <span className="font-bold">スタッフ名</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" placeholder="例：山田" />
          </label>
          <label className="min-w-56 flex-1 space-y-2">
            <span className="font-bold">職種</span>
            <select value={role} onChange={(event) => setRole(event.target.value)} className="h-14 w-full rounded border border-slate-300 px-4 text-lg">
              {activeRoleNames.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button className="flex min-h-14 items-center gap-2 rounded bg-clinic px-6 py-4 text-lg font-bold text-white"><Plus />スタッフ追加</button>
        </div>
        <p className="mt-3 text-sm text-slate-500">追加したスタッフにはログインIDが自動発行されます。パスワードはハッシュ化され、画面には表示されません。</p>
      </form>

      {message ? <div className="rounded border border-teal-200 bg-mint px-5 py-4 font-bold text-clinic shadow-soft">{message}</div> : null}

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">職種編集</h2>
            <p className="mt-1 text-sm text-slate-600">スタッフと評価項目で使用する職種を管理します。</p>
          </div>
          <form onSubmit={addRole} className="flex flex-wrap gap-2">
            <input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} className="h-12 min-w-52 rounded border border-slate-300 px-4" placeholder="新しい職種" />
            <button className="flex min-h-12 items-center gap-2 rounded border border-clinic px-4 py-3 font-bold text-clinic"><Plus size={18} />追加</button>
          </form>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {roles.map((item) => (
            <div key={item.id} className="rounded border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input value={item.name} onChange={(event) => setRoles((current) => current.map((roleItem) => roleItem.id === item.id ? { ...roleItem, name: event.target.value } : roleItem))} className="h-12 min-w-0 flex-1 rounded border border-slate-300 px-3 font-bold" />
                <button onClick={() => updateRole(item.id, { active: item.active ? 0 : 1 })} className={(item.active ? "bg-mint text-clinic" : "bg-slate-100 text-slate-500") + " min-h-12 rounded px-3 py-2 font-bold"}>{item.active ? "表示" : "非表示"}</button>
                <button onClick={() => updateRole(item.id, { name: item.name })} className="grid h-12 w-12 place-items-center rounded bg-clinic text-white" aria-label="保存"><Save size={18} /></button>
                <button onClick={() => deleteRole(item.id)} className="grid h-12 w-12 place-items-center rounded border border-red-200 text-red-600" aria-label="削除"><Trash2 size={18} /></button>
              </div>
              {item.has_staff || item.has_items ? <p className="mt-2 text-xs text-slate-500">使用中の職種です。削除する場合は先にスタッフや評価項目から外してください。</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">スタッフ一覧</h2>
          <label className="flex flex-wrap items-center gap-2 font-bold">
            職種で絞り込み
            <select value={filterRole} onChange={(event) => setFilterRole(event.target.value)} className="h-12 rounded border border-slate-300 px-3">
              <option value="all">全職種</option>
              {activeRoleNames.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-4">
          {filteredStaff.map((person) => (
            <section key={person.id} className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={(person.active ? "bg-mint text-clinic" : "bg-slate-100 text-slate-500") + " rounded px-3 py-2 text-sm font-bold"}>{person.active ? "表示中" : "非表示"}</span>
                    <span className="rounded bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{person.role}</span>
                    <span className="rounded bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">ログインID: staff-{person.id}</span>
                    {person.has_evaluations ? <span className="rounded bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">過去評価あり</span> : null}
                  </div>
                </div>
                <div className="flex max-w-full flex-wrap justify-end gap-2">
                  <button onClick={() => resetPassword(person.id)} className="flex min-h-12 items-center gap-2 rounded border border-clinic px-4 py-3 font-bold text-clinic"><KeyRound size={18} />初期化</button>
                  <button onClick={() => setPasswordStaffId(passwordStaffId === person.id ? null : person.id)} className="flex min-h-12 items-center gap-2 rounded bg-clinic px-4 py-3 font-bold text-white"><KeyRound size={18} />パスワード変更</button>
                  <button onClick={() => updatePerson(person.id, { active: person.active ? 0 : 1 }, person.active ? "スタッフを非表示にしました。" : "スタッフを表示しました。")} className="flex min-h-12 items-center gap-2 rounded border border-clinic px-4 py-3 font-bold text-clinic">
                    {person.active ? <EyeOff size={18} /> : <Eye size={18} />}{person.active ? "非表示" : "表示"}
                  </button>
                  <details className="relative">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded border border-slate-300 px-4 py-3 font-bold text-slate-700"><MoreVertical size={18} />その他</summary>
                    <div className="mt-2 rounded border border-red-100 bg-white p-2 shadow-soft sm:absolute sm:right-0 sm:z-10 sm:min-w-48">
                      <button onClick={() => deletePerson(person.id)} className="flex min-h-12 w-full items-center gap-2 rounded px-3 py-2 text-left font-bold text-red-600 hover:bg-red-50"><Trash2 size={18} />完全削除</button>
                    </div>
                  </details>
                </div>
              </div>

              {passwordStaffId === person.id ? <PasswordChangeForm staffId={person.id} onChangePassword={changeStaffPassword} /> : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="font-bold">スタッフ名</span>
                  <input value={person.name} onChange={(event) => updateDraftPerson(person.id, { name: event.target.value })} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" />
                </label>
                <label className="space-y-2">
                  <span className="font-bold">職種</span>
                  <select value={person.role} onChange={(event) => updateDraftPerson(person.id, { role: event.target.value })} className="h-14 w-full rounded border border-slate-300 px-4 text-lg">
                    {roleChoices(person.role).map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div><dt className="text-slate-500">最新評価日</dt><dd className="mt-1 font-semibold">{person.latest_date ?? "未評価"}</dd></div>
                  <div><dt className="text-slate-500">最新スコア</dt><dd className="mt-1 font-semibold">{person.latest_score ? person.latest_score.toFixed(2) : "-"}</dd></div>
                </dl>
                <button onClick={() => updatePerson(person.id, { name: person.name, role: person.role }, "スタッフ情報を保存しました。")} disabled={!hasUnsavedStaffChanges(person)} className="flex min-h-12 items-center gap-2 rounded bg-clinic px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Save size={18} />保存</button>
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function PasswordChangeForm({ staffId, onChangePassword }: { staffId: number; onChangePassword: (id: number, password: string, confirmation: string) => Promise<string> }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const message = await onChangePassword(staffId, password, confirmation);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setPassword("");
    setConfirmation("");
    setError("");
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded border border-clinic/20 bg-mint/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">パスワード変更</h3>
          <p className="mt-1 text-sm text-slate-600">現在のパスワード: ********</p>
        </div>
        <KeyRound className="text-clinic" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="font-bold">新しいパスワード</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" minLength={4} autoComplete="new-password" />
        </label>
        <label className="space-y-2">
          <span className="font-bold">新しいパスワード確認</span>
          <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-14 w-full rounded border border-slate-300 px-4 text-lg" minLength={4} autoComplete="new-password" />
        </label>
      </div>
      {error ? <p className="mt-3 rounded bg-red-50 px-4 py-3 font-bold text-red-700">{error}</p> : null}
      <button disabled={saving} className="mt-4 flex min-h-12 items-center gap-2 rounded bg-clinic px-5 py-3 font-bold text-white disabled:opacity-60"><Save size={18} />{saving ? "変更中..." : "変更"}</button>
    </form>
  );
}

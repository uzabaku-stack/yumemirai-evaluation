"use client";

import { KeyRound, Save } from "lucide-react";
import { FormEvent, useState } from "react";

export function DirectorPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 4) {
      setError("パスワードは4文字以上入力してください。");
      return;
    }
    if (password !== confirmation) {
      setError("新しいパスワードと確認用パスワードが一致しません。");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/director-password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, password_confirmation: confirmation }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("パスワードを変更できませんでした。");
      return;
    }
    setPassword("");
    setConfirmation("");
    setMessage("院長パスワードを変更しました。現在のパスワードは表示されません。");
  }

  return (
    <form onSubmit={submit} className="rounded border border-teal-900/10 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">院長パスワード変更</h2>
          <p className="mt-1 text-sm text-slate-600">現在のパスワード: ********</p>
        </div>
        <KeyRound className="text-clinic" />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="font-bold">新しいパスワード</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={4} autoComplete="new-password" className="h-14 w-full rounded border border-slate-300 px-4 text-lg" />
        </label>
        <label className="space-y-2">
          <span className="font-bold">新しいパスワード確認</span>
          <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={4} autoComplete="new-password" className="h-14 w-full rounded border border-slate-300 px-4 text-lg" />
        </label>
      </div>
      {error ? <p className="mt-4 rounded bg-red-50 px-4 py-3 font-bold text-red-700">{error}</p> : null}
      {message ? <p className="mt-4 rounded border border-teal-200 bg-mint px-4 py-3 font-bold text-clinic">{message}</p> : null}
      <button disabled={saving} className="mt-5 flex min-h-14 items-center gap-2 rounded bg-clinic px-6 py-4 text-lg font-bold text-white disabled:opacity-60"><Save size={20} />{saving ? "変更中..." : "変更"}</button>
    </form>
  );
}

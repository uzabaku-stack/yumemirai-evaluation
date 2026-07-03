"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import type { CurrentUser } from "@/lib/types";

function isDirectorRole(role: string | null | undefined) {
  return role === "director" || role === "admin" || role === "owner";
}

export function LoginForm({ users }: { users: CurrentUser[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData.entries())) });
    if (!response.ok) {
      setError("ログインIDまたはパスワードが正しくありません。");
      setSaving(false);
      return;
    }
    router.push("/");
    router.refresh();
  }
  return <form onSubmit={submit} className="mx-auto max-w-lg rounded border border-teal-900/10 bg-white p-6 shadow-soft"><div className="space-y-5"><label className="space-y-2"><span className="font-bold">ログインID</span><select name="login_id" className="h-14 w-full rounded border border-slate-300 px-4 text-lg">{users.map((user) => <option key={user.login_id} value={user.login_id}>{user.name}（{isDirectorRole(user.role) ? "院長" : "スタッフ"} / {user.login_id}）</option>)}</select></label><label className="space-y-2"><span className="font-bold">パスワード</span><input name="password" type="password" className="h-14 w-full rounded border border-slate-300 px-4 text-lg" placeholder="パスワードを入力" required /></label>{error ? <p className="rounded bg-red-50 px-4 py-3 font-semibold text-red-700">{error}</p> : null}<button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded bg-clinic px-6 py-5 text-xl font-bold text-white disabled:opacity-60"><LogIn />{saving ? "ログイン中..." : "ログイン"}</button><p className="text-sm text-slate-500">パスワードは保存時にハッシュ化され、画面には表示されません。</p></div></form>;
}

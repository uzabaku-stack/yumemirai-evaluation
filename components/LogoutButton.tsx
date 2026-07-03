"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return <button onClick={logout} className="flex items-center gap-2 rounded border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-50"><LogOut size={18} />ログアウト</button>;
}

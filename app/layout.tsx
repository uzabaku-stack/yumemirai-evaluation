import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import "./globals.css";

export const metadata: Metadata = { title: "ゆめみらい業務評価アプリ", description: "業務評価シート記入アプリ" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <html lang="ja"><body>{children}</body></html>;
  return <html lang="ja"><body><header className="no-print border-b border-teal-900/10 bg-white/85 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4"><Link href="/" className="flex items-center gap-3 text-xl font-bold text-ink"><span className="grid h-11 w-11 place-items-center rounded bg-clinic text-white"><ClipboardCheck size={24} /></span><span>ゆめみらい業務評価</span></Link><nav className="flex flex-wrap items-center gap-2 text-sm font-semibold"><Link className="rounded px-4 py-3 hover:bg-mint" href="/evaluations/new">{user.role === "director" ? "新規評価" : "自己評価"}</Link>{user.role === "director" ? <Link className="rounded px-4 py-3 hover:bg-mint" href="/staff">スタッフ</Link> : null}{user.role === "director" ? <Link className="rounded px-4 py-3 hover:bg-mint" href="/evaluation-items">評価項目</Link> : null}{user.role === "director" ? <Link className="rounded px-4 py-3 hover:bg-mint" href="/rating-criteria">評価基準</Link> : null}<span className="rounded bg-mint px-3 py-2 text-clinic">{user.name}</span><LogoutButton /></nav></div></header><main className="mx-auto max-w-6xl px-5 py-6">{children}</main></body></html>;
}

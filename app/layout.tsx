import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentUser } from "@/lib/auth";
import { isDirectorRole } from "@/lib/permissions";
import "./globals.css";

export const metadata: Metadata = {
  title: "ゆめみらい業務評価アプリ",
  description: "業務評価シート記入アプリ",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <html lang="ja"><body>{children}</body></html>;

  const isDirector = isDirectorRole(user.role);
  const navItems = isDirector
    ? [
        { label: "スタッフ", href: "/staff" },
        { label: "評価管理", href: "/director-evaluation" },
        { label: "評価結果", href: "/360/results" },
        { label: "賞与計算", href: "/bonus" },
      ]
    : [
        { label: "360°評価", href: "/360" },
        { label: "入力済み評価", href: "/my-evaluations" },
      ];

  return (
    <html lang="ja">
      <body>
        <header className="no-print border-b border-teal-900/10 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
            <Link href="/" className="flex items-center gap-3 text-xl font-bold text-ink">
              <span className="grid h-11 w-11 place-items-center rounded bg-clinic text-white"><ClipboardCheck size={24} /></span>
              <span>ゆめみらい業務評価</span>
            </Link>
            <nav className="flex flex-wrap items-center justify-end gap-2 text-sm font-semibold">
              {navItems.map((item) => (
                <Link key={item.href} className="rounded px-4 py-3 hover:bg-mint" href={item.href}>{item.label}</Link>
              ))}
              <span className="rounded bg-mint px-3 py-2 text-clinic">{user.name}</span>
              <LogoutButton />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
      </body>
    </html>
  );
}

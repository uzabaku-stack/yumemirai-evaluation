import Link from "next/link";
import { redirect } from "next/navigation";
import { DirectorPasswordForm } from "@/components/DirectorPasswordForm";
import { getCurrentUser } from "@/lib/auth";
import { isDirectorRole } from "@/lib/permissions";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">院長設定</h1><p className="mt-2 text-slate-600">院長アカウントのパスワードを変更できます。</p></div><Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link></div>
    <DirectorPasswordForm />
  </div>;
}

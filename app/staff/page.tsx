import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAllStaffList, getAllStaffRoles } from "@/lib/db";
import { StaffManager } from "@/components/StaffManager";
import { isDirectorRole } from "@/lib/permissions";

export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">スタッフ管理</h1><p className="mt-2 text-slate-600">スタッフの追加、職種編集、表示状態、職種マスターを管理できます。</p></div><Link href="/evaluations/new" className="rounded bg-clinic px-6 py-4 font-bold text-white">新規評価</Link></div><StaffManager initialStaff={getAllStaffList()} initialRoles={getAllStaffRoles()} /></div>;
}

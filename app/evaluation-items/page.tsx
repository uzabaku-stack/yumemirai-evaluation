import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAllEvaluationItems, getSectionNames, getStaffRoles } from "@/lib/db";
import { EvaluationItemSettings } from "@/components/EvaluationItemSettings";
import { isDirectorRole } from "@/lib/permissions";

export default async function EvaluationItemsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");
  return <div className="space-y-5"><div><h1 className="text-3xl font-bold">評価項目設定</h1><p className="mt-2 text-slate-600">項目名、評価基準、セクション、対象職種、表示状態、並び順を編集できます。</p></div><EvaluationItemSettings initialItems={getAllEvaluationItems()} initialSections={getSectionNames()} staffRoles={getStaffRoles()} /></div>;
}

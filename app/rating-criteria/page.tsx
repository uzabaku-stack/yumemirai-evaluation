import { redirect } from "next/navigation";
import { RatingCriteriaSettings } from "@/components/RatingCriteriaSettings";
import { getCurrentUser } from "@/lib/auth";
import { getRatingCriteria } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export default async function RatingCriteriaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");
  return <div className="space-y-5"><div><h1 className="text-3xl font-bold">評価基準設定</h1><p className="mt-2 text-slate-600">1点〜5点の全体共通の説明文を編集できます。</p></div><RatingCriteriaSettings initialCriteria={getRatingCriteria()} /></div>;
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStaffList } from "@/lib/db";
import { NewEvaluationForm } from "./NewEvaluationForm";
import { isDirectorRole } from "@/lib/permissions";

export default async function NewEvaluationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/360");
  const staff = getStaffList();
  return <div className="space-y-5"><h1 className="text-3xl font-bold">新規評価作成</h1><Suspense><NewEvaluationForm staff={staff} user={user} /></Suspense></div>;
}

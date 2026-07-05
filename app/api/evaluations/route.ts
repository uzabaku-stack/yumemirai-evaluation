import { NextResponse } from "next/server";
import { canCreateEvaluationFor, getCurrentUser } from "@/lib/auth";
import { createEvaluation, getEvaluation } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const requestedStaffId = Number(body.staff_id);
    const requestedType = body.evaluation_type === "self" ? "self" : "other";
    const staffId = isDirectorRole(user.role) ? requestedStaffId : user.staff_id;
    const evaluationType = isDirectorRole(user.role) ? requestedType : "self";
    if (!staffId || !canCreateEvaluationFor(user, staffId, evaluationType)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    const id = await createEvaluation({ staff_id: staffId, evaluator_name: isDirectorRole(user.role) ? (body.evaluator_name || "") : user.name, evaluation_type: evaluationType, evaluation_month: body.evaluation_month || "", entry_date: body.entry_date || "" });
    return NextResponse.json({ success: true, id, evaluation: getEvaluation(id) });
  } catch (error) {
    console.error("evaluations POST failed", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "保存できませんでした" }, { status: 400 });
  }
}

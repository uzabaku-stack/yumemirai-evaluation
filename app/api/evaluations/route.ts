import { NextResponse } from "next/server";
import { canCreateEvaluationFor, getCurrentUser } from "@/lib/auth";
import { createEvaluation, getEvaluation, updateEvaluation } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

function evaluationTypeFor360(user: Awaited<ReturnType<typeof getCurrentUser>>, staffId: number) {
  if (!user) return "peer";
  if (isDirectorRole(user.role)) return "director";
  return user.staff_id === staffId ? "self" : "peer";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const requestedStaffId = Number(body.staff_id);
    const is360 = body.is_360 === 1 || body.is_360 === true || body.is_360 === "1";
    const staffId = isDirectorRole(user.role) ? requestedStaffId : (is360 ? requestedStaffId : user.staff_id);
    if (!staffId || !Number.isFinite(staffId)) return NextResponse.json({ success: false, error: "staff_id_required" }, { status: 400 });

    const requestedType = body.evaluation_type === "self" || body.evaluation_type === "peer" || body.evaluation_type === "director" || body.evaluation_type === "other" ? body.evaluation_type : "other";
    const evaluationType = is360 ? evaluationTypeFor360(user, staffId) : (isDirectorRole(user.role) ? requestedType : "self");

    if (!is360 && !canCreateEvaluationFor(user, staffId, evaluationType)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (is360 && !isDirectorRole(user.role) && user.staff_id === null) return NextResponse.json({ success: false, error: "staff_user_required" }, { status: 403 });

    const id = await createEvaluation({
      staff_id: staffId,
      evaluator_name: body.evaluator_name || user.name,
      evaluation_type: evaluationType,
      evaluation_month: body.evaluation_month || "",
      entry_date: body.entry_date || new Date().toISOString().slice(0, 10),
      evaluator_user_id: is360 ? user.id : undefined,
      evaluator_staff_id: is360 ? user.staff_id : undefined,
      is_360: is360 ? 1 : 0,
      evaluation_cycle_id: body.evaluation_cycle_id === undefined || body.evaluation_cycle_id === null || body.evaluation_cycle_id === "" ? undefined : Number(body.evaluation_cycle_id),
    });

    let summary = null;
    if (Array.isArray(body.scores) || body.comments) summary = await updateEvaluation(id, { scores: body.scores ?? [], comments: body.comments });
    return NextResponse.json({ success: true, id, evaluation: getEvaluation(id), summary });
  } catch (error) {
    console.error("evaluations POST failed", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "保存できませんでした" }, { status: 400 });
  }
}

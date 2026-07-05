import { NextResponse } from "next/server";
import { canEditEvaluation, getCurrentUser } from "@/lib/auth";
import { deleteEvaluation, getEvaluation, refreshStoreFromRemote, updateEvaluation } from "@/lib/db";
import { isDirectorRole as hasDirectorRole } from "@/lib/permissions";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  console.error("evaluations PUT start", {
    id: resolvedParams.id,
    cookie: request.headers.get("cookie"),
    authorization: request.headers.get("authorization"),
  });
  const currentUser = await getCurrentUser();
  const loginUser = currentUser;
  console.error("evaluations PUT auth", {
    currentUser,
    loginUser,
  });
  if (!currentUser) {
    const reason = "current_user_missing";
    console.error("evaluations PUT unauthorized", {
      reason,
      currentUser,
      loginUser,
    });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const user = currentUser;
  const { id } = resolvedParams;
  await refreshStoreFromRemote();
  const evaluation = getEvaluation(Number(id));
  const canEdit = evaluation ? canEditEvaluation(user, evaluation) : false;
  if (!evaluation || !canEdit) {
    const reason = !evaluation ? "evaluation_not_found" : "can_edit_evaluation_false";
    const isSelfEvaluationForLoginStaff = evaluation ? evaluation.evaluation_type === "self" && evaluation.staff_id === user.staff_id : false;
    const evaluatorUserIdMatches = evaluation ? evaluation.evaluator_user_id !== null && evaluation.evaluator_user_id !== undefined && evaluation.evaluator_user_id === user.id : false;
    const evaluatorStaffIdMatches = evaluation ? evaluation.evaluator_staff_id !== null && evaluation.evaluator_staff_id !== undefined && user.staff_id !== null && evaluation.evaluator_staff_id === user.staff_id : false;
    const is360 = evaluation ? evaluation.is_360 === 1 : false;
    const isDirectorRole = hasDirectorRole(user.role);
    console.error("evaluations PUT forbidden", {
      reason,
      currentUser,
      loginUser,
      evaluation,
      evaluator_user_id: evaluation?.evaluator_user_id,
      evaluator_staff_id: evaluation?.evaluator_staff_id,
      isDirectorRole,
      isSelfEvaluationForLoginStaff,
      evaluatorUserIdMatches,
      evaluatorStaffIdMatches,
      is360,
    });
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  try {
    const summary = await updateEvaluation(Number(id), { scores: body.scores ?? [], comments: body.comments });
    const updatedEvaluation = getEvaluation(Number(id));
    return NextResponse.json({ success: true, evaluation: updatedEvaluation, summary });
  } catch (error) {
    console.error("evaluations PUT failed", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "保存できませんでした" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasDirectorRole(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await refreshStoreFromRemote();
  const evaluation = getEvaluation(Number(id));
  if (!evaluation) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await deleteEvaluation(evaluation.id);
  return NextResponse.json({ success: true });
}

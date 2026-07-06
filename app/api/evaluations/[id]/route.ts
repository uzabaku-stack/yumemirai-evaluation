import { NextResponse } from "next/server";
import { canEditEvaluation, getCurrentUser } from "@/lib/auth";
import { deleteEvaluation, getEvaluation, refreshStoreFromRemote, updateEvaluation } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await refreshStoreFromRemote();
  const evaluation = getEvaluation(Number(id));
  const canEdit = evaluation ? canEditEvaluation(user, evaluation) : false;

  if (!evaluation || !canEdit) {
    const reason = !evaluation ? "evaluation_not_found" : "can_edit_evaluation_false";
    if (reason === "evaluation_not_found") return NextResponse.json({ success: false, error: "evaluation_not_found", reason }, { status: 404 });
    return NextResponse.json({ success: false, error: "Forbidden", reason }, { status: 403 });
  }

  try {
    const body = await request.json();
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
  if (!isDirectorRole(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await refreshStoreFromRemote();
  const evaluation = getEvaluation(Number(id));
  if (!evaluation) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await deleteEvaluation(evaluation.id);
  return NextResponse.json({ success: true });
}

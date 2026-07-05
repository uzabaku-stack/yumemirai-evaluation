import { NextResponse } from "next/server";
import { canEditEvaluation, getCurrentUser } from "@/lib/auth";
import { deleteEvaluation, getEvaluation, updateEvaluation } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const evaluation = getEvaluation(Number(id));
  if (!evaluation || !canEditEvaluation(user, evaluation)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const summary = await updateEvaluation(Number(id), { scores: body.scores ?? [], comments: body.comments });
  return NextResponse.json(summary);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const evaluation = getEvaluation(Number(id));
  if (!evaluation) return NextResponse.json({ message: "Not found" }, { status: 404 });
  await deleteEvaluation(evaluation.id);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteStaffRole, updateStaffRole } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  try {
    const role = updateStaffRole(Number(id), { name: body.name, active: body.active });
    return NextResponse.json({ role });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存できませんでした" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const result = deleteStaffRole(Number(id));
  if (!result.deleted && result.reason === "in_use") return NextResponse.json({ message: "使用中の職種は削除できません。先にスタッフや評価項目から外してください。" }, { status: 409 });
  if (!result.deleted) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

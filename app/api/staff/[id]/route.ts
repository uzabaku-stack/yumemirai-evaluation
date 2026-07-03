import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteStaff, resetStaffPassword, updateStaff } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "director") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  if (body.reset_password) {
    resetStaffPassword(Number(id));
    return NextResponse.json({ ok: true });
  }
  const staff = updateStaff(Number(id), { name: body.name, role: body.role, active: body.active });
  return NextResponse.json({ staff });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "director") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const result = deleteStaff(Number(id));
  if (!result.deleted && result.reason === "has_evaluations") {
    return NextResponse.json({ message: "過去評価があるため、完全削除ではなく非表示を推奨します。" }, { status: 409 });
  }
  if (!result.deleted) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { changeStaffPassword, deleteStaff, resetStaffPassword, updateStaff } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  if (body.reset_password) {
    await resetStaffPassword(Number(id));
    return NextResponse.json({ ok: true });
  }
  if (body.change_password) {
    try {
      await changeStaffPassword(Number(id), String(body.password ?? ""), String(body.password_confirmation ?? ""));
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "password_error";
      const status = message === "user_not_found" ? 404 : 400;
      return NextResponse.json({ message }, { status });
    }
  }
  const staff = await updateStaff(Number(id), { name: body.name, role: body.role, active: body.active });
  return NextResponse.json({ staff });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const result = await deleteStaff(Number(id));
  if (!result.deleted && result.reason === "has_evaluations") {
    return NextResponse.json({ message: "過去評価があるため、完全削除ではなく非表示を推奨します。" }, { status: 409 });
  }
  if (!result.deleted) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { changeUserPassword } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json();
  try {
    changeUserPassword(user.id, String(body.password ?? ""), String(body.password_confirmation ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "password_error";
    const status = message === "user_not_found" ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }
}

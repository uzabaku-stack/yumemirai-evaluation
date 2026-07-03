import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createStaffRole, getAllStaffRoles } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "director") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json({ roles: getAllStaffRoles() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "director") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json();
  try {
    const role = createStaffRole({ name: String(body.name ?? "") });
    return NextResponse.json({ role });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存できませんでした" }, { status: 400 });
  }
}

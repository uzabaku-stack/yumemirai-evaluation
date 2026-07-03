import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createStaff, getAllStaffList } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "director") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json({ staff: getAllStaffList() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "director") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const staff = createStaff({ name: String(body.name ?? ""), role: String(body.role ?? "") });
  return NextResponse.json({ staff });
}

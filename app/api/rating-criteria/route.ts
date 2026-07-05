import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRatingCriteria, saveRatingCriteria } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json({ criteria: getRatingCriteria() });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const criteria = Array.isArray(body.criteria) ? body.criteria : [];
  return NextResponse.json({ criteria: await saveRatingCriteria(criteria) });
}

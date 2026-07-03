import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { copyEvaluationCycle } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";
import type { EvaluationCycleStatus } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const cycle = copyEvaluationCycle(Number(id), { name: String(body.name ?? ""), startDate: String(body.startDate ?? ""), endDate: String(body.endDate ?? ""), status: body.status as EvaluationCycleStatus });
  return NextResponse.json({ cycle });
}

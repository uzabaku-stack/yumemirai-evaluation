import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createEvaluationCycle, getEvaluationCycles } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";
import type { EvaluationCycleStatus } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json({ cycles: getEvaluationCycles() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const cycle = createEvaluationCycle({ name: String(body.name ?? ""), startDate: String(body.startDate ?? ""), endDate: String(body.endDate ?? ""), status: body.status as EvaluationCycleStatus });
  return NextResponse.json({ cycle });
}

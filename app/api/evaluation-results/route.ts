import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEvaluationResultSnapshots, saveEvaluationResultSnapshot } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json({ snapshots: getEvaluationResultSnapshots() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const snapshot = await saveEvaluationResultSnapshot({
    evaluation_cycle_id: body.evaluation_cycle_id === undefined || body.evaluation_cycle_id === null || body.evaluation_cycle_id === "" ? null : Number(body.evaluation_cycle_id),
    name: String(body.name ?? ""),
    results: body.results && typeof body.results === "object" ? body.results : {},
  });
  return NextResponse.json({ success: true, snapshot });
}

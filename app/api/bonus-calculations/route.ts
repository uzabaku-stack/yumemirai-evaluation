import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBonusCalculations, saveBonusCalculation } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";
import type { BonusCalculationMode } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json({ calculations: getBonusCalculations() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const calculation = await saveBonusCalculation({
    id: body.id === undefined || body.id === null || body.id === "" ? null : Number(body.id),
    evaluation_cycle_id: body.evaluation_cycle_id === undefined || body.evaluation_cycle_id === null || body.evaluation_cycle_id === "" ? null : Number(body.evaluation_cycle_id),
    name: String(body.name ?? ""),
    mode: body.mode as BonusCalculationMode,
    total_pool: String(body.total_pool ?? ""),
    rows: body.rows && typeof body.rows === "object" ? body.rows : {},
  });
  return NextResponse.json({ success: true, calculation });
}

import { NextResponse } from "next/server";
import { canCreateEvaluationFor, getCurrentUser } from "@/lib/auth";
import { createEvaluation } from "@/lib/db";
import { isDirectorRole } from "@/lib/permissions";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDirectorRole(user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const requestedStaffId = Number(body.staff_id);
  const requestedType = body.evaluation_type === "self" ? "self" : "other";
  const staffId = isDirectorRole(user.role) ? requestedStaffId : user.staff_id;
  const evaluationType = isDirectorRole(user.role) ? requestedType : "self";
  if (!staffId || !canCreateEvaluationFor(user, staffId, evaluationType)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const id = createEvaluation({ staff_id: staffId, evaluator_name: isDirectorRole(user.role) ? (body.evaluator_name || "") : user.name, evaluation_type: evaluationType, evaluation_month: body.evaluation_month || "", entry_date: body.entry_date || "" });
  return NextResponse.json({ id });
}

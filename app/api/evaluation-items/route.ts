import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAllEvaluationItems, saveEvaluationItems } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "director") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json({ items: getAllEvaluationItems() });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.role !== "director") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const items = Array.isArray(body.items) ? body.items : [];
  return NextResponse.json({ items: saveEvaluationItems(items) });
}

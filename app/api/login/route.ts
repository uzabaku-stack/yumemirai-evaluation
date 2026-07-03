import { NextResponse } from "next/server";
import { AUTH_COOKIE, createSessionToken } from "@/lib/auth";
import { validateLogin } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const user = validateLogin(String(body.login_id ?? ""), String(body.password ?? ""));
  if (!user) return NextResponse.json({ message: "ログイン情報が正しくありません。" }, { status: 401 });
  const response = NextResponse.json({ ok: true, user });
  response.cookies.set(AUTH_COOKIE, createSessionToken(user), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}

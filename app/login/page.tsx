import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLoginUsers } from "@/lib/db";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return <main className="mx-auto flex min-h-screen max-w-6xl items-center px-5 py-10"><div className="w-full space-y-6"><div className="text-center"><h1 className="text-3xl font-bold text-ink">ゆめみらい業務評価</h1><p className="mt-2 text-slate-600">ログインしてください</p></div><LoginForm users={getLoginUsers()} /></div></main>;
}

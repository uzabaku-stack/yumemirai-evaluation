import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLoginUsers } from "@/lib/db";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 sm:px-5 sm:py-10">
      <div className="w-full space-y-5 sm:space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">ゆめみらい業務評価</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">ログインしてください</p>
        </div>
        <LoginForm users={getLoginUsers()} />
      </div>
    </main>
  );
}

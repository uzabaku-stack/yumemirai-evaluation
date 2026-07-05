import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, MessageSquareText, UsersRound } from "lucide-react";
import { EvaluationCommentForm } from "@/components/EvaluationCommentForm";
import { getCurrentUser } from "@/lib/auth";
import { getEvaluation, getOrCreate360Evaluation, getStaffList } from "@/lib/db";
import { parseComments } from "@/lib/scoring";
import { isDirectorRole } from "@/lib/permissions";

const directorFields = ["総合所見", "強み", "課題", "期待すること", "来期目標"];
type Tab = "director" | "360" | "status";

function tabLink(tab: Tab, current: Tab, label: string) {
  return (
    <Link href={"/director-evaluation?tab=" + tab} className={(current === tab ? "bg-clinic text-white" : "border border-clinic bg-white text-clinic") + " rounded px-5 py-3 font-bold"}>
      {label}
    </Link>
  );
}

function ActionCard({ href, icon, title, description, primary }: { href: string; icon: React.ReactNode; title: string; description: string; primary?: boolean }) {
  return (
    <Link href={href} className={(primary ? "border-clinic/30 bg-mint/70" : "border-teal-900/10 bg-white") + " block rounded border p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"}>
      <div className="flex items-start gap-4">
        <div className={(primary ? "bg-clinic text-white" : "bg-slate-100 text-clinic") + " grid h-12 w-12 shrink-0 place-items-center rounded"}>{icon}</div>
        <div>
          <h2 className="text-xl font-bold text-ink">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </Link>
  );
}

export default async function DirectorEvaluationCommentPage({ searchParams }: { searchParams?: Promise<{ saved?: string; tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isDirectorRole(user.role)) redirect("/");
  const query = searchParams ? await searchParams : {};
  const tab: Tab = query.tab === "360" || query.tab === "status" ? query.tab : "director";
  const targets = await Promise.all(getStaffList().map(async (staff) => {
    const evaluationId = await getOrCreate360Evaluation(user, staff.id);
    const evaluation = getEvaluation(evaluationId);
    if (!evaluation) throw new Error("Evaluation not found");
    return { staff, evaluation, comments: parseComments(evaluation.comments) };
  }));

  return (
    <div className="space-y-5">
      <section className="rounded border border-teal-900/10 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-clinic">評価管理</p>
            <h1 className="mt-2 text-3xl font-bold text-ink">院長評価・360°評価・回答状況</h1>
            <p className="mt-2 text-slate-600">院長評価の入力・編集、360°評価の確認・入力、回答状況の確認をここから行います。</p>
          </div>
          <Link href="/" className="rounded border border-clinic px-5 py-4 font-bold text-clinic">トップへ戻る</Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {tabLink("director", tab, "院長評価")}
          {tabLink("360", tab, "360°評価")}
          {tabLink("status", tab, "回答状況")}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ActionCard href="/director-evaluation?tab=director" icon={<MessageSquareText size={24} />} title="院長評価の入力・編集" description="スタッフごとの院長評価コメントを入力・編集します。" primary={tab === "director"} />
        <ActionCard href="/360" icon={<UsersRound size={24} />} title="360°評価の確認・入力" description="横並び表形式で全スタッフの360°評価を入力します。" primary={tab === "360"} />
        <ActionCard href="/360/results" icon={<ClipboardList size={24} />} title="回答状況の確認" description="評価期間ごとの入力状況や結果を確認します。" primary={tab === "status"} />
      </section>

      {query.saved === "1" ? <div className="rounded border border-teal-200 bg-mint px-5 py-4 font-bold text-clinic shadow-soft">院長評価コメントを保存しました。</div> : null}

      {tab === "director" ? (
        <EvaluationCommentForm user={user} targets={targets} fields={directorFields} title="院長評価コメント" description="院長評価のコメントを入力します。点数は360°評価入力画面で保存します。" backHref="/director-evaluation" />
      ) : null}

      {tab === "360" ? (
        <section className="rounded border border-teal-900/10 bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-bold">360°評価</h2>
          <p className="mt-2 text-slate-600">全スタッフを横並び表形式で評価できます。院長が入力する場合は院長評価として保存されます。</p>
          <Link href="/360" className="mt-5 inline-flex min-h-14 items-center rounded bg-clinic px-6 py-4 text-lg font-bold text-white">360°評価を開く</Link>
        </section>
      ) : null}

      {tab === "status" ? (
        <section className="rounded border border-teal-900/10 bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-bold">回答状況</h2>
          <p className="mt-2 text-slate-600">評価結果画面で、評価期間ごとの提出状況・集計・評価一覧を確認できます。評価削除は評価結果内の評価一覧で管理します。</p>
          <Link href="/360/results" className="mt-5 inline-flex min-h-14 items-center rounded bg-clinic px-6 py-4 text-lg font-bold text-white">回答状況を確認する</Link>
        </section>
      ) : null}
    </div>
  );
}

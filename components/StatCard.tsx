export function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" }) {
  return <div className={"rounded border p-5 shadow-soft " + (tone === "accent" ? "border-teal-700 bg-clinic text-white" : "border-teal-900/10 bg-white")}><div className="text-sm opacity-80">{label}</div><div className="mt-2 text-3xl font-bold">{value}</div></div>;
}

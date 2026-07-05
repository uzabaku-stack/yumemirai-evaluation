type SupabaseRow = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const appDataTable = process.env.SUPABASE_APP_DATA_TABLE || "yumemirai_app_data";
const appDataId = process.env.SUPABASE_APP_DATA_ID || "default";

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function endpoint(path: string) {
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseAnonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: "Bearer " + supabaseAnonKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error("Supabase request failed: " + response.status + " " + text);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type SupabaseAppData = {
  nextIds: unknown;
  staff: unknown;
  jobRoles: unknown;
  evaluationItems: unknown;
  ratingCriteria: unknown;
  evaluations: unknown;
  evaluationScores: unknown;
  evaluationCycles: unknown;
  users: unknown;
  comments: unknown;
};

export async function loadSupabaseAppData(): Promise<SupabaseAppData | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await request<SupabaseRow[]>(appDataTable + "?id=eq." + encodeURIComponent(appDataId) + "&select=*");
  const row = rows[0];
  if (!row) return null;
  return {
    nextIds: row.next_ids,
    staff: row.staff,
    jobRoles: row.job_roles,
    evaluationItems: row.evaluation_items,
    ratingCriteria: row.rating_criteria,
    evaluations: row.evaluations,
    evaluationScores: row.evaluation_scores,
    evaluationCycles: row.evaluation_cycles,
    users: row.users,
    comments: row.comments,
  };
}

export async function saveSupabaseAppData(data: SupabaseAppData) {
  if (!isSupabaseConfigured()) return;
  await request<SupabaseRow[]>(appDataTable, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      id: appDataId,
      next_ids: data.nextIds,
      staff: data.staff,
      job_roles: data.jobRoles,
      evaluation_items: data.evaluationItems,
      rating_criteria: data.ratingCriteria,
      evaluations: data.evaluations,
      evaluation_scores: data.evaluationScores,
      evaluation_cycles: data.evaluationCycles,
      users: data.users,
      comments: data.comments,
      updated_at: new Date().toISOString(),
    }),
  });
}

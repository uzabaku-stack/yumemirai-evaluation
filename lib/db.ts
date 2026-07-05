import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { calculateSummary, defaultRatingCriteria, formatRatingCriteria } from "./scoring";
import { isSupabaseConfigured, loadSupabaseAppData, saveSupabaseAppData, type SupabaseAppData } from "./supabase";
import type { AppUser, CommentValues, CurrentUser, Evaluation, EvaluationCycle, EvaluationCycleStatus, EvaluationItem, EvaluationScore, EvaluationType, RatingCriterion, Staff, StaffRole } from "./types";
import { isDirectorRole } from "@/lib/permissions";

type JsonEvaluationScore = EvaluationScore & { id: number };
type AppData = {
  nextIds: { staff: number; evaluation: number; item: number; score: number; user: number; staff_role?: number; evaluation_cycle?: number };
  staff: Staff[];
  users: AppUser[];
  evaluation_items: EvaluationItem[];
  evaluations: Evaluation[];
  evaluation_scores: JsonEvaluationScore[];
  rating_criteria: RatingCriterion[];
  staff_roles: StaffRole[];
  evaluation_cycles: EvaluationCycle[];
};

const defaultDataFile = path.join(process.cwd(), "data", "yumemirai.json");
const dataFile = process.env.DATA_FILE_PATH || defaultDataFile;
const dataDir = path.dirname(dataFile);
const defaultDirectorPassword = "0000";
const defaultStaffPassword = "1111";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64url");
  return "pbkdf2_sha256$120000$" + salt + "$" + hash;
}

function verifyPassword(password: string, stored: string | undefined) {
  if (!stored) return false;
  const [algorithm, iterationsText, salt, expected] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !salt || !expected) return false;
  const hash = pbkdf2Sync(password, salt, Number(iterationsText), 32, "sha256").toString("base64url");
  const hashBuffer = Buffer.from(hash);
  const expectedBuffer = Buffer.from(expected);
  return hashBuffer.length === expectedBuffer.length && timingSafeEqual(hashBuffer, expectedBuffer);
}

function safeUser(user: AppUser) {
  const { password_hash: _passwordHash, pin: _pin, active: _active, created_at: _createdAt, ...safe } = user;
  return safe;
}
export const defaultStaffRoles = ["歯科衛生士", "歯科助手", "歯科医師", "その他"];
const staffSeeds = ["近藤", "岡崎", "亀井", "佐々木聡", "佐々木美", "富田", "藤原", "岩永", "浦崎"];
const officialSectionNames = ["臨床スキル評価", "技工・機器関連スキル", "矯正関連スキル", "外科・診療補助スキル", "接遇・事務対応", "チーム・貢献姿勢", "総合評価"];
const itemSeeds = [
  {
    "section_name": "臨床スキル評価",
    "item_name": "タイムスケジュールの遵守",
    "criteria": "患者ごと時間内に診療を終える努力をしているか\n自分の行動・処置が診療時間や全体の流れに与える影響を理解しているか"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "SRP実施",
    "criteria": "適応判断、経過フォロー(SRPの技術は基準に入りません)"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "メインテナンス管理",
    "criteria": "メンテナンス患者の管理、指導の実施"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "TBI（ブラッシング指導）",
    "criteria": "個別指導力・継続指導力"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "口腔内写真・記録管理",
    "criteria": "撮影技術、整理・説明力"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "フッ素塗布シーラント処置",
    "criteria": "適応判断・安全施術"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "口腔機能管理（MFT・オーラルフレイル）",
    "criteria": "訓練実施・経過観察記録"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "印象採得（アルジネート・シリコン）",
    "criteria": "精度、手際の良さ"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "口腔内スキャナー操作",
    "criteria": "撮影技術・データ処理"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "Tec除去・作製",
    "criteria": "仮歯作製、形態・咬合調整"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "クラウン・インレー適合、調整・装着補助",
    "criteria": "マージン確認、咬合調整"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "エアフロー使用・片付け",
    "criteria": "機器操作・感染対策"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "拡大鏡の使用",
    "criteria": "装着・術野視認"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "ホワイトニング説明",
    "criteria": "処置内容・禁忌・術後ケアの説明"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "カルテ記入の徹底",
    "criteria": "イニシャル記入・内容詳細・注意情報の明示"
  },
  {
    "section_name": "臨床スキル評価",
    "item_name": "説明用紙の活用",
    "criteria": "治療説明用紙の使用・確認ができているか"
  },
  {
    "section_name": "技工・機器関連スキル",
    "item_name": "☆技工操作サポート（石膏・トリミング・　模型管理含む）",
    "criteria": "丁寧さ・速さ・模型への名前記載・真空練和機の早期清掃等"
  },
  {
    "section_name": "技工・機器関連スキル",
    "item_name": "機器操作（スキャナー・CAD/CAM等）",
    "criteria": "操作精度・データ操作"
  },
  {
    "section_name": "技工・機器関連スキル",
    "item_name": "TEC作製(模型、口腔内)",
    "criteria": "仮歯作製"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "☆矯正治療の基本的な流れ説明",
    "criteria": "ステージごとの説明力"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "☆矯正器具準備・滅菌管理",
    "criteria": "適切な準備・保管"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "☆矯正治療アシスト全般",
    "criteria": "チェアサイドサポート"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "☆インビザライン準備",
    "criteria": "アライナー確認・患者説明"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "アタッチメント装着・除去",
    "criteria": "技術の正確さ・丁寧さ"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "ワイヤー交換",
    "criteria": "正確な交換・調整補助"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "ブラケット装着・除去",
    "criteria": "丁寧な着脱技術"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "ワイヤー結紮",
    "criteria": "確実な結紮操作"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "カスタムバンド装着・除去",
    "criteria": "適合確認・丁寧な操作"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "既製バンドフォーミング・装着",
    "criteria": "適切形成と装着技術"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "プレオルソ調整",
    "criteria": "咬合・フィット確認・微調整"
  },
  {
    "section_name": "矯正関連スキル",
    "item_name": "保定装置管理",
    "criteria": "リテーナー装着・指導"
  },
  {
    "section_name": "外科・診療補助スキル",
    "item_name": "☆外科処置準備（抜歯・インプラント）",
    "criteria": "器具準備・滅菌・管理"
  },
  {
    "section_name": "外科・診療補助スキル",
    "item_name": "☆抜歯アシスト",
    "criteria": "吸引・視野確保・器具受け渡し"
  },
  {
    "section_name": "外科・診療補助スキル",
    "item_name": "☆歯内治療アシスト（根管治療準備）",
    "criteria": "器具準備、薬剤準備"
  },
  {
    "section_name": "外科・診療補助スキル",
    "item_name": "☆CR修復準備・アシスト",
    "criteria": "器材セットアップ・　レジン準備"
  },
  {
    "section_name": "外科・診療補助スキル",
    "item_name": "☆服薬指導補助（鎮痛薬・抗生剤）",
    "criteria": "処方内容の確認と患者説明"
  },
  {
    "section_name": "外科・診療補助スキル",
    "item_name": "☆物品・診療器具の位置の把握",
    "criteria": "各物の位置を把握できているか"
  },
  {
    "section_name": "接遇・事務対応",
    "item_name": "☆患者応対",
    "criteria": "笑顔・挨拶・共感・傾聴力"
  },
  {
    "section_name": "接遇・事務対応",
    "item_name": "☆インフォームドコンセント支援",
    "criteria": "丁寧で分かりやすい説明"
  },
  {
    "section_name": "接遇・事務対応",
    "item_name": "☆予約取得・管理",
    "criteria": "正確な把握と配慮"
  },
  {
    "section_name": "接遇・事務対応",
    "item_name": "☆会計処理",
    "criteria": "正確な処理、人違いの確認"
  },
  {
    "section_name": "接遇・事務対応",
    "item_name": "☆電話応対",
    "criteria": "丁寧・迅速・正確な伝達"
  },
  {
    "section_name": "接遇・事務対応",
    "item_name": "☆医院内清掃・整備",
    "criteria": "感染対策・整理整頓・手隙時間内に積極的に清掃できるか"
  },
  {
    "section_name": "チーム・貢献姿勢",
    "item_name": "☆報告・連絡・相談の徹底",
    "criteria": "迅速・正確な情報共有・欠勤等の調整、情報共有、共有事項確認の徹底"
  },
  {
    "section_name": "チーム・貢献姿勢",
    "item_name": "☆チーム連携・協調性",
    "criteria": "医院全体の連携意識"
  },
  {
    "section_name": "チーム・貢献姿勢",
    "item_name": "☆教育・指導",
    "criteria": "丁寧な教え方・育成支援"
  },
  {
    "section_name": "チーム・貢献姿勢",
    "item_name": "☆自己研鑽\n（セミナー参加・読本）",
    "criteria": "積極的な学びと活用"
  },
  {
    "section_name": "チーム・貢献姿勢",
    "item_name": "☆医院改善提案・貢献意欲",
    "criteria": "積極的な提案・行動"
  },
  {
    "section_name": "チーム・貢献姿勢",
    "item_name": "☆Lineリアクションの実施",
    "criteria": "Lineをしっかりと読み、リアクションを実施しているか"
  },
  {
    "section_name": "チーム・貢献姿勢",
    "item_name": "☆継続的な礼儀・所作",
    "criteria": "挨拶、音を立てた時の声がけ、休み前の配慮など"
  }
] as const;

function now() { return new Date().toISOString(); }
function normalizeStaffRole(role: string) { return role.trim(); }
function normalizeTargetRoles(roles: string[] | undefined) { return Array.from(new Set((roles ?? []).map(normalizeStaffRole).filter(Boolean))); }
function staffRoleInUse(name: string) { const normalized = normalizeStaffRole(name); return store.staff.some((staff) => normalizeStaffRole(staff.role) === normalized) || store.evaluation_items.some((item) => normalizeTargetRoles(item.target_roles).includes(normalized)); }
function enrichStaffRole(role: StaffRole): StaffRole { const normalized = normalizeStaffRole(role.name); return { ...role, has_staff: store.staff.some((staff) => normalizeStaffRole(staff.role) === normalized), has_items: store.evaluation_items.some((item) => normalizeTargetRoles(item.target_roles).includes(normalized)) }; }
function normalizeRatingCriteria(criteria: RatingCriterion[] | undefined): RatingCriterion[] {
  const byScore = new Map<number, RatingCriterion>();
  for (const criterion of criteria ?? []) {
    const score = Number(criterion.score);
    if (score >= 1 && score <= 5) {
      byScore.set(score, { score, label: String(criterion.label ?? "").trim(), description: String(criterion.description ?? "").trim(), criterion_order: Number(criterion.criterion_order) || score });
    }
  }
  return defaultRatingCriteria.map((fallback) => {
    const current = byScore.get(fallback.score);
    return { score: fallback.score, label: current?.label || fallback.label, description: current?.description || fallback.description, criterion_order: fallback.score };
  });
}
function createEmptyData(): AppData { return { nextIds: { staff: 1, evaluation: 1, item: 1, score: 1, user: 1, staff_role: 1, evaluation_cycle: 1 }, staff: [], users: [], evaluation_items: [], evaluations: [], evaluation_scores: [], rating_criteria: [], staff_roles: [], evaluation_cycles: [] }; }
function commentsSnapshot(data: AppData) {
  return data.evaluations.map((evaluation) => ({ id: evaluation.id, evaluation_id: evaluation.id, evaluation_cycle_id: evaluation.evaluation_cycle_id ?? null, staff_id: evaluation.staff_id, evaluator_user_id: evaluation.evaluator_user_id ?? null, evaluator_staff_id: evaluation.evaluator_staff_id ?? null, evaluation_type: evaluation.evaluation_type, comments: evaluation.comments, updated_at: evaluation.updated_at }));
}
function toSupabaseAppData(data: AppData): SupabaseAppData {
  return { nextIds: data.nextIds, staff: data.staff, jobRoles: data.staff_roles, evaluationItems: data.evaluation_items, ratingCriteria: data.rating_criteria, evaluations: data.evaluations, evaluationScores: data.evaluation_scores, evaluationCycles: data.evaluation_cycles, users: data.users, comments: commentsSnapshot(data) };
}
function fromSupabaseAppData(source: SupabaseAppData): AppData {
  return { ...createEmptyData(), nextIds: source.nextIds as AppData["nextIds"], staff: source.staff as Staff[], staff_roles: source.jobRoles as StaffRole[], evaluation_items: source.evaluationItems as EvaluationItem[], rating_criteria: source.ratingCriteria as RatingCriterion[], evaluations: source.evaluations as Evaluation[], evaluation_scores: source.evaluationScores as JsonEvaluationScore[], evaluation_cycles: source.evaluationCycles as EvaluationCycle[], users: source.users as AppUser[] };
}
async function saveData(data: AppData) {
  if (isSupabaseConfigured()) await saveSupabaseAppData(toSupabaseAppData(data));
  else {
    mkdirSync(dataDir, { recursive: true });
    const tempFile = dataFile + ".tmp";
    writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    renameSync(tempFile, dataFile);
  }
}
function monthFromDate(value: string | undefined) { return value && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : new Date().toISOString().slice(0, 7); }
function monthEndDate(month: string) { const [year, monthNumber] = month.split("-").map(Number); return new Date(year, monthNumber, 0).toISOString().slice(0, 10); }
function defaultCycleName(month: string) { const [year, monthNumber] = month.split("-").map(Number); return `${year}年 ${monthNumber <= 6 ? "夏評価" : "冬評価"}`; }
function normalizeCycleStatus(status: string | undefined): EvaluationCycleStatus { return status === "draft" || status === "active" || status === "closed" ? status : "draft"; }
function createCycleForMonth(data: AppData, month: string, status: EvaluationCycleStatus) {
  const timestamp = now();
  const cycle: EvaluationCycle = { id: data.nextIds.evaluation_cycle ?? 1, name: defaultCycleName(month), startDate: `${month}-01`, endDate: monthEndDate(month), status, created_at: timestamp, updated_at: timestamp, item_snapshot: [], rating_criteria_snapshot: [] };
  data.nextIds.evaluation_cycle = (data.nextIds.evaluation_cycle ?? 1) + 1;
  data.evaluation_cycles.push(cycle);
  return cycle;
}
function ensureEvaluationCycles(data: AppData) {
  data.evaluation_cycles = (data.evaluation_cycles ?? []).map((cycle) => ({ ...cycle, status: normalizeCycleStatus(cycle.status), item_snapshot: Array.isArray(cycle.item_snapshot) ? cycle.item_snapshot : [], rating_criteria_snapshot: Array.isArray(cycle.rating_criteria_snapshot) ? cycle.rating_criteria_snapshot : [] }));
  const currentMonth = monthFromDate(undefined);
  const cycleByMonth = new Map<string, EvaluationCycle>();
  for (const cycle of data.evaluation_cycles) cycleByMonth.set(monthFromDate(cycle.startDate), cycle);
  const months = Array.from(new Set(data.evaluations.map((evaluation) => monthFromDate(evaluation.evaluation_month || evaluation.entry_date)))).sort();
  for (const month of months) if (!cycleByMonth.has(month)) cycleByMonth.set(month, createCycleForMonth(data, month, month === currentMonth ? "active" : "closed"));
  if (!data.evaluation_cycles.length) cycleByMonth.set(currentMonth, createCycleForMonth(data, currentMonth, "active"));
  if (!data.evaluation_cycles.some((cycle) => cycle.status === "active")) {
    const latest = [...data.evaluation_cycles].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id)[0];
    if (latest) latest.status = "active";
  }
  const activeCycles = data.evaluation_cycles.filter((cycle) => cycle.status === "active").sort((a, b) => a.id - b.id);
  for (const cycle of activeCycles.slice(0, -1)) cycle.status = "closed";
  for (const evaluation of data.evaluations) {
    if (!evaluation.evaluation_cycle_id) {
      const month = monthFromDate(evaluation.evaluation_month || evaluation.entry_date);
      evaluation.evaluation_cycle_id = cycleByMonth.get(month)?.id ?? data.evaluation_cycles.find((cycle) => cycle.status === "active")?.id ?? null;
    }
  }
}
function normalizeIds(data: AppData) {
  const ids = data.nextIds ?? { staff: 1, evaluation: 1, item: 1, score: 1, user: 1, staff_role: 1, evaluation_cycle: 1 };
  data.nextIds = { staff: ids.staff ?? 1, evaluation: ids.evaluation ?? 1, item: ids.item ?? 1, score: ids.score ?? 1, user: ids.user ?? 1, staff_role: ids.staff_role ?? 1, evaluation_cycle: ids.evaluation_cycle ?? 1 };
  data.staff ??= []; data.users ??= []; data.evaluation_items ??= []; data.evaluations ??= []; data.evaluation_scores ??= []; data.rating_criteria ??= []; data.staff_roles ??= []; data.evaluation_cycles ??= [];
  data.staff = data.staff.map((staff) => ({ ...staff, role: normalizeStaffRole(staff.role) }));
  data.users = data.users.map((user) => {
    const fallbackPassword = user.pin || (isDirectorRole(user.role) ? defaultDirectorPassword : defaultStaffPassword);
    return { ...user, password_hash: user.password_hash || hashPassword(fallbackPassword), pin: undefined };
  });
  data.evaluations = data.evaluations.map((evaluation) => {
    const evaluatorUser = evaluation.evaluator_user_id ? data.users.find((user) => user.id === evaluation.evaluator_user_id) : null;
    const evaluatorStaffUser = evaluation.evaluator_staff_id ? data.users.find((user) => user.staff_id === evaluation.evaluator_staff_id && user.role === "staff") : null;
    return { ...evaluation, evaluator_user_id: evaluation.evaluator_user_id ?? evaluatorStaffUser?.id ?? null, evaluator_staff_id: evaluation.evaluator_staff_id ?? evaluatorUser?.staff_id ?? null, is_360: evaluation.is_360 ? 1 : 0, evaluation_cycle_id: evaluation.evaluation_cycle_id ?? null };
  });
  data.evaluation_scores = data.evaluation_scores.map((score) => ({ ...score, not_applicable: score.not_applicable ? 1 : 0 }));
  data.evaluation_items = data.evaluation_items.map((item) => ({ ...item, target_roles: normalizeTargetRoles(Array.isArray(item.target_roles) ? item.target_roles : []) }));
  ensureEvaluationCycles(data);
  data.nextIds.staff = Math.max(data.nextIds.staff, ...data.staff.map((item) => item.id + 1), 1);
  data.nextIds.item = Math.max(data.nextIds.item, ...data.evaluation_items.map((item) => item.id + 1), 1);
  data.nextIds.evaluation = Math.max(data.nextIds.evaluation, ...data.evaluations.map((item) => item.id + 1), 1);
  data.nextIds.score = Math.max(data.nextIds.score, ...data.evaluation_scores.map((item) => item.id + 1), 1);
  data.nextIds.user = Math.max(data.nextIds.user, ...data.users.map((item) => item.id + 1), 1);
  data.nextIds.staff_role = Math.max(data.nextIds.staff_role ?? 1, ...data.staff_roles.map((item) => item.id + 1), 1);
  data.nextIds.evaluation_cycle = Math.max(data.nextIds.evaluation_cycle ?? 1, ...data.evaluation_cycles.map((item) => item.id + 1), 1);
}
function seedData(data: AppData) {
  let changed = false;
  for (const roleName of defaultStaffRoles) {
    if (!data.staff_roles.some((role) => normalizeStaffRole(role.name) === roleName)) {
      data.staff_roles.push({ id: data.nextIds.staff_role ?? 1, name: roleName, active: 1, role_order: data.staff_roles.length + 1, created_at: now() });
      data.nextIds.staff_role = (data.nextIds.staff_role ?? 1) + 1;
      changed = true;
    }
  }
  data.staff_roles = data.staff_roles.map((role, index) => ({ ...role, name: normalizeStaffRole(role.name), role_order: role.role_order || index + 1, active: role.active ? 1 : 0 }));
  for (const name of staffSeeds) {
    if (!data.staff.some((staff) => staff.name === name)) { data.staff.push({ id: data.nextIds.staff++, name, role: "歯科衛生士", active: 1, created_at: now() }); changed = true; }
  }
  if (!data.users.some((user) => user.login_id === "director")) { data.users.push({ id: data.nextIds.user++, login_id: "director", name: "院長", role: "director", staff_id: null, password_hash: hashPassword(defaultDirectorPassword), active: 1, created_at: now() }); changed = true; }
  for (const staff of data.staff) {
    const loginId = "staff-" + staff.id;
    if (!data.users.some((user) => user.login_id === loginId)) { data.users.push({ id: data.nextIds.user++, login_id: loginId, name: staff.name, role: "staff", staff_id: staff.id, password_hash: hashPassword(defaultStaffPassword), active: staff.active, created_at: now() }); changed = true; }
  }
  if (data.evaluation_items.length === 0) {
    itemSeeds.forEach((item, index) => {
      data.evaluation_items.push({ id: data.nextIds.item++, section_name: item.section_name, item_name: item.item_name, criteria: item.criteria, item_order: index + 1, active: 1, target_roles: [] });
      changed = true;
    });
  }
  if (!data.rating_criteria.length) {
    data.rating_criteria = defaultRatingCriteria.map((criterion) => ({ ...criterion }));
    changed = true;
  }
  data.rating_criteria = normalizeRatingCriteria(data.rating_criteria);
  data.evaluation_items.sort((a, b) => a.item_order - b.item_order || a.id - b.id);
  return changed;
}
async function loadData(): Promise<AppData> {
  if (!isSupabaseConfigured()) mkdirSync(dataDir, { recursive: true });
  let data = createEmptyData();
  let loadedFromSupabase = false;
  if (isSupabaseConfigured()) {
    const supabaseData = await loadSupabaseAppData();
    if (supabaseData) { data = fromSupabaseAppData(supabaseData); loadedFromSupabase = true; }
  }
  if (!loadedFromSupabase) {
    const sourceFile = existsSync(dataFile) ? dataFile : defaultDataFile;
    if (existsSync(sourceFile)) {
      try { data = { ...data, ...JSON.parse(readFileSync(sourceFile, "utf8")) } as AppData; } catch { data = createEmptyData(); }
    }
  }
  const beforeNormalize = JSON.stringify(data);
  normalizeIds(data);
  const normalizedChanged = JSON.stringify(data) !== beforeNormalize;
  const seeded = seedData(data);
  if (seeded || normalizedChanged || !existsSync(dataFile) || (isSupabaseConfigured() && !loadedFromSupabase)) await saveData(data);
  return data;
}
let store = await loadData();
async function persist() { normalizeIds(store); await saveData(store); }
export async function refreshStoreFromRemote() {
  if (!isSupabaseConfigured()) return;
  const supabaseData = await loadSupabaseAppData();
  if (!supabaseData) return;
  store = fromSupabaseAppData(supabaseData);
  normalizeIds(store);
}
function withStaffName(evaluation: Evaluation): Evaluation { const staff = store.staff.find((person) => person.id === evaluation.staff_id); const evaluatorStaff = evaluation.evaluator_staff_id ? store.staff.find((person) => person.id === evaluation.evaluator_staff_id) : null; const cycle = evaluation.evaluation_cycle_id ? store.evaluation_cycles.find((item) => item.id === evaluation.evaluation_cycle_id) : null; return { ...evaluation, staff_name: staff?.name ?? "", evaluator_staff_name: evaluatorStaff?.name ?? evaluation.evaluator_name ?? "", evaluation_cycle_name: cycle?.name ?? null }; }
function staffHasEvaluations(staffId: number) { return store.evaluations.some((evaluation) => evaluation.staff_id === staffId); }
function syncStaffUser(staff: Staff) {
  const loginId = "staff-" + staff.id;
  const existing = store.users.find((user) => user.login_id === loginId);
  if (existing) { existing.name = staff.name; existing.staff_id = staff.id; existing.active = staff.active; }
  else { store.users.push({ id: store.nextIds.user++, login_id: loginId, name: staff.name, role: "staff", staff_id: staff.id, password_hash: hashPassword(defaultStaffPassword), active: staff.active, created_at: now() }); }
}
function roleMatches(item: EvaluationItem, role: string) { const normalizedRole = normalizeStaffRole(role); return !item.target_roles?.length || item.target_roles.includes(normalizedRole); }
function snapshotItem(item: EvaluationItem): Pick<EvaluationScore, "section_name" | "item_name" | "criteria" | "item_order"> { return { section_name: item.section_name, item_name: item.item_name, criteria: item.criteria, item_order: item.item_order }; }

const evaluationThemes = ["臨床スキル", "技工・機器関連スキル", "矯正関連スキル", "外科・診療補助スキル", "接遇・事務対応", "チーム・貢献姿勢"] as const;
type EvaluationTheme = typeof evaluationThemes[number];
const sectionAxisMap: Array<{ theme: EvaluationTheme; keywords: string[] }> = [
  { theme: "臨床スキル", keywords: ["臨床スキル", "臨床", "SRP", "TBI", "メインテナンス", "口腔", "印象", "Tec", "TEC"] },
  { theme: "技工・機器関連スキル", keywords: ["技工", "機器", "スキャナー", "CAD", "CAM", "模型"] },
  { theme: "矯正関連スキル", keywords: ["矯正", "インビザ", "ワイヤー", "ブラケット", "リテーナー", "プレオルソ"] },
  { theme: "外科・診療補助スキル", keywords: ["外科", "診療補助", "抜歯", "アシスト", "CR", "服薬", "器具"] },
  { theme: "接遇・事務対応", keywords: ["接遇", "事務", "患者応対", "予約", "会計", "電話", "清掃"] },
  { theme: "チーム・貢献姿勢", keywords: ["チーム", "貢献", "報告", "連絡", "相談", "教育", "自己研鑽", "改善", "Line", "礼儀"] },
];
function themeForScore(score: Pick<EvaluationScore, "section_name" | "item_name">) {
  const text = String((score.section_name ?? "") + " " + (score.item_name ?? ""));
  const match = sectionAxisMap.find((group) => group.keywords.some((keyword) => text.includes(keyword)));
  return match?.theme ?? null;
}
function averageNumbers(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function evaluationsForStaffMonth(staffId: number, month: string) { return store.evaluations.filter((evaluation) => evaluation.is_360 === 1 && evaluation.staff_id === staffId && evaluation.evaluation_month === month).map(withStaffName); }
function available360MonthsForStaff(staffId: number) { return Array.from(new Set(store.evaluations.filter((evaluation) => evaluation.is_360 === 1 && evaluation.staff_id === staffId).map((evaluation) => evaluation.evaluation_month))).sort((a, b) => b.localeCompare(a)); }
function latest360MonthForStaff(staffId: number) { return available360MonthsForStaff(staffId)[0] ?? currentEvaluationMonth(); }
function themeAveragesForEvaluations(evaluations: Evaluation[]) {
  const evaluationIds = new Set(evaluations.map((evaluation) => evaluation.id));
  const groups = new Map<EvaluationTheme, number[]>();
  for (const theme of evaluationThemes) groups.set(theme, []);
  for (const score of store.evaluation_scores) {
    if (!evaluationIds.has(score.evaluation_id) || score.not_applicable || score.score === null || !Number.isFinite(score.score)) continue;
    const theme = themeForScore(score);
    if (!theme) continue;
    groups.get(theme)?.push(Number(score.score));
  }
  return evaluationThemes.map((theme) => ({ theme, average: averageNumbers(groups.get(theme) ?? []) }));
}
function themeAverageMap(evaluations: Evaluation[]) { return new Map(themeAveragesForEvaluations(evaluations).map((item) => [item.theme, item.average])); }
function overallAverageForEvaluations(evaluations: Evaluation[]) {
  const ids = new Set(evaluations.map((evaluation) => evaluation.id));
  const values = store.evaluation_scores.filter((score) => ids.has(score.evaluation_id) && !score.not_applicable && score.score !== null && Number.isFinite(score.score)).map((score) => Number(score.score));
  return averageNumbers(values);
}
function commentsForSelfEvaluation(evaluations: Evaluation[]) {
  const self = evaluations.filter((evaluation) => evaluation.evaluation_type === "self").sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)[0];
  return self?.comments ?? "{}";
}

function getActiveCycleInternal() { return [...store.evaluation_cycles].sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : b.startDate.localeCompare(a.startDate) || b.id - a.id))[0]; }
function cycleMonth(cycle: EvaluationCycle | undefined) { return monthFromDate(cycle?.startDate); }
function evaluationsForStaffCycle(staffId: number, cycleId: number) { return store.evaluations.filter((evaluation) => evaluation.is_360 === 1 && evaluation.staff_id === staffId && evaluation.evaluation_cycle_id === cycleId).map(withStaffName); }
function itemAveragesForEvaluations(evaluations: Evaluation[]) { return buildGlobalItemAverages(evaluations).sort((a, b) => (a.average ?? 99) - (b.average ?? 99)); }
function buildStaffCycleHistory(staff: Staff, cycle: EvaluationCycle) {
  const evaluations = evaluationsForStaffCycle(staff.id, cycle.id);
  const overall_average = overallAverageForEvaluations(evaluations);
  const themes = themeAveragesForEvaluations(evaluations);
  const ranked = themes.filter((item): item is { theme: EvaluationTheme; average: number } => item.average !== null);
  const strengths = [...ranked].sort((a, b) => b.average - a.average).slice(0, 3);
  const improvements = [...ranked].sort((a, b) => a.average - b.average).slice(0, 3);
  const self_comments = commentsForSelfEvaluation(evaluations);
  const comments = JSON.parse(self_comments || "{}");
  const comment_exists = Object.values(comments).some((value) => String(value ?? "").trim().length > 0);
  return { staff: enrichStaff(staff), cycle, overall_average, themes, strengths, improvements, comment_exists, self_comments, item_averages: itemAveragesForEvaluations(evaluations), evaluations };
}
export function getEvaluationCycles() { return [...store.evaluation_cycles].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id); }
export function getEvaluationCycle(id: number) { return store.evaluation_cycles.find((cycle) => cycle.id === id) ?? null; }
export function getActiveEvaluationCycle() { return getActiveCycleInternal(); }
export async function createEvaluationCycle(input: { name: string; startDate: string; endDate: string; status?: EvaluationCycleStatus }) {
  const timestamp = now();
  const status = normalizeCycleStatus(input.status);
  if (status === "active") store.evaluation_cycles = store.evaluation_cycles.map((cycle) => ({ ...cycle, status: cycle.status === "active" ? "closed" : cycle.status }));
  const cycle: EvaluationCycle = { id: store.nextIds.evaluation_cycle ?? 1, name: input.name.trim() || defaultCycleName(monthFromDate(input.startDate)), startDate: input.startDate, endDate: input.endDate, status, created_at: timestamp, updated_at: timestamp, item_snapshot: getAllEvaluationItems(), rating_criteria_snapshot: getRatingCriteria() };
  store.nextIds.evaluation_cycle = (store.nextIds.evaluation_cycle ?? 1) + 1;
  store.evaluation_cycles.push(cycle);
  await persist();
  return cycle;
}
export async function updateEvaluationCycle(id: number, input: Partial<{ name: string; startDate: string; endDate: string; status: EvaluationCycleStatus }>) {
  const cycle = store.evaluation_cycles.find((item) => item.id === id);
  if (!cycle) throw new Error("Evaluation cycle not found");
  if (input.status === "active") store.evaluation_cycles = store.evaluation_cycles.map((item) => ({ ...item, status: item.id !== id && item.status === "active" ? "closed" : item.status }));
  if (input.name !== undefined) cycle.name = input.name.trim() || cycle.name;
  if (input.startDate !== undefined) cycle.startDate = input.startDate;
  if (input.endDate !== undefined) cycle.endDate = input.endDate;
  if (input.status !== undefined) cycle.status = normalizeCycleStatus(input.status);
  cycle.updated_at = now();
  await persist();
  return cycle;
}
export async function copyEvaluationCycle(id: number, input: { name: string; startDate: string; endDate: string; status?: EvaluationCycleStatus }) {
  const source = store.evaluation_cycles.find((cycle) => cycle.id === id);
  if (!source) throw new Error("Evaluation cycle not found");
  const cycle = await createEvaluationCycle({ ...input, status: input.status ?? "draft" });
  cycle.item_snapshot = source.item_snapshot?.length ? source.item_snapshot : getAllEvaluationItems();
  cycle.rating_criteria_snapshot = source.rating_criteria_snapshot?.length ? source.rating_criteria_snapshot : getRatingCriteria();
  cycle.updated_at = now();
  await persist();
  return cycle;
}
export function getStaffEvaluationHistory(staffId: number) {
  const staff = store.staff.find((person) => person.id === staffId);
  if (!staff) return [];
  return getEvaluationCycles().map((cycle) => buildStaffCycleHistory(staff, cycle)).filter((row) => row.evaluations.length > 0);
}
export function getStaffEvaluationHistoryDetail(staffId: number, cycleId: number) {
  const staff = store.staff.find((person) => person.id === staffId);
  const cycle = store.evaluation_cycles.find((item) => item.id === cycleId);
  if (!staff || !cycle) return null;
  return buildStaffCycleHistory(staff, cycle);
}
export function getRatingCriteria(): RatingCriterion[] { return normalizeRatingCriteria(store.rating_criteria).map((criterion) => ({ ...criterion })); }
export function getRatingCriteriaText() { return formatRatingCriteria(getRatingCriteria()); }
export async function saveRatingCriteria(criteria: RatingCriterion[]) { store.rating_criteria = normalizeRatingCriteria(criteria); await persist(); return getRatingCriteria(); }
export function getLoginUsers() { return store.users.filter((user) => user.active === 1).map(safeUser); }
export function validateLogin(loginId: string, password: string) { const user = store.users.find((item) => item.login_id === loginId && item.active === 1); if (!user || !verifyPassword(password, user.password_hash)) return null; return safeUser(user); }
export function assertValidNewPassword(password: string, confirmation?: string) { const value = String(password ?? ""); if (value.length < 6) throw new Error("password_too_short"); if (confirmation !== undefined && value !== confirmation) throw new Error("password_mismatch"); return value; }
export async function changeUserPassword(userId: number, password: string, confirmation?: string) { const user = store.users.find((item) => item.id === userId && item.active === 1); if (!user) throw new Error("user_not_found"); const nextPassword = assertValidNewPassword(password, confirmation); user.password_hash = hashPassword(nextPassword); user.pin = undefined; await persist(); return { ok: true }; }
export async function changeStaffPassword(staffId: number, password: string, confirmation?: string) { const user = store.users.find((item) => item.staff_id === staffId && item.role === "staff" && item.active === 1); if (!user) throw new Error("user_not_found"); return await changeUserPassword(user.id, password, confirmation); }
export async function changeDirectorPassword(password: string, confirmation?: string) { const user = store.users.find((item) => isDirectorRole(item.role) && item.active === 1); if (!user) throw new Error("user_not_found"); return await changeUserPassword(user.id, password, confirmation); }
export async function resetStaffPassword(staffId: number) { const user = store.users.find((item) => item.staff_id === staffId && item.role === "staff"); if (!user) throw new Error("User not found"); user.password_hash = hashPassword(defaultStaffPassword); user.pin = undefined; await persist(); return { ok: true }; }
export function getStaffById(id: number) { return store.staff.find((staff) => staff.id === id && staff.active === 1); }
function enrichStaff(staff: Staff): Staff {
  const latest = store.evaluations.filter((evaluation) => evaluation.staff_id === staff.id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)[0];
  return { ...staff, latest_date: latest?.entry_date ?? null, latest_score: latest?.average_score ?? null, has_evaluations: staffHasEvaluations(staff.id) };
}
export function getStaffList(): Staff[] { return store.staff.filter((staff) => staff.active === 1).map(enrichStaff).sort((a, b) => a.id - b.id); }
export function getAllStaffList(): Staff[] { return store.staff.map(enrichStaff).sort((a, b) => a.id - b.id); }
export function getStaffRoles(): string[] { return getStaffRoleOptions(); }
export function getStaffRoleOptions(): string[] { return store.staff_roles.filter((role) => role.active === 1).sort((a, b) => a.role_order - b.role_order || a.id - b.id).map((role) => role.name); }
export function getAllStaffRoles(): StaffRole[] { return store.staff_roles.sort((a, b) => a.role_order - b.role_order || a.id - b.id).map(enrichStaffRole); }
export async function createStaffRole(input: { name: string }) { const name = normalizeStaffRole(input.name); if (!name) throw new Error("Role name is required"); if (store.staff_roles.some((role) => normalizeStaffRole(role.name) === name)) throw new Error("Role already exists"); const role: StaffRole = { id: store.nextIds.staff_role ?? 1, name, active: 1, role_order: store.staff_roles.length + 1, created_at: now() }; store.nextIds.staff_role = role.id + 1; store.staff_roles.push(role); await persist(); return enrichStaffRole(role); }
export async function updateStaffRole(id: number, input: { name?: string; active?: number }) { const role = store.staff_roles.find((item) => item.id === id); if (!role) throw new Error("Role not found"); const oldName = role.name; if (input.name !== undefined) { const nextName = normalizeStaffRole(input.name); if (!nextName) throw new Error("Role name is required"); role.name = nextName; if (oldName !== nextName) { store.staff = store.staff.map((staff) => normalizeStaffRole(staff.role) === normalizeStaffRole(oldName) ? { ...staff, role: nextName } : staff); store.evaluation_items = store.evaluation_items.map((item) => ({ ...item, target_roles: normalizeTargetRoles(item.target_roles).map((target) => target === normalizeStaffRole(oldName) ? nextName : target) })); } } if (input.active !== undefined) role.active = input.active ? 1 : 0; await persist(); return enrichStaffRole(role); }
export async function deleteStaffRole(id: number) { const role = store.staff_roles.find((item) => item.id === id); if (!role) return { deleted: false, reason: "not_found" as const }; if (staffRoleInUse(role.name)) return { deleted: false, reason: "in_use" as const }; store.staff_roles = store.staff_roles.filter((item) => item.id !== id).map((item, index) => ({ ...item, role_order: index + 1 })); await persist(); return { deleted: true, reason: null }; }
export async function createStaff(input: { name: string; role: string }) {
  const staff: Staff = { id: store.nextIds.staff++, name: input.name.trim(), role: normalizeStaffRole(input.role), active: 1, created_at: now() };
  if (!staff.name) throw new Error("Staff name is required");
  store.staff.push(staff); syncStaffUser(staff); await persist(); return enrichStaff(staff);
}
export async function updateStaff(id: number, input: { name?: string; role?: string; active?: number }) {
  const staff = store.staff.find((person) => person.id === id); if (!staff) throw new Error("Staff not found");
  if (input.name !== undefined) staff.name = input.name.trim() || staff.name;
  if (input.role !== undefined) staff.role = normalizeStaffRole(input.role);
  if (input.active !== undefined) staff.active = input.active ? 1 : 0;
  syncStaffUser(staff); await persist(); return enrichStaff(staff);
}
export async function deleteStaff(id: number) {
  const staff = store.staff.find((person) => person.id === id); if (!staff) return { deleted: false, reason: "not_found" as const };
  if (staffHasEvaluations(id)) return { deleted: false, reason: "has_evaluations" as const };
  store.staff = store.staff.filter((person) => person.id !== id); store.users = store.users.filter((user) => user.staff_id !== id); await persist(); return { deleted: true, reason: null };
}
export function getEvaluationItems(): EvaluationItem[] { return [...store.evaluation_items].filter((item) => item.active === 1).sort((a, b) => a.item_order - b.item_order || a.id - b.id); }
export function getEvaluationItemsForStaff(staffId: number): EvaluationItem[] {
  const staff = store.staff.find((person) => person.id === staffId);
  return getEvaluationItems().filter((item) => !staff || roleMatches(item, staff.role));
}
export function getEvaluationItemsForEvaluation(evaluationId: number): EvaluationItem[] {
  const scores = store.evaluation_scores.filter((score) => score.evaluation_id === evaluationId);
  if (scores.length && scores.every((score) => score.item_name && score.section_name)) {
    return scores.map((score) => ({ id: score.item_id, section_name: score.section_name ?? "", item_name: score.item_name ?? "", criteria: score.criteria ?? "評価基準は未設定です。", item_order: score.item_order ?? 0, active: 1, target_roles: [] })).sort((a, b) => a.item_order - b.item_order || a.id - b.id);
  }
  const evaluation = store.evaluations.find((item) => item.id === evaluationId);
  return evaluation ? getEvaluationItemsForStaff(evaluation.staff_id) : getEvaluationItems();
}
export function getAllEvaluationItems(): EvaluationItem[] { return [...store.evaluation_items].sort((a, b) => a.item_order - b.item_order || a.id - b.id); }
export function getSectionNames(): string[] { return Array.from(new Set([...officialSectionNames, ...store.evaluation_items.map((item) => item.section_name).filter(Boolean)])); }
export async function saveEvaluationItems(items: Array<Partial<EvaluationItem> & { item_name: string; section_name: string; criteria: string; active: number; target_roles?: string[] }>) {
  const existingIds = new Set(store.evaluation_items.map((item) => item.id));
  const nextIds = new Set<number>();
  const normalized = items.map((item, index) => {
    const id = item.id && existingIds.has(item.id) ? item.id : store.nextIds.item++;
    nextIds.add(id);
    return { id, section_name: item.section_name.trim() || "未分類", item_name: item.item_name.trim() || "名称未設定", criteria: item.criteria.trim() || "評価基準は未設定です。", item_order: index + 1, active: item.active ? 1 : 0, target_roles: normalizeTargetRoles(item.target_roles) } satisfies EvaluationItem;
  });
  const deletedIds = store.evaluation_items.map((item) => item.id).filter((id) => !nextIds.has(id));
  store.evaluation_items = normalized;
  if (deletedIds.length) {
    const deleted = new Set(deletedIds);
    store.evaluation_scores = store.evaluation_scores.filter((score) => !deleted.has(score.item_id));
  }
  await persist(); return getAllEvaluationItems();
}
export function getEvaluations(): Evaluation[] { return store.evaluations.map(withStaffName).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.id - a.id); }
export function getEvaluationsForStaffSelf(staffId: number): Evaluation[] { return getEvaluations().filter((evaluation) => evaluation.staff_id === staffId && evaluation.evaluation_type === "self"); }
export function getEvaluation(id: number): Evaluation | undefined { const evaluation = store.evaluations.find((item) => item.id === id); return evaluation ? withStaffName(evaluation) : undefined; }
export function getEvaluationScores(evaluationId: number): EvaluationScore[] { return store.evaluation_scores.filter((score) => score.evaluation_id === evaluationId).map(({ evaluation_id, item_id, score, comment, not_applicable, section_name, item_name, criteria, item_order }) => ({ evaluation_id, item_id, score, comment, not_applicable: not_applicable ? 1 : 0, section_name, item_name, criteria, item_order })); }
export async function deleteEvaluation(id: number) { const exists = store.evaluations.some((evaluation) => evaluation.id === id); if (!exists) return false; store.evaluations = store.evaluations.filter((evaluation) => evaluation.id !== id); store.evaluation_scores = store.evaluation_scores.filter((score) => score.evaluation_id !== id); await persist(); return true; }
export async function createEvaluation(input: { staff_id: number; evaluator_name: string; evaluation_type: EvaluationType; evaluation_month?: string; entry_date: string; evaluator_user_id?: number | null; evaluator_staff_id?: number | null; is_360?: number; evaluation_cycle_id?: number | null }) {
  const cycle = input.evaluation_cycle_id ? store.evaluation_cycles.find((item) => item.id === input.evaluation_cycle_id) : getActiveCycleInternal();
  const evaluationMonth = input.evaluation_month || cycleMonth(cycle);
  const items = getEvaluationItemsForStaff(input.staff_id); const summary = calculateSummary(items, []); const timestamp = now(); const evaluationId = store.nextIds.evaluation++;
  store.evaluations.push({ id: evaluationId, staff_id: input.staff_id, evaluator_name: input.evaluator_name, evaluation_type: input.evaluation_type, evaluation_month: evaluationMonth, entry_date: input.entry_date, total_score: summary.totalScore, max_score: summary.maxScore, average_score: summary.averageScore, rank: summary.rank, comments: "{}", created_at: timestamp, updated_at: timestamp, evaluator_user_id: input.evaluator_user_id ?? null, evaluator_staff_id: input.evaluator_staff_id ?? null, is_360: input.is_360 ? 1 : 0, evaluation_cycle_id: cycle?.id ?? null });
  for (const item of items) store.evaluation_scores.push({ id: store.nextIds.score++, evaluation_id: evaluationId, item_id: item.id, score: null, comment: "", not_applicable: 0, ...snapshotItem(item) });
  await persist(); return evaluationId;
}
export async function updateEvaluation(id: number, payload: { scores: Array<{ item_id: number; score: number | null; comment?: string; not_applicable?: number | boolean }>; comments?: CommentValues }) {
  const evaluation = store.evaluations.find((item) => item.id === id); if (!evaluation) throw new Error("Evaluation not found");
  for (const incoming of payload.scores) {
    const notApplicable = incoming.not_applicable ? 1 : 0;
    const nextScore = notApplicable ? null : incoming.score;
    const existing = store.evaluation_scores.find((score) => score.evaluation_id === id && score.item_id === incoming.item_id);
    if (existing) { existing.score = nextScore; existing.comment = incoming.comment ?? ""; existing.not_applicable = notApplicable; }
    else { const item = store.evaluation_items.find((entry) => entry.id === incoming.item_id) ?? getEvaluationItemsForEvaluation(id).find((entry) => entry.id === incoming.item_id); store.evaluation_scores.push({ id: store.nextIds.score++, evaluation_id: id, item_id: incoming.item_id, score: nextScore, comment: incoming.comment ?? "", not_applicable: notApplicable, ...(item ? snapshotItem(item) : {}) }); }
  }
  const items = getEvaluationItemsForEvaluation(id); const savedScores = getEvaluationScores(id); const summary = calculateSummary(items, savedScores);
  evaluation.total_score = summary.totalScore; evaluation.max_score = summary.maxScore; evaluation.average_score = summary.averageScore; evaluation.rank = summary.rank; if (payload.comments) evaluation.comments = JSON.stringify(payload.comments); evaluation.updated_at = now(); await persist(); return summary;
}

function currentEvaluationMonth() { return new Date().toISOString().slice(0, 7); }
function currentEntryDate() { return new Date().toISOString().slice(0, 10); }
function get360EvaluationType(user: CurrentUser, staffId: number): EvaluationType { if (isDirectorRole(user.role)) return "director"; return user.staff_id === staffId ? "self" : "peer"; }
function isEvaluationOwnedByUser(evaluation: Evaluation, user: CurrentUser) {
  if (evaluation.evaluator_user_id !== null && evaluation.evaluator_user_id !== undefined && evaluation.evaluator_user_id === user.id) return true;
  if (evaluation.evaluator_staff_id !== null && evaluation.evaluator_staff_id !== undefined && user.staff_id !== null && evaluation.evaluator_staff_id === user.staff_id) return true;
  return false;
}
export function canUserEditEvaluationRecord(user: CurrentUser, evaluation: Evaluation) {
  if (isDirectorRole(user.role)) return true;
  if (evaluation.evaluation_type === "self" && evaluation.staff_id === user.staff_id) return true;
  return evaluation.is_360 === 1 && isEvaluationOwnedByUser(evaluation, user);
}
function find360Evaluation(user: CurrentUser, staffId: number, month = currentEvaluationMonth(), cycleId: number | null = getActiveCycleInternal()?.id ?? null) { return store.evaluations.find((evaluation) => evaluation.is_360 === 1 && isEvaluationOwnedByUser(evaluation, user) && evaluation.staff_id === staffId && ((cycleId && evaluation.evaluation_cycle_id === cycleId) || (!evaluation.evaluation_cycle_id && evaluation.evaluation_month === month))); }
export async function getOrCreate360Evaluation(user: CurrentUser, staffId: number, month = currentEvaluationMonth(), entryDate = currentEntryDate(), cycleId = getActiveCycleInternal()?.id ?? null) {
  const cycle = cycleId ? store.evaluation_cycles.find((item) => item.id === cycleId) : getActiveCycleInternal();
  const evaluationMonth = cycle ? cycleMonth(cycle) : month;
  const existing = find360Evaluation(user, staffId, evaluationMonth, cycle?.id ?? null);
  if (existing) return existing.id;
  return await createEvaluation({ staff_id: staffId, evaluator_name: user.name, evaluation_type: get360EvaluationType(user, staffId), evaluation_month: evaluationMonth, entry_date: entryDate, evaluator_user_id: user.id, evaluator_staff_id: user.staff_id, is_360: 1, evaluation_cycle_id: cycle?.id ?? null });
}
function is360EvaluationComplete(evaluation: Evaluation) {
  const scores = store.evaluation_scores.filter((score) => score.evaluation_id === evaluation.id);
  if (!scores.length) return false;
  return scores.every((score) => evaluation.evaluation_type === "self" ? score.score !== null && !score.not_applicable : score.score !== null || !!score.not_applicable);
}
export function get360Progress(user: CurrentUser, month = currentEvaluationMonth()) {
  return getStaffList().map((staff) => {
    const evaluation = find360Evaluation(user, staff.id, month);
    const isSelfTarget = user.staff_id === staff.id;
    const status = evaluation ? (is360EvaluationComplete(evaluation) ? "完了" : "評価中") : "未評価";
    return { staff, evaluation_id: evaluation?.id ?? null, evaluation_type: get360EvaluationType(user, staff.id), is_self_target: isSelfTarget, status };
  });
}
function averageFor(evaluations: Evaluation[]) { const values = evaluations.map((evaluation) => evaluation.average_score).filter((value) => Number.isFinite(value) && value > 0); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function diff(a: number | null, b: number | null) { return a === null || b === null ? null : a - b; }
function averageScoreForItem(evaluations: Evaluation[], itemId: number) {
  const evaluationIds = new Set(evaluations.map((evaluation) => evaluation.id));
  const values = store.evaluation_scores
    .filter((score) => evaluationIds.has(score.evaluation_id) && score.item_id === itemId && !score.not_applicable && score.score !== null && Number.isFinite(score.score))
    .map((score) => Number(score.score));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function scoreItemMeta(score: JsonEvaluationScore) {
  const master = store.evaluation_items.find((item) => item.id === score.item_id);
  return {
    item_id: score.item_id,
    item_name: score.item_name || master?.item_name || "項目名未設定",
    section_name: score.section_name || master?.section_name || "未分類",
    item_order: score.item_order ?? master?.item_order ?? 0,
  };
}
function buildGlobalItemAverages(evaluations: Evaluation[]) {
  const evaluationIds = new Set(evaluations.map((evaluation) => evaluation.id));
  const groups = new Map<number, { item_id: number; item_name: string; section_name: string; item_order: number; total: number; count: number }>();
  for (const score of store.evaluation_scores) {
    if (!evaluationIds.has(score.evaluation_id) || score.not_applicable || score.score === null || !Number.isFinite(score.score)) continue;
    const meta = scoreItemMeta(score);
    const current = groups.get(score.item_id) ?? { ...meta, total: 0, count: 0 };
    current.total += Number(score.score);
    current.count += 1;
    groups.set(score.item_id, current);
  }
  return Array.from(groups.values()).map((item) => ({ item_id: item.item_id, item_name: item.item_name, section_name: item.section_name, item_order: item.item_order, average: item.count ? item.total / item.count : null, count: item.count }));
}
export function get360Summary(month = currentEvaluationMonth(), cycleId?: number) {
  const all = store.evaluations.filter((evaluation) => evaluation.is_360 === 1 && (cycleId ? evaluation.evaluation_cycle_id === cycleId : evaluation.evaluation_month === month)).map(withStaffName);
  const globalItemAverages = buildGlobalItemAverages(all);
  const globalAverageByItem = new Map(globalItemAverages.map((item) => [item.item_id, item.average]));
  const rows = getAllStaffList().map((staff) => {
    const targetEvaluations = all.filter((evaluation) => evaluation.staff_id === staff.id);
    const selfEvaluations = targetEvaluations.filter((evaluation) => evaluation.evaluation_type === "self");
    const directorEvaluations = targetEvaluations.filter((evaluation) => evaluation.evaluation_type === "director");
    const peerEvaluations = targetEvaluations.filter((evaluation) => evaluation.evaluation_type === "peer");
    const selfAverage = averageFor(selfEvaluations);
    const directorAverage = averageFor(directorEvaluations);
    const peerAverage = averageFor(peerEvaluations);
    const peerEvaluatorCount = new Set(peerEvaluations.map((evaluation) => evaluation.evaluator_user_id ?? evaluation.evaluator_name).filter(Boolean)).size;
    const itemMap = new Map<number, { item_id: number; item_name: string; section_name: string; item_order: number }>();
    for (const evaluation of targetEvaluations) {
      for (const score of store.evaluation_scores.filter((entry) => entry.evaluation_id === evaluation.id)) itemMap.set(score.item_id, scoreItemMeta(score));
    }
    const item_breakdown = Array.from(itemMap.values()).map((item) => {
      const self_average = averageScoreForItem(selfEvaluations, item.item_id);
      const peer_average = averageScoreForItem(peerEvaluations, item.item_id);
      const director_average = averageScoreForItem(directorEvaluations, item.item_id);
      const overall_average = averageScoreForItem(targetEvaluations, item.item_id);
      const clinic_average = globalAverageByItem.get(item.item_id) ?? null;
      return { ...item, self_average, peer_average, director_average, overall_average, clinic_average, difference_from_average: diff(overall_average, clinic_average) };
    });
    const selfThemeMap = themeAverageMap(selfEvaluations);
    const peerThemeMap = themeAverageMap(peerEvaluations);
    const directorThemeMap = themeAverageMap(directorEvaluations);
    const allThemeMap = themeAverageMap(targetEvaluations);
    const themeRows = evaluationThemes.map((theme) => ({
      theme,
      self_average: selfThemeMap.get(theme) ?? null,
      peer_average: peerThemeMap.get(theme) ?? null,
      director_average: directorThemeMap.get(theme) ?? null,
      overall_average: allThemeMap.get(theme) ?? null,
      self_peer_diff: diff(selfThemeMap.get(theme) ?? null, peerThemeMap.get(theme) ?? null),
      self_director_diff: diff(selfThemeMap.get(theme) ?? null, directorThemeMap.get(theme) ?? null),
      peer_director_diff: diff(peerThemeMap.get(theme) ?? null, directorThemeMap.get(theme) ?? null),
    }));
    return { staff, self_average: selfAverage, director_average: directorAverage, peer_average: peerAverage, peer_evaluator_count: peerEvaluatorCount, excluded_average: peerAverage, self_peer_diff: diff(selfAverage, peerAverage), self_director_diff: diff(selfAverage, directorAverage), evaluations: targetEvaluations, item_breakdown, theme_breakdown: themeRows };
  });
  const globalThemeAverages = themeAveragesForEvaluations(all);
  return { staff_summaries: rows, item_rankings: globalItemAverages, theme_rankings: globalThemeAverages };
}

export function get360SummaryForCycle(cycleId: number) {
  const cycle = store.evaluation_cycles.find((item) => item.id === cycleId);
  return { cycle: cycle ?? null, ...get360Summary(cycleMonth(cycle), cycleId) };
}

export function getStaffGrowthSummary(staffId: number) {
  const staff = store.staff.find((person) => person.id === staffId);
  if (!staff) return null;
  const history = getStaffEvaluationHistory(staffId);
  const current = history[0];
  const previous = history[1] ?? null;
  if (!current) {
    const cycle = getActiveCycleInternal();
    const themes = evaluationThemes.map((theme) => ({ theme, average: null, previous_average: null, change: null }));
    return { staff: enrichStaff(staff), month: cycle?.name ?? currentEvaluationMonth(), cycle, previous_month: null, overall_average: null, previous_overall_average: null, overall_change: null, themes, strengths: [], improvements: [], self_comments: "{}" };
  }
  const previousThemeMap = new Map((previous?.themes ?? []).map((item) => [item.theme, item.average]));
  const themes = current.themes.map((item) => {
    const previousAverage = previousThemeMap.get(item.theme) ?? null;
    return { ...item, previous_average: previousAverage, change: diff(item.average, previousAverage) };
  });
  const previousOverall = previous?.overall_average ?? null;
  return { staff: current.staff, month: current.cycle.name, cycle: current.cycle, previous_month: previous?.cycle.name ?? null, overall_average: current.overall_average, previous_overall_average: previousOverall, overall_change: diff(current.overall_average, previousOverall), themes, strengths: current.strengths, improvements: current.improvements, self_comments: current.self_comments };
}

export function getPreviousComparison(evaluationId: number) {
  const current = store.evaluations.find((evaluation) => evaluation.id === evaluationId); if (!current) return null;
  const previous = store.evaluations.filter((evaluation) => evaluation.staff_id === current.staff_id && evaluation.id !== current.id).filter((evaluation) => evaluation.created_at < current.created_at || (evaluation.created_at === current.created_at && evaluation.id < current.id)).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)[0];
  if (!previous) return null;
  const items = getEvaluationItemsForEvaluation(evaluationId); const currentScores = new Map(getEvaluationScores(evaluationId).map((score) => [score.item_id, score.score ?? 1])); const previousScores = new Map(getEvaluationScores(previous.id).map((score) => [score.item_id, score.score ?? 1]));
  const up: string[] = []; const down: string[] = []; const same: string[] = [];
  for (const item of items) { const diff = (currentScores.get(item.id) ?? 1) - (previousScores.get(item.id) ?? 1); if (diff > 0) up.push(item.item_name); else if (diff < 0) down.push(item.item_name); else same.push(item.item_name); }
  return { previousTotal: previous.total_score, currentTotal: current.total_score, difference: current.total_score - previous.total_score, up, down, same };
}

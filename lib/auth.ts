import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { CurrentUser, Evaluation } from "./types";
import { isDirectorRole } from "@/lib/permissions";

export const AUTH_COOKIE = "yumemirai_session";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "yumemirai-local-auth-secret";

function sign(value: string) {
  return createHmac("sha256", AUTH_SECRET).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function createSessionToken(user: CurrentUser) {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  return payload + "." + sign(payload);
}

export function readSessionToken(token: string | undefined): CurrentUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CurrentUser;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);
}

export function canViewEvaluation(user: CurrentUser, evaluation: Evaluation) {
  if (isDirectorRole(user.role)) return true;
  return evaluation.evaluation_type === "self" && evaluation.staff_id === user.staff_id;
}

export function canEditEvaluation(user: CurrentUser, evaluation: Evaluation) {
  if (isDirectorRole(user.role)) return true;
  if (canViewEvaluation(user, evaluation)) return true;
  if (evaluation.is_360 !== 1) return false;
  if (evaluation.evaluator_user_id !== null && evaluation.evaluator_user_id !== undefined && evaluation.evaluator_user_id === user.id) return true;
  if (evaluation.evaluator_staff_id !== null && evaluation.evaluator_staff_id !== undefined && user.staff_id !== null && evaluation.evaluator_staff_id === user.staff_id) return true;
  return false;
}

export function canCreateEvaluationFor(user: CurrentUser, staffId: number, evaluationType: Evaluation["evaluation_type"]) {
  if (isDirectorRole(user.role)) return true;
  return evaluationType === "self" && user.staff_id === staffId;
}

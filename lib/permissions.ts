export function isDirectorRole(role: string | null | undefined) {
  return role === "director" || role === "admin" || role === "owner";
}

export function isStaffRole(role: string | null | undefined) {
  return role === "staff";
}

import type { AdminHrRole } from "@/lib/module-access/types";
import type { TeamMember } from "@/admin/lib/types";

/** Designated Admin-HR owner (cloud Auth email). UI fallback when ACL SQL not applied. */
export const HR_OWNER_EMAIL = "hr.compliance@gmail.com";

/**
 * Resolve Admin-HR role for a signed-in email.
 *
 * Priority:
 * 1. Owner email → admin
 * 2. Active TeamMember directory row (app_state) → that role (directory is soft until hr_portal_accounts SQL)
 * 3. Else → standard (limited tabs)
 *
 * Honesty: TeamMember / localStorage are NOT backend SoT. Review-only migration
 * `admin-supabase/migrations/20261113180000_hr_portal_accounts.sql` adds real ACL.
 */
export function resolveAdminHrRoleFromEmail(
  email: string,
  team: TeamMember[] = [],
): AdminHrRole {
  const mail = email.trim().toLowerCase();
  if (!mail) return "standard";
  if (mail === HR_OWNER_EMAIL) return "admin";
  const member = team.find((m) => m.email.toLowerCase() === mail && m.active);
  if (member) return member.role;
  return "standard";
}

export function isAdminHrAdmin(email: string, team: TeamMember[] = []): boolean {
  return resolveAdminHrRoleFromEmail(email, team) === "admin";
}

import { isPreviewIsolated } from "@/lib/preview-isolated";
import { EMPTY_GRANTS, type ModuleGrants, type ResolvedAccess } from "./types";
import { resolveAccess } from "./policy";

/**
 * Resolve module grants by probing each auth boundary independently.
 * Never copies JWTs between Driver / Admin / Personal clients.
 */
export async function probeModuleGrants(): Promise<ModuleGrants> {
  if (isPreviewIsolated()) {
    return {
      compliance: "admin",
      "admin-hr": "admin",
      personal: "owner",
      dispatch: "admin",
    };
  }

  const grants: ModuleGrants = { ...EMPTY_GRANTS };

  // --- Driver Compliance (Driver Supabase + driver_portal_accounts) ---
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user) {
      const { getPortalAccount } = await import("@/lib/cloud");
      const account = await getPortalAccount(user.id);
      if (account?.active) grants.compliance = account.role;
    }
  } catch {
    /* Driver probe optional when env missing */
  }

  // --- Dispatch (same Driver project URL by default, dedicated storage + ACL) ---
  try {
    const { isDispatchSupabaseConfigured, dispatchSupabase } = await import(
      "@/dispatch/integrations/supabase/client"
    );
    if (isDispatchSupabaseConfigured()) {
      const { data } = await dispatchSupabase.auth.getSession();
      const user = data.session?.user;
      if (user) {
        const { getDispatchAccount } = await import("@/dispatch/lib/auth");
        const account = await getDispatchAccount();
        if (account?.active) grants.dispatch = account.role;
      }
    }
  } catch {
    /* Dispatch optional until shell/SQL ready */
  }

  // --- Admin Lovable Cloud (separate project — never Driver JWT) ---
  try {
    const { supabase: adminSb } = await import("@/admin/integrations/supabase/client");
    const { data } = await adminSb.auth.getSession();
    const mail = data.session?.user?.email?.toLowerCase() ?? "";
    if (mail) {
      const { resolveAdminHrRoleFromEmail } = await import("@/admin/lib/hr-access");
      grants["admin-hr"] = resolveAdminHrRoleFromEmail(mail);
    } else {
      const { readHrLocalSessionEmail } = await import("@/admin/lib/hr-auth-local");
      const localMail = readHrLocalSessionEmail();
      if (localMail) {
        // Local session is a soft gate only — still derive UI role, never claim cloud ACL.
        const { resolveAdminHrRoleFromEmail } = await import("@/admin/lib/hr-access");
        grants["admin-hr"] = resolveAdminHrRoleFromEmail(localMail);
      }
    }
  } catch {
    /* Admin probe optional */
  }

  // --- Personal (separate project; shell only until #16 approved) ---
  try {
    const { probePersonalOwnerSeat } = await import("@/personal/lib/auth-probe");
    if (await probePersonalOwnerSeat()) grants.personal = "owner";
  } catch {
    /* Personal optional */
  }

  return grants;
}

export async function probeResolvedAccess(pathname = "/"): Promise<ResolvedAccess> {
  const grants = await probeModuleGrants();
  return resolveAccess(grants, pathname);
}

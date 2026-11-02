// Driver Compliance uses its own Supabase client and account records.
import { supabase } from "@/integrations/supabase/client";

export const PORTAL_EMAIL = "hr.compliance@gmail.com";
export const LEGACY_PASSWORD_PREFIX = "Shaheen-Driver-Portal::";
const T = "tracker_sections" as never;
// Portal account tables/functions are not in generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type PortalRole = "admin" | "standard";
export interface PortalAccount {
  user_id: string;
  email: string;
  display_name: string;
  role: PortalRole;
  active: boolean;
}

function isMissingAccountsTable(error: { code?: string; message: string }) {
  return error.code === "42P01" || error.code === "PGRST205" ||
    (error.message.includes("driver_portal_accounts") && /does not exist|not find the table|schema cache/i.test(error.message));
}

function legacyOwnerAccount(userId: string): PortalAccount {
  return {
    user_id: userId,
    email: PORTAL_EMAIL,
    display_name: "HR owner",
    role: "admin",
    active: true,
  };
}

export type PortalSignInResult = { account: PortalAccount; created: boolean };

function authPasswordCandidates(email: string, password: string): string[] {
  if (email === PORTAL_EMAIL) return [LEGACY_PASSWORD_PREFIX + password, password];
  return [password];
}

function signUpPasswordFor(email: string, password: string): string {
  // Owner keeps the legacy stored form so password-change paths stay consistent.
  return email === PORTAL_EMAIL ? LEGACY_PASSWORD_PREFIX + password : password;
}

function friendlyAuthError(err: { message?: string } | null | undefined, fallback: string): string {
  const m = (err?.message ?? "").toLowerCase();
  if (/confirm|verification|not confirmed|email not confirmed/.test(m)) {
    return "Email confirmation is required. In Supabase: Authentication → Providers → Email → turn off Confirm email, then try again.";
  }
  if (/rate limit|too many/.test(m)) return "Too many attempts — wait a minute and try again.";
  if (/already registered|already been registered|user already/.test(m)) {
    return "That email is already registered but the password did not match. Check the password and try again.";
  }
  if (err?.message?.trim()) return err.message.trim();
  return fallback;
}

async function finishPortalLogin(userId: string): Promise<PortalAccount> {
  const account = await getPortalAccount(userId);
  if (!account || !account.active) {
    await supabase.auth.signOut();
    throw new Error(
      account
        ? "This account is not active in Driver Compliance."
        : "Signed in, but Driver ACL bootstrap failed. Paste the driver_portal_ensure_self SQL in Supabase, then try again.",
    );
  }
  return account;
}

/**
 * Sign in with the password the user typed. If Auth user is missing, auto sign-up
 * with the same email+password (no invented secrets), then continue the session.
 */
export async function signInPortalAccount(email: string, password: string): Promise<PortalSignInResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) throw new Error("Email and password are required.");

  for (const authPassword of authPasswordCandidates(normalizedEmail, password)) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: authPassword,
    });
    if (!error && data.user) {
      return { account: await finishPortalLogin(data.user.id), created: false };
    }
  }

  // Auth user missing (or wrong password) → try create with the typed password.
  const signUpPassword = signUpPasswordFor(normalizedEmail, password);
  const { data: signedUp, error: signUpError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: signUpPassword,
    options: {
      data: { display_name: normalizedEmail === PORTAL_EMAIL ? "HR owner" : "" },
    },
  });

  if (signUpError) {
    throw new Error(friendlyAuthError(signUpError, "Could not create the Driver Compliance account."));
  }

  if (signedUp.session?.user) {
    return { account: await finishPortalLogin(signedUp.session.user.id), created: true };
  }

  // Confirm-email projects return a user without a session — try immediate sign-in anyway.
  const { data: after, error: afterErr } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: signUpPassword,
  });
  if (!afterErr && after.user) {
    return { account: await finishPortalLogin(after.user.id), created: true };
  }

  if (signedUp.user && !signedUp.session) {
    throw new Error(
      "Account was created but email confirmation is required. In Supabase: Authentication → Providers → Email → turn off Confirm email, then sign in again with the same password.",
    );
  }

  throw new Error(friendlyAuthError(afterErr, "Could not sign in after creating the account."));
}

export async function getPortalAccount(userId: string): Promise<PortalAccount | null> {
  const { data, error } = await db
    .from("driver_portal_accounts")
    .select("user_id, email, display_name, role, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingAccountsTable(error)) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);
      if (userData.user?.id === userId && userData.user.email?.toLowerCase() === PORTAL_EMAIL) {
        return legacyOwnerAccount(userId);
      }
    }
    throw new Error(error.message);
  }
  if (data && (data.role === "admin" || data.role === "standard")) {
    return { ...data, role: data.role as PortalRole };
  }

  // Empty / missing ACL row: try bootstrap RPC (owner or first admin on a fresh project).
  const { data: ensured, error: ensureErr } = await db.rpc("driver_portal_ensure_self", {
    p_display_name: "HR owner",
  });
  if (!ensureErr && ensured) {
    const row = Array.isArray(ensured) ? ensured[0] : ensured;
    if (row && (row.role === "admin" || row.role === "standard")) {
      return {
        user_id: row.user_id,
        email: row.email,
        display_name: row.display_name,
        role: row.role as PortalRole,
        active: Boolean(row.active),
      };
    }
  }
  return null;
}

export async function hasPortalSession(): Promise<boolean> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return Boolean(data.session);
}

export function subscribePortalAuth(callback: (signedIn: boolean) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(Boolean(session)));
  return () => data.subscription.unsubscribe();
}

export async function updatePortalProfile(displayName: string): Promise<string> {
  const { data, error } = await db.rpc("driver_portal_update_profile", { p_display_name: displayName });
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePortalAccess(userId: string, role: PortalRole, active: boolean): Promise<void> {
  const { error } = await db.rpc("driver_portal_set_access", { p_user_id: userId, p_role: role, p_active: active });
  if (error) throw new Error(error.message);
}

export async function listPortalAccounts(): Promise<PortalAccount[]> {
  const { data, error } = await db
    .from("driver_portal_accounts")
    .select("user_id, email, display_name, role, active")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).filter((account: PortalAccount): account is PortalAccount => account.role === "admin" || account.role === "standard");
}

export async function createPortalAccount(input: { email: string; displayName: string; password: string }): Promise<void> {
  const { error } = await supabase.functions.invoke("create-driver-user", { body: input });
  if (error) throw new Error(error.message);
}

export async function listPortalActivity() {
  const { data, error } = await db
    .from("driver_portal_activity")
    .select("id, actor_name, action, section_id, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Best-effort cloud activity write (trigger also logs tracker_sections upserts). */
export async function logPortalActivity(input: {
  actorName: string;
  action: string;
  sectionId?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await db.from("driver_portal_activity").insert({
    actor_id: userData.user?.id ?? null,
    actor_name: input.actorName,
    action: input.action,
    section_id: input.sectionId ?? "portal",
  });
  if (error) throw new Error(error.message);
}

export async function updatePortalPassword(password: string, isOwner: boolean): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: isOwner ? LEGACY_PASSWORD_PREFIX + password : password,
  });
  if (error) throw new Error(error.message);
}

export async function cloudStamp() {
  const { data: rows, error } = await db.from(T).select("updated_at").order("updated_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const r = (rows as unknown as { updated_at: string }[] | null)?.[0];
  return { stamp: r?.updated_at ?? "" };
}

export async function cloudLoad() {
  const { data: rows, error } = await db.from(T).select("id, data, updated_at");
  if (error) throw new Error(error.message);
  const list = (rows as unknown as { id: string; data: unknown; updated_at: string }[]) ?? [];
  const stamp = list.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), "");
  return { sections: Object.fromEntries(list.map((r) => [r.id, JSON.stringify(r.data)])) as Record<string, string>, stamp };
}

export async function cloudSave({ data }: { data: { sections: Record<string, string> } }) {
  const now = new Date().toISOString();
  const rows = Object.entries(data.sections).map(([id, json]) => ({ id, data: JSON.parse(json), updated_at: now }));
  if (!rows.length) return { stamp: "" };
  const { data: out, error } = await db.from(T).upsert(rows as never).select("updated_at");
  if (error) throw new Error(error.message);
  const list = (out as unknown as { updated_at: string }[]) ?? [];
  return { stamp: list.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), "") };
}

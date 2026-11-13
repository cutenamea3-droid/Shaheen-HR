import { dispatchSupabase, isDispatchSupabaseConfigured } from "@/dispatch/integrations/supabase/client";
import { isPreviewIsolated } from "@/lib/preview-isolated";
import type { DispatchAccount, DispatchRole } from "./types";

const PREVIEW_ACCOUNT: DispatchAccount = {
  user_id: "preview-dispatch-admin",
  email: "dispatch.preview@shaheen.local",
  display_name: "Dispatch Preview",
  role: "admin",
  active: true,
};

export function isDispatchPreviewMode(): boolean {
  return isPreviewIsolated() || !isDispatchSupabaseConfigured();
}

export async function getDispatchSessionUser(): Promise<{ id: string; email: string } | null> {
  if (isDispatchPreviewMode()) {
    return { id: PREVIEW_ACCOUNT.user_id, email: PREVIEW_ACCOUNT.email };
  }
  const { data, error } = await dispatchSupabase.auth.getSession();
  if (error || !data.session?.user) return null;
  return { id: data.session.user.id, email: data.session.user.email ?? "" };
}

export async function getDispatchAccount(): Promise<DispatchAccount | null> {
  if (isDispatchPreviewMode()) return PREVIEW_ACCOUNT;

  const user = await getDispatchSessionUser();
  if (!user) return null;

  const { data, error } = await dispatchSupabase
    .from("dispatch_portal_accounts")
    .select("user_id, email, display_name, role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data && data.active && (data.role === "admin" || data.role === "dispatcher")) {
    return data as DispatchAccount;
  }

  const { data: ensured, error: ensureError } = await dispatchSupabase.rpc("dispatch_ensure_self", {
    p_display_name: user.email?.split("@")[0] ?? "Dispatcher",
  });
  if (ensureError) return null;
  const row = Array.isArray(ensured) ? ensured[0] : ensured;
  if (!row || !row.active) return null;
  return row as DispatchAccount;
}

export async function signInDispatch(email: string, password: string): Promise<DispatchAccount> {
  if (isDispatchPreviewMode()) {
    if (!email.trim() || !password) throw new Error("Enter email and password.");
    return PREVIEW_ACCOUNT;
  }
  const { error } = await dispatchSupabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error("Invalid credentials.");
  const account = await getDispatchAccount();
  if (!account) {
    await dispatchSupabase.auth.signOut();
    throw new Error("No active Dispatch account for this login.");
  }
  return account;
}

export async function signOutDispatch(): Promise<void> {
  if (isDispatchPreviewMode()) return;
  await dispatchSupabase.auth.signOut();
}

export async function listDispatchAccounts(): Promise<DispatchAccount[]> {
  if (isDispatchPreviewMode()) return [PREVIEW_ACCOUNT];
  const { data, error } = await dispatchSupabase
    .from("dispatch_portal_accounts")
    .select("user_id, email, display_name, role, active")
    .order("email");
  if (error) throw error;
  return (data ?? []) as DispatchAccount[];
}

export async function setDispatchAccess(userId: string, role: DispatchRole, active: boolean): Promise<void> {
  if (isDispatchPreviewMode()) return;
  const { error } = await dispatchSupabase.rpc("dispatch_set_access", {
    p_user_id: userId,
    p_role: role,
    p_active: active,
  });
  if (error) throw error;
}

export async function inviteDispatchUser(input: {
  email: string;
  displayName: string;
  password: string;
  role: DispatchRole;
}): Promise<void> {
  if (isDispatchPreviewMode()) {
    throw new Error("Invite is disabled in preview/fixture mode. Apply Dispatch ACL SQL and use cloud auth.");
  }
  const { data, error } = await dispatchSupabase.functions.invoke("create-dispatch-user", {
    body: {
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      password: input.password,
      role: input.role,
    },
  });
  if (error) throw new Error(error.message || "Could not invite dispatcher.");
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
}

export function isDispatchPath(pathname: string): boolean {
  return pathname === "/dispatch" || pathname.startsWith("/dispatch/");
}

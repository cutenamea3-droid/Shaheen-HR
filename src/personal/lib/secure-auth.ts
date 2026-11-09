/**
 * Personal secure auth via dedicated Supabase project.
 * Falls back is handled by callers using personalAuthMode() — this module never
 * talks to Driver or Admin clients.
 */
import { getPersonalSupabase } from "@/personal/integrations/supabase/client";
import { isPersonalSecureEnabled, isPersonalSignupAllowed } from "./secure-config";

export type PersonalSecureSession = {
  userId: string;
  email: string | null;
};

function clientOrThrow() {
  const sb = getPersonalSupabase();
  if (!sb) throw new Error("Personal secure backend is not configured.");
  return sb;
}

export async function readPersonalSecureSession(): Promise<PersonalSecureSession | null> {
  if (!isPersonalSecureEnabled()) return null;
  const sb = getPersonalSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session?.user) return null;
  return {
    userId: data.session.user.id,
    email: data.session.user.email ?? null,
  };
}

export async function signInPersonalSecure(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPersonalSecureEnabled()) return { ok: false, message: "Invalid credentials." };
  const login = email.trim().toLowerCase();
  if (!login || password.length < 4) return { ok: false, message: "Invalid credentials." };
  try {
    const sb = clientOrThrow();
    const { error } = await sb.auth.signInWithPassword({ email: login, password });
    if (error) return { ok: false, message: "Invalid credentials." };
    return { ok: true };
  } catch {
    return { ok: false, message: "Invalid credentials." };
  }
}

export async function signUpPersonalSecure(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPersonalSignupAllowed()) return { ok: false, message: "Invalid credentials." };
  const login = email.trim().toLowerCase();
  if (!login || password.length < 4) return { ok: false, message: "Invalid credentials." };
  try {
    const sb = clientOrThrow();
    const { error } = await sb.auth.signUp({
      email: login,
      password,
      options: { data: { handle: login.split("@")[0] } },
    });
    if (error) return { ok: false, message: "Invalid credentials." };
    return { ok: true };
  } catch {
    return { ok: false, message: "Invalid credentials." };
  }
}

export async function signOutPersonalSecure(): Promise<void> {
  const sb = getPersonalSupabase();
  if (!sb) return;
  try {
    await sb.auth.signOut();
  } catch {
    // ignore
  }
}

export async function updatePersonalSecurePassword(
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPersonalSecureEnabled()) return { ok: false, message: "Secure mode off." };
  if (password.length < 8) return { ok: false, message: "Use at least 8 characters." };
  try {
    const sb = clientOrThrow();
    const { error } = await sb.auth.updateUser({ password });
    if (error) return { ok: false, message: "Could not update password." };
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not update password." };
  }
}

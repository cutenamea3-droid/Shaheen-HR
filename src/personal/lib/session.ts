/**
 * Unified Personal session helpers (local mock OR secure Supabase).
 */
import {
  clearPersonalSession as clearLocalSession,
  readPersonalSession as readLocalSession,
  readPersonalSessionLogin,
  writePersonalSession as writeLocalSession,
  hasPersonalCredentials,
  setPersonalCredentials,
  verifyPersonalCredentials,
} from "./auth";
import {
  readPersonalSecureSession,
  signInPersonalSecure,
  signOutPersonalSecure,
  signUpPersonalSecure,
} from "./secure-auth";
import {
  isPersonalSecureEnabled,
  isPersonalSignupAllowed,
  personalAuthMode,
} from "./secure-config";
import { startPersonalCloudSync, stopPersonalCloudSync } from "./cloud-sync";

export { personalAuthMode, isPersonalSecureEnabled, isPersonalSignupAllowed };

export async function hydratePersonalAuth(): Promise<boolean> {
  if (isPersonalSecureEnabled()) {
    const s = await readPersonalSecureSession();
    if (s) {
      startPersonalCloudSync(s.userId);
      return true;
    }
    stopPersonalCloudSync();
    return false;
  }
  return readLocalSession();
}

export function personalNeedsSetup(): boolean {
  if (isPersonalSecureEnabled()) {
    // Secure cloud Auth: existing owners sign in with password only.
    // Optional bootstrap signup is an explicit LoginGate toggle when
    // VITE_PERSONAL_ALLOW_SIGNUP=1 — never force Confirm password on every visit.
    return false;
  }
  return !hasPersonalCredentials();
}

export async function personalSignIn(
  login: string,
  password: string,
  password2?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const handle =
    login == null ? "" : (typeof login === "string" ? login : String(login)).trim();
  if (isPersonalSecureEnabled()) {
    const needsSignup = isPersonalSignupAllowed() && Boolean(password2);
    if (needsSignup) {
      if (password !== password2) return { ok: false, message: "Invalid credentials." };
      const created = await signUpPersonalSecure(handle, password);
      if (!created.ok) return created;
      // Prefer immediate session; if email confirm required, try sign-in anyway.
      const signed = await signInPersonalSecure(handle, password);
      if (signed.ok) {
        const s = await readPersonalSecureSession();
        if (s) startPersonalCloudSync(s.userId);
      }
      return signed.ok ? signed : created;
    }
    const result = await signInPersonalSecure(handle, password);
    if (result.ok) {
      const s = await readPersonalSecureSession();
      if (s) startPersonalCloudSync(s.userId);
    }
    return result;
  }

  // Local mock gate
  const setup = !hasPersonalCredentials();
  try {
    if (setup) {
      if (!handle || password.length < 4 || password !== password2) {
        return { ok: false, message: "Invalid credentials." };
      }
      await setPersonalCredentials(handle, password);
      writeLocalSession(handle);
      return { ok: true };
    }
    const ok = await verifyPersonalCredentials(handle, password);
    if (!ok) return { ok: false, message: "Invalid credentials." };
    writeLocalSession(handle);
    return { ok: true };
  } catch {
    return { ok: false, message: "Invalid credentials." };
  }
}

export async function personalSignOut(): Promise<void> {
  stopPersonalCloudSync();
  // Flip study UI lock immediately so LoginGate shows even if Auth network is slow.
  try {
    const { usePersonal } = await import("@/personal/lib/store");
    usePersonal.setState({ authed: false });
  } catch {
    /* ignore */
  }
  if (isPersonalSecureEnabled()) {
    await signOutPersonalSecure();
  }
  clearLocalSession();
}

export async function personalSessionLabel(): Promise<string | null> {
  if (isPersonalSecureEnabled()) {
    const s = await readPersonalSecureSession();
    return s?.email ?? null;
  }
  return readPersonalSessionLogin();
}

/** Client route gate — SPA-only until CF Functions phase 2. */
export async function personalRouteAllowsStudyUi(): Promise<boolean> {
  return hydratePersonalAuth();
}

/** Admin & Attendance sign-in decision helper (cloud + local fallback).
 * Pure of React; callers own request generation / double-submit guards.
 */

/** Loose shape for Supabase AuthError / transport failures (avoid tight coupling). */
export type HrAuthErrorLike = {
  message?: string | undefined;
  status?: number | undefined;
  name?: string | undefined;
  code?: string | undefined;
} | null;

export type HrLoginDeps = {
  signInWithPassword: (creds: {
    email: string;
    password: string;
  }) => Promise<{ error: HrAuthErrorLike }>;
  signOut: () => Promise<unknown>;
  hasHrLocalPassword: (email: string) => boolean;
  verifyHrLocalPassword: (email: string, password: string) => Promise<boolean>;
  writeHrLocalSession: (email: string) => void;
  clearHrLocalSession: () => void;
  /** Return true when a newer attempt superseded this one. */
  isStale?: (() => boolean) | undefined;
};

export type HrLoginSuccess = { ok: true; mode: "cloud" | "local" };
export type HrLoginFailure = {
  ok: false;
  kind: "credentials" | "network" | "stale";
  message: string;
};
export type HrLoginResult = HrLoginSuccess | HrLoginFailure;

export const HR_LOGIN_CREDENTIALS_MSG = "Wrong email or password";
export const HR_LOGIN_NETWORK_MSG = "Couldn't reach the server. Try again.";

function staleResult(): HrLoginFailure {
  return { ok: false, kind: "stale", message: "" };
}

function checkStale(deps: HrLoginDeps): HrLoginFailure | null {
  return deps.isStale?.() ? staleResult() : null;
}

/** Classify Supabase auth failures vs transport / unexpected errors. */
export function classifyHrLoginError(error: unknown): "credentials" | "network" {
  if (error == null) return "credentials";

  if (typeof TypeError !== "undefined" && error instanceof TypeError) {
    return "network";
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("failed to fetch") ||
      msg.includes("network") ||
      msg.includes("fetch") ||
      msg.includes("timeout") ||
      msg.includes("abort") ||
      msg.includes("offline")
    ) {
      return "network";
    }
  }

  const e = error as HrAuthErrorLike;
  if (!e || typeof e !== "object") return "credentials";

  const status = e.status;
  if (status === 0 || status === 408 || status === 429 || status === 502 || status === 503 || status === 504) {
    return "network";
  }

  const msg = (e.message ?? "").toLowerCase();
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("offline")
  ) {
    return "network";
  }

  // Typical AuthApiError for bad password is 400 + "Invalid login credentials".
  return "credentials";
}

export function hrLoginFailureMessage(kind: "credentials" | "network"): string {
  return kind === "network" ? HR_LOGIN_NETWORK_MSG : HR_LOGIN_CREDENTIALS_MSG;
}

/**
 * Attempt Admin sign-in: prefer cloud; honor newer local password when present;
 * fall back to local session when cloud rejects but local hash matches.
 */
export async function attemptHrLogin(
  email: string,
  password: string,
  deps: HrLoginDeps,
): Promise<HrLoginResult> {
  const mail = email.trim().toLowerCase();
  if (!mail || !password) {
    return { ok: false, kind: "credentials", message: HR_LOGIN_CREDENTIALS_MSG };
  }

  try {
    const hasLocal = deps.hasHrLocalPassword(mail);
    const localOk = hasLocal && (await deps.verifyHrLocalPassword(mail, password));
    const early = checkStale(deps);
    if (early) return early;

    let cloudError: HrAuthErrorLike = null;
    try {
      const { error } = await deps.signInWithPassword({ email: mail, password });
      cloudError = error;
    } catch (thrown) {
      const late = checkStale(deps);
      if (late) return late;
      const kind = classifyHrLoginError(thrown);
      return { ok: false, kind, message: hrLoginFailureMessage(kind) };
    }

    const afterSignIn = checkStale(deps);
    if (afterSignIn) return afterSignIn;

    if (!cloudError) {
      // Local hash exists but typed password does not match it → reject stale cloud password.
      if (hasLocal && !localOk) {
        await deps.signOut();
        const afterSignOut = checkStale(deps);
        if (afterSignOut) return afterSignOut;
        return { ok: false, kind: "credentials", message: HR_LOGIN_CREDENTIALS_MSG };
      }
      deps.clearHrLocalSession();
      const afterClear = checkStale(deps);
      if (afterClear) return afterClear;
      return { ok: true, mode: "cloud" };
    }

    if (localOk) {
      deps.writeHrLocalSession(mail);
      const afterLocal = checkStale(deps);
      if (afterLocal) return afterLocal;
      return { ok: true, mode: "local" };
    }

    const kind = classifyHrLoginError(cloudError);
    return { ok: false, kind, message: hrLoginFailureMessage(kind) };
  } catch (thrown) {
    const late = checkStale(deps);
    if (late) return late;
    const kind = classifyHrLoginError(thrown);
    return { ok: false, kind, message: hrLoginFailureMessage(kind) };
  }
}

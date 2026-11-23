/**
 * Harden Admin Supabase Auth persistence for browsers with storage/VPN quirks
 * (e.g. Opera). Dual-writes the session so soft refresh can restore Cloud Saved
 * without falling back to a sticky local-only badge.
 *
 * Pure of React. Never touches Driver Auth / VITE_SUPABASE_*.
 */

export const HR_AUTH_SESSION_BACKUP_KEY = "shaheen-hr-sb-session-backup-v1";
export const HR_CLOUD_EMAIL_HINT_KEY = "shaheen-hr-cloud-email-hint-v1";

export type HrPersistedSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
  expires_in?: number | null;
  token_type?: string | null;
  user?: { id?: string | null; email?: string | null } | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storageOrNull(): StorageLike | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function normalizeEmail(email: unknown): string {
  if (email == null) return "";
  return (typeof email === "string" ? email : String(email)).trim().toLowerCase();
}

function isSessionShape(v: unknown): v is HrPersistedSession {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.access_token === "string" && typeof o.refresh_token === "string";
}

/** Best-effort: ask the browser to keep origin storage (helps Opera/VPN purge quirks). */
export async function requestHrAuthPersistentStorage(
  persistFn: (() => Promise<boolean>) | undefined = typeof navigator !== "undefined"
    ? navigator.storage?.persist?.bind(navigator.storage)
    : undefined,
): Promise<boolean> {
  if (!persistFn) return false;
  try {
    return Boolean(await persistFn());
  } catch {
    return false;
  }
}

export function writeHrCloudEmailHint(
  email: string,
  store: StorageLike | null = storageOrNull(),
): void {
  if (!store) return;
  const mail = normalizeEmail(email);
  if (!mail) return;
  try {
    store.setItem(HR_CLOUD_EMAIL_HINT_KEY, mail);
  } catch {
    /* quota / private mode */
  }
}

export function readHrCloudEmailHint(store: StorageLike | null = storageOrNull()): string | null {
  if (!store) return null;
  try {
    const raw = store.getItem(HR_CLOUD_EMAIL_HINT_KEY);
    const mail = normalizeEmail(raw);
    return mail || null;
  } catch {
    return null;
  }
}

export function clearHrCloudEmailHint(store: StorageLike | null = storageOrNull()): void {
  if (!store) return;
  try {
    store.removeItem(HR_CLOUD_EMAIL_HINT_KEY);
  } catch {
    /* ignore */
  }
}

export function writeHrAuthSessionBackup(
  session: HrPersistedSession | null | undefined,
  store: StorageLike | null = storageOrNull(),
): boolean {
  if (!store || !session?.access_token || !session?.refresh_token) return false;
  try {
    const payload: HrPersistedSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? null,
      expires_in: session.expires_in ?? null,
      token_type: session.token_type ?? "bearer",
      user: session.user
        ? { id: session.user.id ?? null, email: session.user.email ?? null }
        : null,
    };
    store.setItem(HR_AUTH_SESSION_BACKUP_KEY, JSON.stringify(payload));
    const mail = normalizeEmail(session.user?.email);
    if (mail) writeHrCloudEmailHint(mail, store);
    return true;
  } catch {
    return false;
  }
}

export function readHrAuthSessionBackup(
  store: StorageLike | null = storageOrNull(),
): HrPersistedSession | null {
  if (!store) return null;
  try {
    const raw = store.getItem(HR_AUTH_SESSION_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isSessionShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearHrAuthSessionBackup(store: StorageLike | null = storageOrNull()): void {
  if (!store) return;
  try {
    store.removeItem(HR_AUTH_SESSION_BACKUP_KEY);
  } catch {
    /* ignore */
  }
}

/** Clear backup + email hint (intentional sign-out). */
export function clearHrAuthPersistArtifacts(store: StorageLike | null = storageOrNull()): void {
  clearHrAuthSessionBackup(store);
  clearHrCloudEmailHint(store);
}

/**
 * After password Sign In: dual-write session, request durable storage, re-apply via setSession
 * so soft refresh can recover when the default Supabase storage key is flaky.
 */
export async function ensureHrAuthPersisted(
  session: HrPersistedSession | null | undefined,
  opts: {
    setSession: (s: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{ error: unknown }>;
    persistStorage?: (() => Promise<boolean>) | undefined;
    store?: StorageLike | null;
  },
): Promise<{ ok: boolean; backedUp: boolean }> {
  if (!session?.access_token || !session?.refresh_token) {
    return { ok: false, backedUp: false };
  }
  const store = opts.store === undefined ? storageOrNull() : opts.store;
  void requestHrAuthPersistentStorage(opts.persistStorage);
  const backedUp = writeHrAuthSessionBackup(session, store);
  try {
    const { error } = await opts.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) return { ok: false, backedUp };
    // Re-write after setSession in case the client storage adapter lagged.
    writeHrAuthSessionBackup(session, store);
    return { ok: true, backedUp };
  } catch {
    return { ok: false, backedUp };
  }
}

export type HrAuthClient = {
  getSession: () => Promise<{ data: { session: HrPersistedSession | null } }>;
  setSession: (s: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ data: { session: HrPersistedSession | null }; error: unknown }>;
  refreshSession: () => Promise<{ data: { session: HrPersistedSession | null }; error: unknown }>;
  getUser: () => Promise<{ data: { user: { id: string; email?: string | null } | null } }>;
};

/**
 * Soft-refresh recovery: getSession → brief delay → backup setSession → refreshSession → getUser.
 * Prefer cloud Auth before any local-only fallback.
 */
export async function recoverHrAuthSession(
  client: HrAuthClient,
  opts: {
    store?: StorageLike | null;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<HrPersistedSession | null> {
  const store = opts.store === undefined ? storageOrNull() : opts.store;
  const sleep =
    opts.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const delayMs = opts.delayMs ?? 160;

  let session = (await client.getSession()).data.session;
  if (session?.access_token) {
    writeHrAuthSessionBackup(session, store);
    return session;
  }

  // Opera / partitioned storage can lag the first read after soft refresh.
  await sleep(delayMs);
  session = (await client.getSession()).data.session;
  if (session?.access_token) {
    writeHrAuthSessionBackup(session, store);
    return session;
  }

  const backup = readHrAuthSessionBackup(store);
  if (backup?.access_token && backup.refresh_token) {
    try {
      const { data, error } = await client.setSession({
        access_token: backup.access_token,
        refresh_token: backup.refresh_token,
      });
      if (!error && data.session?.access_token) {
        writeHrAuthSessionBackup(data.session, store);
        return data.session;
      }
    } catch {
      /* try refresh next */
    }
  }

  try {
    const { data, error } = await client.refreshSession();
    if (!error && data.session?.access_token) {
      writeHrAuthSessionBackup(data.session, store);
      return data.session;
    }
  } catch {
    /* continue */
  }

  try {
    const { data: userData } = await client.getUser();
    if (userData.user) {
      session = (await client.getSession()).data.session;
      if (session?.access_token) {
        writeHrAuthSessionBackup(session, store);
        return session;
      }
    }
  } catch {
    /* stay signed out / local-only */
  }

  return null;
}

/** Email to show on reconnect / lock when Auth is missing (local session or prior cloud hint). */
export function resolveHrReconnectEmail(opts: {
  localSessionEmail: string | null;
  cloudHintEmail: string | null;
  fallbackEmail?: string;
}): string {
  return (
    normalizeEmail(opts.localSessionEmail) ||
    normalizeEmail(opts.cloudHintEmail) ||
    normalizeEmail(opts.fallbackEmail) ||
    ""
  );
}

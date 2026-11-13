/**
 * Local credential gate for HR Personal — separate from company Admin auth.
 * Honesty: hashed secrets in localStorage, NOT server auth / MFA.
 * Never store real passwords in source, repo, or VITE_* env.
 */
const SECRETS_KEY = "hr-personal-auth-secrets-v1";
const SESSION_KEY = "hr-personal-auth-session-v1";

type SecretsMap = Record<string, string>;

/** Legacy single-gate key from earlier PIN prototype. */
const LEGACY_HANDLE = "hr.personal";

function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

function read(): SecretsMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SECRETS_KEY) || "{}") as SecretsMap;
  } catch {
    return {};
  }
}

function write(map: SecretsMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SECRETS_KEY, JSON.stringify(map));
}

async function hash(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure context required for Personal gate.");
  }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`hr-personal::${value}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPersonalCredentials(): boolean {
  return Object.keys(read()).length > 0;
}

/** @deprecated use hasPersonalCredentials */
export function hasPersonalPassword(): boolean {
  return hasPersonalCredentials();
}

export async function setPersonalCredentials(login: string, password: string) {
  const key = normalizeLogin(login);
  if (!key) throw new Error("Enter a username or email.");
  if (password.length < 4) throw new Error("Use at least 4 characters.");
  const map = read();
  map[key] = await hash(password);
  // Drop legacy anonymous key once a real login is set.
  delete map[LEGACY_HANDLE];
  write(map);
}

/** @deprecated */
export async function setPersonalPassword(password: string) {
  await setPersonalCredentials(LEGACY_HANDLE, password);
}

export async function verifyPersonalCredentials(login: string, password: string): Promise<boolean> {
  const map = read();
  const key = normalizeLogin(login);
  const h = await hash(password);
  if (key && map[key] === h) return true;
  // Legacy PIN-only gate (single secret under hr.personal).
  if (map[LEGACY_HANDLE] === h && (key === LEGACY_HANDLE || Object.keys(map).length === 1)) {
    return true;
  }
  return false;
}

/** @deprecated */
export async function verifyPersonalPassword(password: string): Promise<boolean> {
  return verifyPersonalCredentials(LEGACY_HANDLE, password);
}

export function writePersonalSession(login: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeLogin(login) || LEGACY_HANDLE;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ login: normalized, handle: normalized, at: Date.now() }));
}

export function clearPersonalSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function readPersonalSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { login?: string; handle?: string };
    return Boolean(parsed.login || parsed.handle);
  } catch {
    return false;
  }
}

export function readPersonalSessionLogin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { login?: string; handle?: string };
    return parsed.login || parsed.handle || null;
  } catch {
    return null;
  }
}

export const PERSONAL_AUTH_KEYS = [SECRETS_KEY, SESSION_KEY] as const;

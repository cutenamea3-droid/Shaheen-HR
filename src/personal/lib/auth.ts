/**
 * Private gate for HR Personal — separate keys from company Admin auth.
 * Never touch `shaheen-hr-account-*` or Driver lock keys.
 */
const SECRETS_KEY = "hr-personal-auth-secrets-v1";
const SESSION_KEY = "hr-personal-auth-session-v1";

type SecretsMap = Record<string, string>;

const DEFAULT_HANDLE = "hr.personal";

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

export function personalAuthHandle(): string {
  return DEFAULT_HANDLE;
}

export function hasPersonalPassword(): boolean {
  return Boolean(read()[DEFAULT_HANDLE]);
}

export async function setPersonalPassword(password: string) {
  const map = read();
  map[DEFAULT_HANDLE] = await hash(password);
  write(map);
}

export async function verifyPersonalPassword(password: string): Promise<boolean> {
  const stored = read()[DEFAULT_HANDLE];
  if (!stored) return false;
  return stored === (await hash(password));
}

export function writePersonalSession() {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ handle: DEFAULT_HANDLE, at: Date.now() }));
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
    const parsed = JSON.parse(raw) as { handle?: string };
    return parsed.handle === DEFAULT_HANDLE;
  } catch {
    return false;
  }
}

/** Keys this module owns — used by isolation tests. */
export const PERSONAL_AUTH_KEYS = [SECRETS_KEY, SESSION_KEY] as const;

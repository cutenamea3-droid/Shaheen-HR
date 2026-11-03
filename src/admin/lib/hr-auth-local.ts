/** Local password hashes for Admin & Attendance My Account.
 * Separate from `hr-attendance-v1` attendance data.
 */
const SECRETS_KEY = "shaheen-hr-account-secrets-v1";
const SESSION_KEY = "shaheen-hr-account-session-v1";

type SecretsMap = Record<string, string>;

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
    throw new Error("Secure context required to change password.");
  }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasHrLocalPassword(email: string): boolean {
  return Boolean(read()[email.trim().toLowerCase()]);
}

export async function setHrLocalPassword(email: string, password: string) {
  const map = read();
  map[email.trim().toLowerCase()] = await hash(password);
  write(map);
}

export async function verifyHrLocalPassword(email: string, password: string): Promise<boolean> {
  const stored = read()[email.trim().toLowerCase()];
  if (!stored) return false;
  return stored === (await hash(password));
}

export function writeHrLocalSession(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email: email.trim().toLowerCase() }));
}

export function clearHrLocalSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function readHrLocalSessionEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string };
    return parsed.email?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

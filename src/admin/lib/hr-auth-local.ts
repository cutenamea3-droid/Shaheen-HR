/** Local password hashes for Admin & Attendance My Account.
 * Separate from `hr-attendance-v1` attendance data.
 */
const SECRETS_KEY = "shaheen-hr-account-secrets-v1";
const SESSION_KEY = "shaheen-hr-account-session-v1";

type SecretsMap = Record<string, string>;

function read(): SecretsMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(SECRETS_KEY) || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as SecretsMap)
      : {};
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

function normalizeEmail(email: unknown): string {
  if (email == null) return "";
  return (typeof email === "string" ? email : String(email)).trim().toLowerCase();
}

export function hasHrLocalPassword(email: string): boolean {
  return Boolean(read()[normalizeEmail(email)]);
}

export async function setHrLocalPassword(email: string, password: string) {
  const map = read();
  map[normalizeEmail(email)] = await hash(password);
  write(map);
}

export async function verifyHrLocalPassword(email: string, password: string): Promise<boolean> {
  const stored = read()[normalizeEmail(email)];
  if (!stored) return false;
  return stored === (await hash(password));
}

export function writeHrLocalSession(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email: normalizeEmail(email) }));
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
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const email = (parsed as { email?: string }).email;
    return typeof email === "string" ? email.trim().toLowerCase() || null : null;
  } catch {
    return null;
  }
}

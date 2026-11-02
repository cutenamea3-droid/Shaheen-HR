/** Local persistence for Driver Compliance accounts, activity, and password hashes.
 * Separate from tracker data key `shaheen-driver-tracker-v1`.
 * Secrets stay off the attendance key as well (`shaheen-hr-account-secrets-v1` is Admin-only).
 */
import type { PortalAccount, PortalRole } from "./cloud";

const ACCOUNTS_KEY = "shaheen-driver-portal-accounts-v1";
const ACTIVITY_KEY = "shaheen-driver-portal-activity-v1";
const SECRETS_KEY = "shaheen-driver-portal-secrets-v1";
const SESSION_KEY = "shaheen-driver-portal-session-v1";

export type LocalActivity = {
  id: string;
  actor_name: string;
  action: string;
  section_id: string;
  occurred_at: string;
};

type SecretsMap = Record<string, string>;

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `u_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export async function hashSecret(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function listLocalAccounts(): PortalAccount[] {
  return readJson<PortalAccount[]>(ACCOUNTS_KEY, []);
}

export function saveLocalAccounts(accounts: PortalAccount[]) {
  writeJson(ACCOUNTS_KEY, accounts);
}

export function ensureLocalOwner(account: PortalAccount) {
  const list = listLocalAccounts();
  if (list.some((a) => a.user_id === account.user_id || a.email.toLowerCase() === account.email.toLowerCase())) return;
  saveLocalAccounts([{ ...account, role: account.role || "admin", active: true }, ...list]);
}

export function upsertLocalAccount(account: PortalAccount) {
  const list = listLocalAccounts();
  const i = list.findIndex((a) => a.user_id === account.user_id);
  if (i >= 0) list[i] = account;
  else list.push(account);
  saveLocalAccounts(list);
}

export function removeLocalAccount(userId: string) {
  saveLocalAccounts(listLocalAccounts().filter((a) => a.user_id !== userId));
  const secrets = readJson<SecretsMap>(SECRETS_KEY, {});
  delete secrets[userId];
  writeJson(SECRETS_KEY, secrets);
}

export async function setLocalPassword(userId: string, password: string) {
  const secrets = readJson<SecretsMap>(SECRETS_KEY, {});
  secrets[userId] = await hashSecret(password);
  writeJson(SECRETS_KEY, secrets);
}

export async function verifyLocalPassword(userId: string, password: string): Promise<boolean> {
  const secrets = readJson<SecretsMap>(SECRETS_KEY, {});
  const stored = secrets[userId];
  if (!stored) return false;
  return stored === (await hashSecret(password));
}

/** True when this user has a locally stored password hash. */
export function hasLocalPassword(userId: string): boolean {
  const secrets = readJson<SecretsMap>(SECRETS_KEY, {});
  return Boolean(secrets[userId]);
}

export function listLocalActivity(limit = 500): LocalActivity[] {
  return readJson<LocalActivity[]>(ACTIVITY_KEY, []).slice(0, limit);
}

export function logLocalActivity(input: {
  actorName: string;
  action: string;
  sectionId?: string;
}) {
  const entry: LocalActivity = {
    id: uid(),
    actor_name: input.actorName,
    action: input.action,
    section_id: input.sectionId ?? "portal",
    occurred_at: new Date().toISOString(),
  };
  const next = [entry, ...listLocalActivity(500)].slice(0, 500);
  writeJson(ACTIVITY_KEY, next);
  return entry;
}

export function createLocalAccount(input: {
  email: string;
  displayName: string;
  password: string;
  role?: PortalRole;
}): Promise<PortalAccount> {
  const email = input.email.trim().toLowerCase();
  const list = listLocalAccounts();
  if (list.some((a) => a.email.toLowerCase() === email)) {
    return Promise.reject(new Error("An account with that email already exists."));
  }
  const account: PortalAccount = {
    user_id: uid(),
    email,
    display_name: input.displayName.trim(),
    role: input.role ?? "standard",
    active: true,
  };
  return setLocalPassword(account.user_id, input.password).then(() => {
    saveLocalAccounts([...list, account]);
    return account;
  });
}

export function findLocalAccountByEmail(email: string): PortalAccount | null {
  const normalized = email.trim().toLowerCase();
  return listLocalAccounts().find((a) => a.email.toLowerCase() === normalized) ?? null;
}

/** Persist a local-only portal session (used when cloud auth is unavailable). */
export function writeLocalSession(account: PortalAccount) {
  writeJson(SESSION_KEY, { user_id: account.user_id, email: account.email });
}

export function clearLocalSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function readLocalSessionAccount(): PortalAccount | null {
  const session = readJson<{ user_id?: string; email?: string } | null>(SESSION_KEY, null);
  if (!session?.user_id) return null;
  const list = listLocalAccounts();
  const match = list.find((a) => a.user_id === session.user_id) ?? (session.email ? findLocalAccountByEmail(session.email) : null);
  if (!match || !match.active) {
    clearLocalSession();
    return null;
  }
  return match;
}

/** Sign in against locally stored accounts/passwords when Supabase auth is unavailable. */
export async function signInLocalAccount(email: string, password: string): Promise<PortalAccount> {
  const account = findLocalAccountByEmail(email);
  if (!account) throw new Error("Email or password is incorrect.");
  if (!account.active) throw new Error("This account is not active in Driver Compliance.");
  if (!hasLocalPassword(account.user_id)) throw new Error("Email or password is incorrect.");
  const ok = await verifyLocalPassword(account.user_id, password);
  if (!ok) throw new Error("Email or password is incorrect.");
  writeLocalSession(account);
  return account;
}

/**
 * Dispatch-only Supabase client.
 * Reuses company Driver project URL/key by default with a dedicated auth storage key
 * so Dispatch sessions never share Driver LockGate state.
 * Never imports Admin or Personal clients.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DISPATCH_AUTH_STORAGE_KEY = "shaheen-dispatch-auth-v1";

function readEnv(name: string): string | undefined {
  const vite = (import.meta.env as Record<string, string | undefined>)[name];
  if (vite) return vite;
  if (typeof process !== "undefined") return process.env[name];
  return undefined;
}

export function readDispatchSupabaseEnv(): { url: string; key: string } | null {
  const url =
    readEnv("VITE_DISPATCH_SUPABASE_URL") ||
    readEnv("VITE_SUPABASE_URL") ||
    readEnv("SUPABASE_URL");
  const key =
    readEnv("VITE_DISPATCH_SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) return null;
  return { url, key };
}

export function isDispatchSupabaseConfigured(): boolean {
  return readDispatchSupabaseEnv() !== null;
}

function createDispatchClient(): SupabaseClient {
  const env = readDispatchSupabaseEnv();
  if (!env) {
    throw new Error(
      "Dispatch cloud is not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_DISPATCH_SUPABASE_*).",
    );
  }
  return createClient(env.url, env.key, {
    auth: {
      storageKey: DISPATCH_AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

let _client: SupabaseClient | undefined;

export const dispatchSupabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    if (!_client) _client = createDispatchClient();
    return Reflect.get(_client, prop, receiver);
  },
});

export function dispatchAuthStorageKey(): string {
  return DISPATCH_AUTH_STORAGE_KEY;
}

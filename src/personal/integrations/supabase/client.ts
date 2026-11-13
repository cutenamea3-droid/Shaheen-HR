/**
 * HR Personal Supabase client — isolated from Driver and Admin backends.
 * Uses only VITE_PERSONAL_* env. Never import company clients here.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/** Dedicated auth storage namespace — never company Admin/Driver keys. */
export const PERSONAL_SB_AUTH_STORAGE_KEY = "hr-personal-sb-auth-v1";

function personalEnv(): { url: string; key: string } | null {
  const url =
    (import.meta.env["VITE_PERSONAL_SUPABASE_URL"] as string | undefined)?.replace(/\/+$/, "") ||
    (typeof process !== "undefined" ? process.env["VITE_PERSONAL_SUPABASE_URL"]?.replace(/\/+$/, "") : undefined);
  const key =
    (import.meta.env["VITE_PERSONAL_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
    (typeof process !== "undefined" ? process.env["VITE_PERSONAL_SUPABASE_PUBLISHABLE_KEY"] : undefined);
  if (!url || !key) return null;
  // Hard refuse if someone accidentally pointed Personal at known company placeholders.
  if (url.includes("okzcwctsgurumnnzuxgg") || url.includes("lovable.cloud")) {
    console.error("[HR Personal] Refusing company Supabase URL for Personal client.");
    return null;
  }
  return { url, key };
}

function personalStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  const prefix = PERSONAL_SB_AUTH_STORAGE_KEY;
  return {
    getItem: (key) => window.localStorage.getItem(`${prefix}:${key}`),
    setItem: (key, value) => window.localStorage.setItem(`${prefix}:${key}`, value),
    removeItem: (key) => window.localStorage.removeItem(`${prefix}:${key}`),
    clear: () => {
      const kill: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(`${prefix}:`)) kill.push(k);
      }
      kill.forEach((k) => window.localStorage.removeItem(k));
    },
    key: (index) => {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(`${prefix}:`)) keys.push(k);
      }
      return keys[index] ?? null;
    },
    get length() {
      let n = 0;
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(`${prefix}:`)) n++;
      }
      return n;
    },
  };
}

export function isPersonalSupabaseConfigured(): boolean {
  return personalEnv() != null;
}

let _client: SupabaseClient<Database> | null | undefined;

/** Returns null when Personal env is unset (safe mock mode). */
export function getPersonalSupabase(): SupabaseClient<Database> | null {
  if (_client !== undefined) return _client;
  const env = personalEnv();
  if (!env) {
    _client = null;
    return null;
  }
  _client = createClient<Database>(env.url, env.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: personalStorage(),
      storageKey: PERSONAL_SB_AUTH_STORAGE_KEY,
    },
  });
  return _client;
}

/** Test helper — reset lazy client. */
export function __resetPersonalSupabaseForTests() {
  _client = undefined;
}

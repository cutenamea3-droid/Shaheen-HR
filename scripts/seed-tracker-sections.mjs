#!/usr/bin/env bun
/**
 * One-shot seed of public.tracker_sections from src/data/seed.json (+ record shells).
 *
 * Requires an Auth user that already has (or can get) a driver_portal_accounts row.
 *
 *   SEED_EMAIL=hr.compliance@gmail.com SEED_PASSWORD='…' bun scripts/seed-tracker-sections.mjs
 *
 * Uses VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env.
 * Does not invent passwords — you must pass SEED_PASSWORD.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
function loadEnv() {
  const p = resolve(root, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const email = (process.env.SEED_EMAIL || "hr.compliance@gmail.com").trim().toLowerCase();
const password = process.env.SEED_PASSWORD || "";

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
if (!password) {
  console.error("Set SEED_PASSWORD (and optional SEED_EMAIL) to run an authenticated seed.");
  console.error("Anon upsert is blocked by RLS. Or sign in once in the app — empty remote auto-uploads seed.");
  process.exit(2);
}

const { buildSeed } = await import("../src/lib/sections.ts");
const { RECORD_HEADERS, RECORD_SECTION_IDS } = await import("../src/lib/store.ts");

const data = buildSeed();
for (const id of RECORD_SECTION_IDS) {
  if (!data.sections[id]) {
    data.sections[id] = {
      headers: [...RECORD_HEADERS],
      widths: RECORD_HEADERS.map(() => 200),
      hidden: RECORD_HEADERS.map(() => false),
      rows: [],
    };
  }
}
const now = new Date().toISOString();
const rows = Object.entries(data.sections).map(([id, sec]) => ({ id, data: sec, updated_at: now }));

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const authPassword = email === "hr.compliance@gmail.com" ? `Shaheen-Driver-Portal::${password}` : password;

const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password: authPassword });
if (authErr) {
  // retry raw password for non-legacy accounts
  const retry = await sb.auth.signInWithPassword({ email, password });
  if (retry.error) {
    console.error("Sign-in failed:", authErr.message, "/", retry.error.message);
    process.exit(3);
  }
} else if (!auth.session) {
  console.error("Sign-in returned no session");
  process.exit(3);
}

// Best-effort bootstrap if RPC exists
await sb.rpc("driver_portal_ensure_self", { p_display_name: "HR owner" });

const { data: out, error } = await sb.from("tracker_sections").upsert(rows).select("id");
if (error) {
  console.error("Upsert failed:", error.message);
  console.error("If RLS blocked: ensure your user has an active row in driver_portal_accounts.");
  process.exit(4);
}
console.log("Seeded", out?.length ?? rows.length, "tracker_sections rows:");
console.log((out ?? rows).map((r) => r.id).join(", "));
await sb.auth.signOut();

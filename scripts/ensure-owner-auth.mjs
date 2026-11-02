#!/usr/bin/env bun
/**
 * Ensure the Driver Compliance owner exists in Supabase Auth (signUp), then
 * bootstrap ACL via driver_portal_ensure_self when possible.
 *
 * Does NOT invent a password — you must pass SEED_PASSWORD (typed/known by you).
 *
 *   SEED_EMAIL=hr.compliance@gmail.com SEED_PASSWORD='your-password' \
 *     bun scripts/ensure-owner-auth.mjs
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env.
 * For the default owner email, Auth stores the legacy password prefix
 * (`Shaheen-Driver-Portal::` + typed password) to match the portal client.
 *
 * After this succeeds, either:
 *   - open the Driver portal and sign in (empty cloud auto-seeds tracker_sections), or
 *   - run: SEED_PASSWORD='…' bun scripts/seed-tracker-sections.mjs
 *
 * If signUp returns “confirm your email”, disable Confirm email in:
 *   Supabase → Authentication → Providers → Email
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const PORTAL_EMAIL = "hr.compliance@gmail.com";
const LEGACY_PASSWORD_PREFIX = "Shaheen-Driver-Portal::";

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
const email = (process.env.SEED_EMAIL || PORTAL_EMAIL).trim().toLowerCase();
const typedPassword = process.env.SEED_PASSWORD || "";

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}
if (!typedPassword) {
  console.error("Set SEED_PASSWORD to the password YOU choose (not invented by the agent).");
  process.exit(2);
}

const authPassword = email === PORTAL_EMAIL ? LEGACY_PASSWORD_PREFIX + typedPassword : typedPassword;
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function trySignIn(password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error };
}

// 1) Already exists?
for (const password of email === PORTAL_EMAIL ? [authPassword, typedPassword] : [typedPassword]) {
  const { data, error } = await trySignIn(password);
  if (!error && data.user) {
    console.log("Owner Auth user already exists — signed in:", data.user.id);
    const { data: ensured, error: ensureErr } = await sb.rpc("driver_portal_ensure_self", {
      p_display_name: "HR owner",
    });
    if (ensureErr) {
      console.warn("ACL bootstrap RPC missing or failed:", ensureErr.message);
      console.warn("Paste supabase/migrations/20261102093000_driver_portal_ensure_self.sql in SQL Editor.");
    } else {
      console.log("ACL row OK:", ensured?.email ?? ensured?.user_id ?? "ensured");
    }
    await sb.auth.signOut();
    process.exit(0);
  }
}

// 2) Create
const { data: signedUp, error: signUpError } = await sb.auth.signUp({
  email,
  password: authPassword,
  options: { data: { display_name: "HR owner" } },
});

if (signUpError) {
  console.error("signUp failed:", signUpError.message);
  process.exit(3);
}

if (signedUp.session?.user) {
  console.log("Owner Auth user created + session:", signedUp.session.user.id);
} else if (signedUp.user) {
  console.log("Owner Auth user created:", signedUp.user.id);
  console.warn("No session returned — email confirmation may be enabled.");
  console.warn("Disable Confirm email under Authentication → Providers → Email, then re-run or sign in on the portal.");
} else {
  console.error("signUp returned neither user nor session");
  process.exit(4);
}

const { data: after, error: afterErr } = await trySignIn(authPassword);
if (afterErr || !after.user) {
  console.error("Could not sign in after signUp:", afterErr?.message ?? "no user");
  process.exit(5);
}

const { data: ensured, error: ensureErr } = await sb.rpc("driver_portal_ensure_self", {
  p_display_name: "HR owner",
});
if (ensureErr) {
  console.warn("ACL bootstrap RPC missing or failed:", ensureErr.message);
  console.warn("Paste supabase/migrations/20261102093000_driver_portal_ensure_self.sql in SQL Editor.");
} else {
  console.log("ACL row OK:", ensured?.email ?? ensured?.user_id ?? "ensured");
}

console.log("Done. Sign in on the Driver portal with the same typed password to seed tracker_sections (empty remote auto-upload).");
await sb.auth.signOut();

/**
 * PGlite policy tests for Batch 2 Dispatch ACL isolation.
 * No production Supabase writes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const root = resolve(import.meta.dirname, "../..");

function migrationSql(name: string): string {
  return readFileSync(resolve(root, "supabase/migrations", name), "utf8");
}

function stripAuthUserFks(sql: string): string {
  return sql
    .replace(/\s+REFERENCES auth\.users\(id\) ON DELETE SET NULL/gi, "")
    .replace(/\s+REFERENCES auth\.users\(id\) ON DELETE CASCADE/gi, "");
}

async function asUser(db: PGlite, userId: string | null, email: string, fn: () => Promise<void>) {
  if (userId) {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', false)`);
    await db.exec(
      `SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, email }).replace(/'/g, "''")}', false)`,
    );
  } else {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`SELECT set_config('request.jwt.claims', '', false)`);
  }
  // Match PostgREST: evaluate policies as `authenticated` (table owner would bypass otherwise).
  await db.exec(`SET ROLE authenticated`);
  try {
    await fn();
  } finally {
    await db.exec(`RESET ROLE`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`SELECT set_config('request.jwt.claims', '', false)`);
  }
}

describe("Batch 2 PGlite module isolation", () => {
  let db: PGlite;
  const ownerId = "11111111-1111-1111-1111-111111111111";
  const dispatcherId = "33333333-3333-3333-3333-333333333333";
  const driverStdId = "22222222-2222-2222-2222-222222222222";
  const anonEmail = "nobody@example.com";

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
      CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
      GRANT SELECT ON auth.users TO authenticated;
      INSERT INTO auth.users (id, email) VALUES
        ('${ownerId}', 'hr.compliance@gmail.com'),
        ('${dispatcherId}', 'desk.dispatcher@example.com'),
        ('${driverStdId}', 'driver.user@example.com')
      ON CONFLICT DO NOTHING;

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;

      CREATE TABLE IF NOT EXISTS public.driver_portal_accounts (
        user_id uuid PRIMARY KEY,
        email text NOT NULL UNIQUE,
        display_name text NOT NULL,
        role text NOT NULL DEFAULT 'standard' CHECK (role IN ('admin', 'standard')),
        active boolean NOT NULL DEFAULT true
      );
      INSERT INTO public.driver_portal_accounts (user_id, email, display_name, role, active) VALUES
        ('${ownerId}', 'hr.compliance@gmail.com', 'HR owner', 'admin', true),
        ('${driverStdId}', 'driver.user@example.com', 'Standard', 'standard', true);

      CREATE TABLE IF NOT EXISTS public.tracker_sections (
        id text PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      INSERT INTO public.tracker_sections (id, data) VALUES ('dmv', '{"ok":true}');

      CREATE OR REPLACE FUNCTION public.driver_portal_can_access()
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = public, pg_temp SET row_security = off AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.driver_portal_accounts
          WHERE user_id = auth.uid() AND active
        )
      $$;
      GRANT EXECUTE ON FUNCTION public.driver_portal_can_access() TO authenticated;

      ALTER TABLE public.tracker_sections ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.tracker_sections FORCE ROW LEVEL SECURITY;
      CREATE POLICY tracker_sections_portal ON public.tracker_sections
        FOR SELECT TO authenticated
        USING (public.driver_portal_can_access());
      GRANT SELECT ON public.tracker_sections TO authenticated;
    `);

    await db.exec(stripAuthUserFks(migrationSql("20261113180000_batch2_module_isolation.sql")));

    // Seed dispatcher seat (simulates invite edge function).
    await db.exec(`
      INSERT INTO public.dispatch_portal_accounts (user_id, email, display_name, role, active)
      VALUES ('${dispatcherId}', 'desk.dispatcher@example.com', 'Desk', 'dispatcher', true);
    `);
  });

  it("dispatcher can read dispatch ACL self row", async () => {
    await asUser(db, dispatcherId, "desk.dispatcher@example.com", async () => {
      const res = await db.query<{ email: string }>(
        `SELECT email FROM public.dispatch_portal_accounts WHERE user_id = auth.uid()`,
      );
      expect(res.rows[0]?.email).toBe("desk.dispatcher@example.com");
    });
  });

  it("dispatcher is denied Compliance tracker_sections (URL/API denial)", async () => {
    await asUser(db, dispatcherId, "desk.dispatcher@example.com", async () => {
      const res = await db.query(`SELECT id FROM public.tracker_sections`);
      expect(res.rows.length).toBe(0);
    });
  });

  it("Driver standard user cannot auto-join Dispatch via ensure_self", async () => {
    await asUser(db, driverStdId, "driver.user@example.com", async () => {
      let failed = false;
      try {
        await db.exec(`SELECT public.dispatch_ensure_self('Nope')`);
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
    });
  });

  it("non-admin dispatcher cannot set_access", async () => {
    await asUser(db, dispatcherId, "desk.dispatcher@example.com", async () => {
      let failed = false;
      try {
        await db.exec(
          `SELECT public.dispatch_set_access('${dispatcherId}'::uuid, 'admin', true)`,
        );
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
    });
  });

  it("anonymous has no dispatch or compliance rows", async () => {
    await asUser(db, null, anonEmail, async () => {
      const d = await db.query(`SELECT email FROM public.dispatch_portal_accounts`);
      const t = await db.query(`SELECT id FROM public.tracker_sections`);
      expect(d.rows.length).toBe(0);
      expect(t.rows.length).toBe(0);
    });
  });

  it("owner can ensure_self as Dispatch admin", async () => {
    await asUser(db, ownerId, "hr.compliance@gmail.com", async () => {
      const res = await db.query<{ role: string }>(
        `SELECT role FROM public.dispatch_ensure_self('Owner')`,
      );
      expect(res.rows[0]?.role).toBe("admin");
    });
  });
});

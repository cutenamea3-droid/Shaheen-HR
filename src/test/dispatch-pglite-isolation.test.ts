/**
 * Isolated Postgres (PGlite) deny tests for Dispatch Operations.
 * NO production Supabase writes. Proves dispatcher role cannot read Compliance tables,
 * and Driver-only users cannot read dispatch_* tables.
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
    .replace(/\s+REFERENCES auth\.users\(id\) ON DELETE CASCADE/gi, "")
    .replace(/\s+REFERENCES public\.dispatch_roster_drivers\(id\) ON DELETE SET NULL/gi, "");
}

async function exec(db: PGlite, sql: string) {
  await db.exec(sql);
}

async function asUser(db: PGlite, userId: string | null, email: string, fn: () => Promise<void>) {
  if (userId) {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', false)`);
    await db.exec(
      `SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, email }).replace(/'/g, "''")}', false)`,
    );
    await db.exec(`SET ROLE authenticated`);
  } else {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`SELECT set_config('request.jwt.claims', '', false)`);
    await db.exec(`RESET ROLE`);
  }
  try {
    await fn();
  } finally {
    await db.exec(`RESET ROLE`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`SELECT set_config('request.jwt.claims', '', false)`);
  }
}

describe("Dispatch PGlite isolation (auth + RLS)", () => {
  let db: PGlite;
  const ownerId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const dispatcherId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const driverUserId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  beforeAll(async () => {
    db = new PGlite();
    await exec(
      db,
      `
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
      INSERT INTO auth.users (id, email) VALUES
        ('${ownerId}', 'hr.compliance@gmail.com'),
        ('${dispatcherId}', 'desk.dispatcher@example.com'),
        ('${driverUserId}', 'driver.user@example.com')
      ON CONFLICT DO NOTHING;

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS jsonb LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
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
        ('${driverUserId}', 'driver.user@example.com', 'Standard', 'standard', true);

      CREATE OR REPLACE FUNCTION public.driver_portal_is_admin()
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = public, pg_temp SET row_security = off AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.driver_portal_accounts
          WHERE user_id = auth.uid() AND role = 'admin' AND active
        )
      $$;

      CREATE OR REPLACE FUNCTION public.driver_portal_can_access()
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = public, pg_temp SET row_security = off AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.driver_portal_accounts
          WHERE user_id = auth.uid() AND active
        )
      $$;
      GRANT EXECUTE ON FUNCTION public.driver_portal_can_access() TO authenticated;
      GRANT EXECUTE ON FUNCTION public.driver_portal_is_admin() TO authenticated;

      CREATE TABLE IF NOT EXISTS public.tracker_sections (
        id text PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        version integer NOT NULL DEFAULT 1
      );
      ALTER TABLE public.tracker_sections ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.tracker_sections TO authenticated;
      CREATE POLICY driver_portal_sections_select ON public.tracker_sections
        FOR SELECT TO authenticated USING (public.driver_portal_can_access());
      INSERT INTO public.tracker_sections (id, data) VALUES ('secret-compliance', '{"ssn":"nope"}');

      CREATE TABLE IF NOT EXISTS public.driver_rate_cards (
        driver_id text PRIMARY KEY,
        rates jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      ALTER TABLE public.driver_rate_cards ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.driver_rate_cards FORCE ROW LEVEL SECURITY;
      REVOKE ALL ON public.driver_rate_cards FROM PUBLIC;
      REVOKE ALL ON public.driver_rate_cards FROM anon, authenticated;
      GRANT ALL ON public.driver_rate_cards TO service_role;
      CREATE POLICY driver_rate_cards_deny_all ON public.driver_rate_cards
        FOR ALL TO authenticated USING (false) WITH CHECK (false);
      INSERT INTO public.driver_rate_cards (driver_id, rates) VALUES ('d1', '{"cpm":2}');

      CREATE TABLE IF NOT EXISTS public.driver_drug_tests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id text NOT NULL,
        result text
      );
      ALTER TABLE public.driver_drug_tests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.driver_drug_tests FORCE ROW LEVEL SECURITY;
      REVOKE ALL ON public.driver_drug_tests FROM PUBLIC;
      REVOKE ALL ON public.driver_drug_tests FROM anon, authenticated;
      GRANT ALL ON public.driver_drug_tests TO service_role;
      CREATE POLICY driver_drug_tests_deny_all ON public.driver_drug_tests
        FOR ALL TO authenticated USING (false) WITH CHECK (false);
      `,
    );

    // gen_random_uuid may need pgcrypto; provide a fallback.
    await exec(
      db,
      `
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      `,
    ).catch(async () => {
      await exec(
        db,
        `
        CREATE OR REPLACE FUNCTION gen_random_uuid()
        RETURNS uuid LANGUAGE sql AS $$
          SELECT (
            lpad(to_hex((random()*4294967295)::bigint),8,'0') || '-' ||
            lpad(to_hex((random()*65535)::bigint),4,'0') || '-4' ||
            lpad(to_hex((random()*4095)::bigint),3,'0') || '-' ||
            lpad(to_hex((random()*16383+32768)::bigint),4,'0') || '-' ||
            lpad(to_hex((random()*281474976710655)::bigint),12,'0')
          )::uuid
        $$;
        `,
      );
    });

    await exec(db, stripAuthUserFks(migrationSql("20261113170000_dispatch_operations.sql")));
    await exec(db, stripAuthUserFks(migrationSql("20261113190000_dispatch_ops_controls.sql")));

    await exec(
      db,
      `
      INSERT INTO public.dispatch_portal_accounts (user_id, email, display_name, role, active)
      VALUES ('${dispatcherId}', 'desk.dispatcher@example.com', 'Desk Dispatcher', 'dispatcher', true)
      ON CONFLICT (user_id) DO NOTHING;

      INSERT INTO public.dispatch_loads (id, load_number, status, customer_name)
      VALUES ('11111111-1111-1111-1111-111111111111', 'SH-DENY-1', 'planned', 'Acme')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.dispatch_follow_ups (id, title, due_at, status)
      VALUES ('22222222-2222-2222-2222-222222222222', 'B8 follow-up', now(), 'open')
      ON CONFLICT DO NOTHING;
      `,
    );
  }, 120_000);

  it("dispatcher can read dispatch loads but not compliance sections", async () => {
    await asUser(db, dispatcherId, "desk.dispatcher@example.com", async () => {
      const loads = await db.query(`SELECT load_number FROM public.dispatch_loads`);
      expect(loads.rows.length).toBeGreaterThan(0);

      const followUps = await db.query(`SELECT title FROM public.dispatch_follow_ups`);
      expect(followUps.rows.length).toBeGreaterThan(0);

      const sections = await db.query(`SELECT id FROM public.tracker_sections`);
      expect(sections.rows.length).toBe(0);

      let rateDenied = false;
      try {
        await db.query(`SELECT * FROM public.driver_rate_cards`);
      } catch {
        rateDenied = true;
      }
      expect(rateDenied).toBe(true);

      let drugDenied = false;
      try {
        await db.query(`SELECT * FROM public.driver_drug_tests`);
      } catch {
        drugDenied = true;
      }
      expect(drugDenied).toBe(true);

      const canDispatch = await db.query<{ ok: boolean }>(`SELECT public.dispatch_can_access() AS ok`);
      expect(canDispatch.rows[0]?.ok).toBe(true);
      const canDriver = await db.query<{ ok: boolean }>(`SELECT public.driver_portal_can_access() AS ok`);
      expect(canDriver.rows[0]?.ok).toBe(false);
    });
  });

  it("driver compliance user cannot read dispatch tables", async () => {
    await asUser(db, driverUserId, "driver.user@example.com", async () => {
      const sections = await db.query(`SELECT id FROM public.tracker_sections`);
      expect(sections.rows.length).toBe(1);

      const loads = await db.query(`SELECT load_number FROM public.dispatch_loads`);
      expect(loads.rows.length).toBe(0);

      const canDispatch = await db.query<{ ok: boolean }>(`SELECT public.dispatch_can_access() AS ok`);
      expect(canDispatch.rows[0]?.ok).toBe(false);
    });
  });

  it("dispatcher cannot revoke last admin via set_access abuse from non-admin", async () => {
    await asUser(db, dispatcherId, "desk.dispatcher@example.com", async () => {
      let denied = false;
      try {
        await db.query(
          `SELECT public.dispatch_set_access('${ownerId}'::uuid, 'dispatcher', false)`,
        );
      } catch {
        denied = true;
      }
      expect(denied).toBe(true);
    });
  });

  it("driver user cannot auto-join dispatch via ensure_self", async () => {
    await asUser(db, driverUserId, "driver.user@example.com", async () => {
      let denied = false;
      try {
        await db.query(`SELECT public.dispatch_ensure_self('Nope')`);
      } catch {
        denied = true;
      }
      expect(denied).toBe(true);
    });
  });
});

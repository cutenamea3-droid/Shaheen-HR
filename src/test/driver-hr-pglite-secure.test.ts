/**
 * Isolated Postgres (PGlite) tests for Driver Rate/Drug secure SQL.
 * NO production Supabase writes. Admin vs ordinary user, audit, soft-delete, pairing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const root = resolve(import.meta.dirname, "../..");

function migrationSql(name: string): string {
  return readFileSync(resolve(root, "supabase/migrations", name), "utf8");
}

/** Strip FK to auth.users so PGlite can run without a full Auth schema. */
function stripAuthUserFks(sql: string): string {
  return sql
    .replace(/\s+REFERENCES auth\.users\(id\) ON DELETE SET NULL/gi, "")
    .replace(/\s+REFERENCES auth\.users\(id\) ON DELETE CASCADE/gi, "");
}

async function exec(db: PGlite, sql: string) {
  await db.exec(sql);
}

async function asUser(db: PGlite, userId: string | null, email: string, fn: () => Promise<void>) {
  // Session-level (is_local=false): PGlite auto-commits each statement.
  if (userId) {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', false)`);
    await db.exec(
      `SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, email }).replace(/'/g, "''")}', false)`,
    );
  } else {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`SELECT set_config('request.jwt.claims', '', false)`);
  }
  try {
    await fn();
  } finally {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`SELECT set_config('request.jwt.claims', '', false)`);
  }
}

describe("Isolated PGlite Driver Rate/Drug SQL (admin + ordinary)", () => {
  let db: PGlite;
  const adminId = "11111111-1111-1111-1111-111111111111";
  const ordinaryId = "22222222-2222-2222-2222-222222222222";

  beforeAll(async () => {
    db = new PGlite();
    await exec(
      db,
      `
      DO $$ BEGIN
        CREATE ROLE authenticated;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      DO $$ BEGIN
        CREATE ROLE anon;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      DO $$ BEGIN
        CREATE ROLE service_role;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
      INSERT INTO auth.users (id, email) VALUES
        ('${adminId}', 'hr.compliance@gmail.com'),
        ('${ordinaryId}', 'driver.user@example.com')
      ON CONFLICT DO NOTHING;

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS jsonb
      LANGUAGE sql
      STABLE
      AS $$
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
        ('${adminId}', 'hr.compliance@gmail.com', 'HR owner', 'admin', true),
        ('${ordinaryId}', 'driver.user@example.com', 'Standard', 'standard', true);

      CREATE OR REPLACE FUNCTION public.driver_portal_is_admin()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.driver_portal_accounts
          WHERE user_id = auth.uid() AND role = 'admin' AND active
        )
      $$;
      GRANT EXECUTE ON FUNCTION public.driver_portal_is_admin() TO authenticated;
      `,
    );

    await exec(db, stripAuthUserFks(migrationSql("20261106140000_driver_rate_cards_secure.sql")));
    await exec(db, stripAuthUserFks(migrationSql("20261106140100_driver_drug_tests_secure.sql")));
  }, 60_000);

  it("get/list are VOLATILE (not STABLE) because they write audit", async () => {
    const { rows } = await db.query<{ proname: string; provolatile: string }>(
      `
      SELECT p.proname, p.provolatile
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('driver_rate_card_get', 'driver_drug_test_list')
      ORDER BY 1
      `,
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      // v = volatile, s = stable, i = immutable
      expect(r.provolatile, r.proname).toBe("v");
    }
  });

  it("admin can save/reload rate + drug; audit records authorized reads; soft-delete recoverable", async () => {
    let rateRows: { rates: Record<string, string> }[] = [];
    let drugRows: { id: string; testing_event_id: string; specimen_id: string; deleted_at: string | null }[] = [];
    let auditCountBefore = 0;

    await asUser(db, adminId, "hr.compliance@gmail.com", async () => {
      const before = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM driver_sensitive_audit_log`);
      auditCountBefore = before.rows[0]!.c;

      await db.query(
        `SELECT * FROM driver_rate_card_upsert($1, $2::jsonb, $3, $4)`,
        ["drv-a", JSON.stringify({ percentage: "0.550", loadedCpm: "" }), "percentage", ""],
      );
      const got = await db.query<{ rates: Record<string, string> }>(
        `SELECT * FROM driver_rate_card_get($1)`,
        ["drv-a"],
      );
      rateRows = got.rows;

      const te = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      await db.query(
        `SELECT * FROM driver_drug_test_add($1,$2,$3,$4,$5,$6,$7,$8::uuid)`,
        ["drv-a", "federal_drug", "01234", "Random", "Site A", "2024-01-10", "", te],
      );
      await db.query(
        `SELECT * FROM driver_drug_test_add($1,$2,$3,$4,$5,$6,$7,$8::uuid)`,
        ["drv-a", "medical_review", "01234", "Random", "Site A", "2024-01-10", "", te],
      );
      // Second independent Random (same specimen text) — distinct testing event
      const te2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
      await db.query(
        `SELECT * FROM driver_drug_test_add($1,$2,$3,$4,$5,$6,$7,$8::uuid)`,
        ["drv-a", "federal_drug", "01234", "Random", "Site A", "2024-02-01", "", te2],
      );

      const listed = await db.query<{
        id: string;
        testing_event_id: string;
        specimen_id: string;
        deleted_at: string | null;
      }>(`SELECT * FROM driver_drug_test_list($1)`, ["drv-a"]);
      drugRows = listed.rows;

      const fd = listed.rows.find((r) => r.testing_event_id === te2)!;
      await db.query(`SELECT driver_drug_test_delete($1::uuid)`, [fd.id]);
      const afterDel = await db.query<{ id: string }>(`SELECT * FROM driver_drug_test_list($1)`, ["drv-a"]);
      expect(afterDel.rows).toHaveLength(2);
      await db.query(`SELECT * FROM driver_drug_test_restore($1::uuid)`, [fd.id]);
      const afterRest = await db.query<{ id: string }>(`SELECT * FROM driver_drug_test_list($1)`, ["drv-a"]);
      expect(afterRest.rows).toHaveLength(3);

      // Incomplete row editable + correction audited
      const inc = await db.query<{ id: string }>(
        `SELECT * FROM driver_drug_test_add($1,$2,$3,$4,$5,$6,$7,NULL)`,
        ["drv-a", null, null, null, null, null, "draft"],
      );
      await db.query(
        `SELECT * FROM driver_drug_test_update($1::uuid,$2,$3,$4,$5,$6,$7,NULL)`,
        [inc.rows[0]!.id, "federal_drug", "99", "Follow-up", "Site B", null, "fixed"],
      );
    });

    expect(rateRows[0]!.rates.percentage).toBe("0.550");
    expect(rateRows[0]!.rates.loadedCpm).toBeUndefined();

    expect(drugRows).toHaveLength(3);
    expect(drugRows.every((r) => r.specimen_id === "01234")).toBe(true);
    const byTe = new Map(drugRows.map((r) => [r.testing_event_id, r]));
    expect(byTe.size).toBe(2); // te + te2 (FD+MR share te → one key still, wait)
    // FD+MR share te → Map size: te, te2 = 2 unique testing events among 3 rows
    expect(new Set(drugRows.map((r) => r.testing_event_id)).size).toBe(2);

    const audit = await db.query<{ action: string }>(
      `SELECT action FROM driver_sensitive_audit_log ORDER BY id`,
    );
    expect(audit.rows.length).toBeGreaterThan(auditCountBefore);
    expect(audit.rows.some((a) => a.action === "rate_card_view")).toBe(true);
    expect(audit.rows.some((a) => a.action === "drug_test_list")).toBe(true);
    expect(audit.rows.some((a) => a.action === "drug_test_soft_delete")).toBe(true);
    expect(audit.rows.some((a) => a.action === "drug_test_restore")).toBe(true);
    expect(audit.rows.some((a) => a.action === "drug_test_update")).toBe(true);

    // Pairing check in-app style using SQL-fetched active rows
    const active = await db.query<{
      id: string;
      testing_event_id: string;
      kind: string;
      specimen_id: string;
      reason: string;
      collection_context: string;
    }>(
      `SELECT id, testing_event_id, kind, specimen_id, reason, collection_context
       FROM driver_drug_test_events
       WHERE driver_id = 'drv-a' AND deleted_at IS NULL AND kind IS NOT NULL`,
    );
    const { pairDrugTestEvents } = await import("@/lib/driver-hr/drug-tests");
    const pairs = pairDrugTestEvents(
      active.rows.map((r) => ({
        id: r.id,
        driverId: "drv-a",
        testingEventId: r.testing_event_id,
        kind: r.kind as "federal_drug" | "medical_review",
        specimenId: r.specimen_id ?? "",
        reason: r.reason ?? "",
        collectionContext: r.collection_context ?? "",
        eventDate: "",
        notes: "",
        createdAt: 1,
      })),
    );
    expect(pairs.filter((p) => p.status === "matched")).toHaveLength(1);
    expect(pairs.filter((p) => p.status === "missing_mr")).toHaveLength(2); // te2 FD + Follow-up FD
  });

  it("ordinary user is denied rate/drug RPCs; table SELECT blocked by RLS", async () => {
    await asUser(db, ordinaryId, "driver.user@example.com", async () => {
      await expect(
        db.query(`SELECT * FROM driver_rate_card_get($1)`, ["drv-a"]),
      ).rejects.toThrow(/Admin Driver Compliance/);
      await expect(
        db.query(`SELECT * FROM driver_drug_test_list($1)`, ["drv-a"]),
      ).rejects.toThrow(/Admin Driver Compliance/);
      // No table GRANT to authenticated (+ FORCE RLS deny-all) → permission denied / empty.
      await db.exec(`SET ROLE authenticated`);
      try {
        await expect(db.query(`SELECT * FROM driver_rate_cards`)).rejects.toThrow(/permission denied/);
        await expect(db.query(`SELECT * FROM driver_drug_test_events`)).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec(`RESET ROLE`);
      }
    });
  });

  it("preserves Hire/docs: no tracker_sections mutation from these RPCs", async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS public.tracker_sections (
        id text PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      INSERT INTO public.tracker_sections (id, data)
      VALUES ('dmv', '{"rows":[{"driverId":"drv-a","dateOfHire":"2023-06-01"}]}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `);
    const before = await db.query<{ data: unknown }>(`SELECT data FROM tracker_sections WHERE id='dmv'`);
    await asUser(db, adminId, "hr.compliance@gmail.com", async () => {
      await db.query(`SELECT * FROM driver_rate_card_get($1)`, ["drv-a"]);
      await db.query(`SELECT * FROM driver_drug_test_list($1)`, ["drv-a"]);
    });
    const after = await db.query<{ data: unknown }>(`SELECT data FROM tracker_sections WHERE id='dmv'`);
    expect(after.rows[0]!.data).toEqual(before.rows[0]!.data);
  });
});

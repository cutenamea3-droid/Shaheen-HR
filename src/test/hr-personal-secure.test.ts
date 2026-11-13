/**
 * HR Personal secure track — isolation, gate, backup, cross-browser sync decisions,
 * and Personal-only SQL dry-run on PGlite. NO production writes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  applyPersonalBackup,
  buildPersonalBackup,
  parsePersonalBackup,
  PERSONAL_BACKUP_APP,
  PERSONAL_LOCAL_STORAGE_KEYS,
  serializePersonalBackup,
} from "@/personal/lib/backup";
import {
  __simulateCrossBrowserSync,
} from "@/personal/lib/cloud-sync";
import {
  decidePersonalSync,
  isPersonalMeaningful,
  PERSONAL_UNSYNCED_KEY,
  type PersonalSyncBlob,
} from "@/personal/lib/sync-protect";
import { FORBIDDEN_COMPANY_KEYS, PERSONAL_STORAGE_KEY, defaultCourses } from "@/personal/lib/defaults";
import { PERSONAL_AUTH_KEYS, clearPersonalSession, readPersonalSession, writePersonalSession } from "@/personal/lib/auth";
import { shouldShowPersonalSwitcherLink } from "@/personal/lib/access";
import { usePersonal } from "@/personal/lib/store";
import { PERSONAL_SB_AUTH_STORAGE_KEY } from "@/personal/integrations/supabase/client";

const root = resolve(import.meta.dirname, "../..");

function stripAuthUserFks(sql: string): string {
  return sql
    .replace(/\s+references auth\.users\s*\(id\)\s+on delete cascade/gi, "")
    .replace(/create or replace function public\.personal_handle_new_user[\s\S]*?\$\$;/i, "")
    .replace(/drop trigger if exists on_auth_user_created_personal[\s\S]*?;/i, "")
    .replace(/create trigger on_auth_user_created_personal[\s\S]*?;/i, "");
}

function seedBlob(partial: Partial<PersonalSyncBlob> = {}): PersonalSyncBlob {
  return {
    courses: defaultCourses(),
    backlog: [],
    assessments: [],
    notes: [],
    sessions: [],
    dayPlans: {},
    discipline: [],
    settings: usePersonal.getState().settings,
    vaultNotes: "",
    gradeEntries: [],
    courseGrades: [],
    examPrepTasks: [],
    weeklyReviews: {},
    ...partial,
  };
}

describe("HR Personal localStorage audit", () => {
  it("documents every Personal key and never company keys", () => {
    const keys = Object.values(PERSONAL_LOCAL_STORAGE_KEYS);
    expect(keys).toContain(PERSONAL_STORAGE_KEY);
    expect(keys.every((k) => k.startsWith("hr-personal"))).toBe(true);
    expect(PERSONAL_AUTH_KEYS.every((k) => k.startsWith("hr-personal-"))).toBe(true);
    expect(PERSONAL_UNSYNCED_KEY.startsWith("hr-personal-")).toBe(true);
    expect(PERSONAL_SB_AUTH_STORAGE_KEY.startsWith("hr-personal-")).toBe(true);
    for (const k of FORBIDDEN_COMPANY_KEYS) {
      expect(keys).not.toContain(k);
      expect(PERSONAL_AUTH_KEYS as readonly string[]).not.toContain(k);
    }
  });
});

describe("HR Personal link / cross-browser gate", () => {
  beforeEach(() => {
    clearPersonalSession();
    usePersonal.setState({ authed: false });
  });

  it("does not unlock from URL alone (no session → not authed)", () => {
    expect(readPersonalSession()).toBe(false);
    expect(usePersonal.getState().authed).toBe(false);
  });

  it("cleared storage requires credentials again", () => {
    writePersonalSession("owner@example.com");
    expect(readPersonalSession()).toBe(true);
    clearPersonalSession();
    expect(readPersonalSession()).toBe(false);
  });

  it("different browser simulation = empty storage = locked", () => {
    // Fresh storage namespace: no session key present
    expect(localStorage.getItem("hr-personal-auth-session-v1")).toBeNull();
    expect(readPersonalSession()).toBe(false);
  });

  it("company switcher still hides Personal off-route", () => {
    expect(shouldShowPersonalSwitcherLink(false)).toBe(false);
  });
});

describe("HR Personal backup export/restore", () => {
  it("round-trips study data and refuses company envelopes", () => {
    usePersonal.setState({
      vaultNotes: "semester goal",
      notes: [
        {
          id: "n1",
          courseId: "cs101",
          title: "Arrays",
          body: "O(1) index",
          updatedAt: 1,
          tags: [],
        },
      ],
    });
    const raw = serializePersonalBackup();
    const env = parsePersonalBackup(raw);
    expect(env.app).toBe(PERSONAL_BACKUP_APP);
    expect(env.data.vaultNotes).toBe("semester goal");

    usePersonal.setState({ vaultNotes: "", notes: [] });
    applyPersonalBackup(env);
    expect(usePersonal.getState().vaultNotes).toBe("semester goal");
    expect(usePersonal.getState().notes[0]?.title).toBe("Arrays");

    expect(() =>
      parsePersonalBackup(JSON.stringify({ app: "hr-attendance", version: 1, data: {} })),
    ).toThrow(/Company backup refused|Not an HR Personal/i);

    // buildPersonalBackup shape for audit
    expect(buildPersonalBackup().app).toBe("hr-personal");
  });
});

describe("HR Personal cross-browser sync decisions (cloud source of truth)", () => {
  it("browser B with empty local applies browser A cloud data", () => {
    const a = seedBlob({
      vaultNotes: "from browser A",
      notes: [
        {
          id: "n1",
          courseId: "general",
          title: "A note",
          body: "shared",
          updatedAt: 2,
          tags: [],
        },
      ],
    });
    const bEmpty = seedBlob();
    expect(isPersonalMeaningful(bEmpty)).toBe(false);
    expect(decidePersonalSync(bEmpty, a, { unsynced: false })).toBe("apply_cloud");
    const loaded = __simulateCrossBrowserSync(a, bEmpty);
    expect(loaded.vaultNotes).toBe("from browser A");
    expect(loaded.notes[0]?.title).toBe("A note");
  });

  it("unsynced local keeps local then would push (no silent cloud overwrite)", () => {
    const local = seedBlob({ vaultNotes: "typing…" });
    const cloud = seedBlob({ vaultNotes: "older cloud" });
    expect(decidePersonalSync(local, cloud, { unsynced: true })).toBe("keep_local");
  });

  it("both meaningful without unsynced prefers cloud (second browser matches account)", () => {
    const cloud = seedBlob({ vaultNotes: "canonical" });
    const stale = seedBlob({ vaultNotes: "stale cache" });
    expect(decidePersonalSync(stale, cloud, { unsynced: false })).toBe("apply_cloud");
  });
});

describe("Isolated PGlite Personal SQL (no company tables)", () => {
  let db: PGlite;
  const ownerA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const ownerB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
      INSERT INTO auth.users (id, email) VALUES
        ('${ownerA}', 'personal.a@example.com'),
        ('${ownerB}', 'personal.b@example.com')
      ON CONFLICT DO NOTHING;
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
    `);

    const sql = readFileSync(
      resolve(root, "personal-supabase/migrations/20261109000000_personal_study_secure.sql"),
      "utf8",
    );
    // Guard: migration must not CREATE/ALTER company tables (comments may name them as forbidden).
    const executable = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .toLowerCase();
    expect(executable).not.toMatch(/create table[\s\S]*app_state/);
    expect(executable).not.toContain("tracker_sections");
    expect(executable).not.toMatch(/\bdriver_/);
    expect(executable).toContain("personal_study_state");
    await db.exec(stripAuthUserFks(sql));

    // Force RLS for table owner in this isolated engine
    await db.exec(`ALTER TABLE public.personal_study_state FORCE ROW LEVEL SECURITY`);
    await db.exec(`ALTER TABLE public.personal_profiles FORCE ROW LEVEL SECURITY`);
  });

  async function asUser(userId: string, fn: () => Promise<void>) {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', false)`);
    try {
      await fn();
    } finally {
      await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    }
  }

  it("saves and loads personal_study_state for the same owner (cross-browser row)", async () => {
    await asUser(ownerA, async () => {
      await db.exec(`SET ROLE authenticated`);
      await db.query(
        `INSERT INTO public.personal_study_state (owner_id, data)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (owner_id) DO UPDATE SET data = EXCLUDED.data`,
        [ownerA, JSON.stringify({ vaultNotes: "cloud truth", notes: [{ title: "A" }] })],
      );
      const { rows } = await db.query<{ data: { vaultNotes: string } }>(
        `SELECT data FROM public.personal_study_state WHERE owner_id = $1`,
        [ownerA],
      );
      expect(rows[0]?.data?.vaultNotes).toBe("cloud truth");
      await db.exec(`RESET ROLE`);
    });

    // Simulate browser B: same owner_id reads same row
    await asUser(ownerA, async () => {
      await db.exec(`SET ROLE authenticated`);
      const { rows } = await db.query<{ data: { vaultNotes: string } }>(
        `SELECT data FROM public.personal_study_state WHERE owner_id = $1`,
        [ownerA],
      );
      expect(rows[0]?.data?.vaultNotes).toBe("cloud truth");
      await db.exec(`RESET ROLE`);
    });
  });

  it("RLS blocks owner B from reading owner A study data", async () => {
    await asUser(ownerB, async () => {
      await db.exec(`SET ROLE authenticated`);
      const { rows } = await db.query(
        `SELECT data FROM public.personal_study_state WHERE owner_id = $1`,
        [ownerA],
      );
      expect(rows.length).toBe(0);
      await db.exec(`RESET ROLE`);
    });
  });

  it("unauthenticated role cannot read Personal study rows", async () => {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`SET ROLE anon`);
    let failed = false;
    try {
      await db.query(`SELECT data FROM public.personal_study_state`);
    } catch {
      failed = true;
    }
    await db.exec(`RESET ROLE`);
    // Either zero rows under RLS or permission error — both mean locked
    if (!failed) {
      const { rows } = await db.query(`SELECT data FROM public.personal_study_state`);
      expect(rows.length).toBe(0);
    }
  });
});

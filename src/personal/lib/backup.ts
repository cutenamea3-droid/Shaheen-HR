/**
 * Personal-only study backup export / restore.
 * Never reads or writes Driver/Admin company backup formats or keys.
 */
import { FORBIDDEN_COMPANY_KEYS, PERSONAL_STORAGE_KEY, migrateSettings } from "./defaults";
import { usePersonal, type PersonalStore } from "./store";
import type { PersonalState } from "./types";

export const PERSONAL_BACKUP_APP = "hr-personal" as const;
export const PERSONAL_BACKUP_VERSION = 1 as const;

const SYNC_KEYS = [
  "courses",
  "backlog",
  "assessments",
  "notes",
  "sessions",
  "dayPlans",
  "discipline",
  "settings",
  "vaultNotes",
] as const;

export type PersonalBackupEnvelope = {
  app: typeof PERSONAL_BACKUP_APP;
  version: typeof PERSONAL_BACKUP_VERSION;
  exportedAt: string;
  data: Pick<PersonalState, (typeof SYNC_KEYS)[number]>;
};

export function buildPersonalBackup(): PersonalBackupEnvelope {
  const s = usePersonal.getState();
  return {
    app: PERSONAL_BACKUP_APP,
    version: PERSONAL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      courses: s.courses,
      backlog: s.backlog,
      assessments: s.assessments,
      notes: s.notes,
      sessions: s.sessions,
      dayPlans: s.dayPlans,
      discipline: s.discipline,
      settings: s.settings,
      vaultNotes: s.vaultNotes,
    },
  };
}

export function serializePersonalBackup(envelope = buildPersonalBackup()): string {
  return JSON.stringify(envelope, null, 2);
}

export function parsePersonalBackup(raw: string): PersonalBackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid backup file.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid backup file.");
  const env = parsed as Partial<PersonalBackupEnvelope> & { app?: string };

  // Refuse company backup envelopes
  if (env.app === "hr-attendance" || env.app === "shaheen-driver") {
    throw new Error("Company backup refused — Personal restore only.");
  }
  if (env.app !== PERSONAL_BACKUP_APP) {
    throw new Error("Not an HR Personal backup.");
  }
  if (env.version !== PERSONAL_BACKUP_VERSION) {
    throw new Error("Unsupported Personal backup version.");
  }
  if (!env.data || typeof env.data !== "object") {
    throw new Error("Backup missing study data.");
  }

  // Refuse if payload somehow embeds forbidden company keys as top-level fields
  for (const k of FORBIDDEN_COMPANY_KEYS) {
    if (k in (env.data as object)) {
      throw new Error("Backup contains forbidden company keys.");
    }
  }

  return {
    app: PERSONAL_BACKUP_APP,
    version: PERSONAL_BACKUP_VERSION,
    exportedAt: typeof env.exportedAt === "string" ? env.exportedAt : new Date().toISOString(),
    data: env.data as PersonalBackupEnvelope["data"],
  };
}

export function applyPersonalBackup(envelope: PersonalBackupEnvelope): void {
  const d = envelope.data;
  const patch: Partial<PersonalStore> = {
    courses: d.courses ?? usePersonal.getState().courses,
    backlog: d.backlog ?? [],
    assessments: d.assessments ?? [],
    notes: d.notes ?? [],
    sessions: d.sessions ?? [],
    dayPlans: d.dayPlans ?? {},
    discipline: d.discipline ?? [],
    settings: migrateSettings(d.settings),
    vaultNotes: typeof d.vaultNotes === "string" ? d.vaultNotes : "",
  };
  usePersonal.setState(patch);
}

export function downloadPersonalBackup(): void {
  const json = serializePersonalBackup();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `hr-personal-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Documented Personal browser keys (audit helper). */
export const PERSONAL_LOCAL_STORAGE_KEYS = {
  studyData: PERSONAL_STORAGE_KEY,
  authSecrets: "hr-personal-auth-secrets-v1",
  authSession: "hr-personal-auth-session-v1",
  navVisible: "hr-personal-nav-visible-v1",
  /** Supabase Auth session namespace prefix when secure mode is on */
  sbAuthPrefix: "hr-personal-sb-auth-v1",
} as const;

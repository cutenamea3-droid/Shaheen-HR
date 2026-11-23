import type { DrSourceInventoryItem } from "./types";

/**
 * Static inventory of every Driver Compliance data source (audit Part 1).
 * Dispatch / Admin / Personal are listed as EXCLUDED — never packed into this archive.
 */
export const COMPLIANCE_DR_INVENTORY: DrSourceInventoryItem[] = [
  {
    id: "tracker_sections",
    kind: "supabase_table",
    label: "Tracker sections (docs, plans, notes, follow-ups, records)",
    location: "supabase.public.tracker_sections (okzcwctsgurumnnzuxgg)",
    requiredForComplete: true,
    notes: "SoT when signed in; includes Future Plans, temp notes, DMV/Medical/Queries/SSC&CDL/Docs, compliance_follow_ups, rec_*",
  },
  {
    id: "appdata_cache",
    kind: "localStorage",
    label: "Browser AppData cache",
    location: "localStorage:shaheen-driver-tracker-v1",
    requiredForComplete: true,
    notes: "Short cache of tracker_sections; included so offline edits are recoverable",
  },
  {
    id: "drug_test_events",
    kind: "supabase_rpc",
    label: "Drug / CCF / MRO events",
    location: "RPC driver_drug_test_list → driver_drug_test_events",
    requiredForComplete: true,
    notes: "Admin RPC per driver; mock slice used when VITE_DRIVER_DRUG_TESTS_SECURE≠1",
  },
  {
    id: "rate_cards",
    kind: "supabase_rpc",
    label: "Driver rate cards",
    location: "RPC driver_rate_card_get → driver_rate_cards",
    requiredForComplete: true,
    notes: "Per-driver get; empty cards are valid",
  },
  {
    id: "portal_accounts",
    kind: "supabase_table",
    label: "Portal accounts (no secrets)",
    location: "supabase.public.driver_portal_accounts",
    requiredForComplete: true,
    notes: "Emails/roles/active only — never passwords, JWTs, or secret hashes",
  },
  {
    id: "portal_activity",
    kind: "supabase_table",
    label: "Portal activity (recent)",
    location: "supabase.public.driver_portal_activity (limit 500)",
    requiredForComplete: false,
    excludeReason: "Best-effort history; capped at 500 rows by existing API",
  },
  {
    id: "sensitive_audit_log",
    kind: "supabase_table",
    label: "Sensitive audit log",
    location: "supabase.public.driver_sensitive_audit_log",
    requiredForComplete: false,
    excludeReason: "Deny-all RLS; service_role / Dashboard export requires owner approval",
  },
  {
    id: "attachments_bytes",
    kind: "attachment",
    label: "PDF/image attachment bytes",
    location: "HTTP(S) URLs found in tracker cells (no Storage bucket in Driver module)",
    requiredForComplete: false,
    excludeReason: "Driver Compliance stores document metadata in cells; no Supabase Storage bucket. Linked URLs fetched when reachable; missing/corrupt listed as gaps",
  },
  {
    id: "ui_prefs",
    kind: "localStorage",
    label: "UI preferences & checklist",
    location: "localStorage shaheen-ui-pref-* / shaheen-checklist-* / theme / view / work / density",
    requiredForComplete: false,
    excludeReason: "View-state only — not operational SoT",
  },
  {
    id: "future_plan_expand_session",
    kind: "sessionStorage",
    label: "Future Plan expand session",
    location: "sessionStorage:shaheen.futurePlanExpand.v1",
    requiredForComplete: false,
    excludeReason: "Ephemeral UI accordion state",
  },
  {
    id: "portal_local_secrets",
    kind: "localStorage",
    label: "Local portal password hashes",
    location: "localStorage:shaheen-driver-portal-secrets-v1",
    requiredForComplete: false,
    excludeReason: "NEVER backed up — secrets must not enter the archive",
  },
  {
    id: "auth_jwt",
    kind: "localStorage",
    label: "Supabase Auth JWT / session",
    location: "sb-* Auth storage keys",
    requiredForComplete: false,
    excludeReason: "NEVER backed up — tokens must not enter the archive",
  },
  {
    id: "offline_dirty",
    kind: "in_memory",
    label: "Unsynced dirty section set",
    location: "in-memory dirty Set + LS cache",
    requiredForComplete: false,
    excludeReason: "Captured as changes/offline-dirty.json hint; SoT remains AppData + cloud",
  },
  {
    id: "admin_app_state",
    kind: "supabase_table",
    label: "Admin Attendance app_state",
    location: "Lovable Cloud app_state / hr-attendance-v1",
    requiredForComplete: false,
    excludeReason: "EXCLUDED — Admin module; separate Backup on /admin",
  },
  {
    id: "dispatch_tables",
    kind: "supabase_table",
    label: "Dispatch operations tables",
    location: "dispatch_* in same Supabase project",
    requiredForComplete: false,
    excludeReason: "EXCLUDED — Dispatch not in this repository’s Driver Compliance scope",
  },
  {
    id: "personal_study",
    kind: "supabase_table",
    label: "HR Personal study",
    location: "project zlhrpymgwjswrmqhfatd",
    requiredForComplete: false,
    excludeReason: "EXCLUDED — Personal Study not in this repository",
  },
];

export function inventoryById(id: string): DrSourceInventoryItem | undefined {
  return COMPLIANCE_DR_INVENTORY.find((i) => i.id === id);
}

export function requiredSourceIds(): string[] {
  return COMPLIANCE_DR_INVENTORY.filter((i) => i.requiredForComplete).map((i) => i.id);
}

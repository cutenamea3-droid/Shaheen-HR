/**
 * In-memory audit trail for sensitive Driver HR panels (rate card / drug tests).
 * Never written to tracker_sections / localStorage AppData.
 * Secure backend has its own DB audit table (migration).
 */

export type SensitiveAuditAction =
  | "rate_card_view"
  | "rate_card_upsert"
  | "drug_test_add"
  | "drug_test_update"
  | "drug_test_delete"
  | "drug_test_soft_delete"
  | "drug_test_restore"
  | "drug_test_list";

export interface SensitiveAuditEntry {
  id: string;
  at: number;
  actor: string;
  action: SensitiveAuditAction;
  driverId: string;
  detail: string;
}

const entries: SensitiveAuditEntry[] = [];
const listeners = new Set<() => void>();

const asText = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : String(v));

const ACTION_SET = new Set<string>([
  "rate_card_view",
  "rate_card_upsert",
  "drug_test_add",
  "drug_test_update",
  "drug_test_delete",
  "drug_test_soft_delete",
  "drug_test_restore",
  "drug_test_list",
]);

function emit() {
  listeners.forEach((l) => l());
}

/** Coerce audit scalars so Compliance History never renders object children. */
export function healSensitiveAuditEntry(raw: unknown): SensitiveAuditEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Partial<SensitiveAuditEntry>;
  const actionRaw = asText(e.action);
  if (!ACTION_SET.has(actionRaw)) return null;
  const at =
    typeof e.at === "number" && Number.isFinite(e.at)
      ? e.at
      : Number.isFinite(Number(e.at))
        ? Number(e.at)
        : Date.now();
  return {
    id: asText(e.id).trim() || `aud_${Math.random().toString(36).slice(2, 10)}`,
    at,
    actor: asText(e.actor) || "unknown",
    action: actionRaw as SensitiveAuditAction,
    driverId: asText(e.driverId),
    detail: asText(e.detail),
  };
}

export function recordSensitiveAudit(input: {
  actor: string;
  action: SensitiveAuditAction;
  driverId: string;
  detail?: string;
}): SensitiveAuditEntry {
  const entry =
    healSensitiveAuditEntry({
      id: `aud_${Math.random().toString(36).slice(2, 10)}`,
      at: Date.now(),
      actor: input.actor,
      action: input.action,
      driverId: input.driverId,
      detail: input.detail ?? "",
    }) ?? {
      id: `aud_${Math.random().toString(36).slice(2, 10)}`,
      at: Date.now(),
      actor: asText(input.actor) || "unknown",
      action: input.action,
      driverId: asText(input.driverId),
      detail: asText(input.detail),
    };
  entries.unshift(entry);
  if (entries.length > 500) entries.length = 500;
  emit();
  return entry;
}

export function listSensitiveAudit(limit = 100): SensitiveAuditEntry[] {
  return entries
    .map((e) => healSensitiveAuditEntry(e))
    .filter((e): e is SensitiveAuditEntry => !!e)
    .slice(0, limit);
}

export function clearSensitiveAudit() {
  entries.length = 0;
  emit();
}

export function subscribeSensitiveAudit(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

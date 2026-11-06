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

function emit() {
  listeners.forEach((l) => l());
}

export function recordSensitiveAudit(input: {
  actor: string;
  action: SensitiveAuditAction;
  driverId: string;
  detail?: string;
}): SensitiveAuditEntry {
  const entry: SensitiveAuditEntry = {
    id: `aud_${Math.random().toString(36).slice(2, 10)}`,
    at: Date.now(),
    actor: input.actor || "unknown",
    action: input.action,
    driverId: input.driverId,
    detail: input.detail ?? "",
  };
  entries.unshift(entry);
  if (entries.length > 500) entries.length = 500;
  emit();
  return entry;
}

export function listSensitiveAudit(limit = 100): SensitiveAuditEntry[] {
  return entries.slice(0, limit);
}

export function clearSensitiveAudit() {
  entries.length = 0;
  emit();
}

export function subscribeSensitiveAudit(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

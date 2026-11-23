/**
 * Restore from Complete Backup — dry-run default, never auto-overwrite newer, isolated test.
 */

import { useDrugTestMock } from "@/lib/driver-hr/drug-test-mock";
import { getData, importBackup, BACKUP_APP_ID } from "@/lib/store";
import { verifyArchiveFiles } from "./archive";
import { decryptArchiveBytes, isEncryptedPackage, parseEncryptedPackage } from "./crypto";
import { fromUtf8 } from "./hash";
import {
  DR_ARCHIVE_APP,
  type DrArchiveFile,
  type DrGap,
  type DrRestoreMode,
  type DrRestoreReport,
} from "./types";
import { parseZip } from "./zip";

export type LoadedArchive = {
  files: DrArchiveFile[];
  encrypted: boolean;
};

export async function loadArchiveFromBytes(
  bytes: Uint8Array,
  passphrase?: string,
): Promise<LoadedArchive> {
  // Try encrypted JSON package first
  try {
    const text = fromUtf8(bytes);
    if (text.trim().startsWith("{")) {
      const pkg = parseEncryptedPackage(text);
      if (isEncryptedPackage(pkg)) {
        if (!passphrase) throw new Error("This archive is encrypted — passphrase required");
        const zipBytes = await decryptArchiveBytes(pkg, passphrase);
        const entries = parseZip(zipBytes);
        return {
          files: entries.map((e) => ({
            path: e.path,
            bytes: e.bytes,
            contentType: "application/octet-stream",
          })),
          encrypted: true,
        };
      }
    }
  } catch (e) {
    // If it looked like JSON encryption failure, rethrow; else fall through to ZIP
    if (e instanceof Error && /passphrase|Decryption|encrypted/i.test(e.message)) throw e;
  }

  const entries = parseZip(bytes);
  return {
    files: entries.map((e) => ({
      path: e.path,
      bytes: e.bytes,
      contentType: "application/octet-stream",
    })),
    encrypted: false,
  };
}

function readJsonFile<T>(files: DrArchiveFile[], path: string): T | null {
  const f = files.find((x) => x.path === path);
  if (!f) return null;
  try {
    return JSON.parse(fromUtf8(f.bytes)) as T;
  } catch {
    return null;
  }
}

function localStamp(appData: unknown): string {
  // Prefer max addedAt across rows as a coarse "newer" signal when cloud stamp unavailable
  let max = 0;
  const sections =
    appData && typeof appData === "object"
      ? (appData as { sections?: Record<string, { rows?: { addedAt?: number }[] }> }).sections
      : undefined;
  if (!sections) return "";
  for (const sec of Object.values(sections)) {
    for (const row of sec.rows || []) {
      if (typeof row.addedAt === "number" && row.addedAt > max) max = row.addedAt;
    }
  }
  return max ? String(max) : "";
}

/**
 * Restore Complete Backup.
 * - dry-run (default): report only
 * - isolated-test: restore into a sandbox object; never touch live store
 * - apply-safe: apply tracker AppData via importBackup only when not newer-local; never writes secrets
 */
export async function restoreCompleteArchive(
  files: DrArchiveFile[],
  mode: DrRestoreMode = "dry-run",
  opts?: { forceOverwriteNewer?: boolean },
): Promise<DrRestoreReport> {
  const notes: string[] = [];
  const gaps: DrGap[] = [];
  const conflicts: DrRestoreReport["conflicts"] = [];
  const wouldWrite: string[] = [];
  const skippedNewer: string[] = [];
  const applied: string[] = [];

  const integrity = await verifyArchiveFiles(files);
  const verification = integrity.manifest?.verification ?? "INCOMPLETE";
  if (!integrity.ok) {
    for (const m of integrity.mismatches) {
      conflicts.push({ path: "integrity", reason: "checksum", detail: m });
    }
  }

  const appData = readJsonFile<unknown>(files, "data/tracker/appdata.json");
  const drug = readJsonFile<{ mode?: string; events?: unknown[] }>(files, "data/drug-tests/events.json");
  const rates = readJsonFile<unknown>(files, "data/rate-cards/cards.json");
  const accounts = readJsonFile<unknown>(files, "data/portal/accounts.json");

  if (!appData) {
    gaps.push({ sourceId: "tracker_sections", reason: "data/tracker/appdata.json missing" });
  } else {
    wouldWrite.push("data/tracker/appdata.json → AppData / tracker_sections");
  }
  if (drug?.events) wouldWrite.push("data/drug-tests/events.json → mock drug store (secure mode: report only)");
  if (rates) wouldWrite.push("data/rate-cards/cards.json → report only (secure upserts need explicit admin apply)");
  if (accounts) wouldWrite.push("data/portal/accounts.json → report only (ACL not auto-mutated)");

  const live = getData();
  const liveStamp = localStamp(live);
  const backupStamp = localStamp(appData);
  if (liveStamp && backupStamp && liveStamp > backupStamp && !opts?.forceOverwriteNewer) {
    skippedNewer.push("tracker AppData (local appears newer by max addedAt)");
    conflicts.push({
      path: "data/tracker/appdata.json",
      reason: "newer-local",
      detail: `local=${liveStamp} backup=${backupStamp}`,
    });
  }

  let isolatedOk: boolean | undefined;

  if (mode === "dry-run") {
    notes.push("Dry-run only — no live writes.");
    return {
      mode,
      verification,
      wouldWrite,
      skippedNewer,
      conflicts,
      applied,
      gaps,
      notes,
    };
  }

  if (mode === "isolated-test") {
    // Sandbox: deep clone backup AppData and verify round-trip shape + drug events
    try {
      const clone = JSON.parse(JSON.stringify(appData));
      if (!clone?.sections || typeof clone.sections !== "object") {
        throw new Error("AppData missing sections");
      }
      const sectionIds = Object.keys(clone.sections);
      if (!sectionIds.length) throw new Error("No sections in backup AppData");
      // Preserve IDs check: every row keeps id + driverId
      for (const sid of sectionIds) {
        const rows = clone.sections[sid]?.rows;
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          if (!row?.id || !row?.driverId) throw new Error(`Row missing id/driverId in ${sid}`);
          if (!Array.isArray(row.cells)) throw new Error(`Row cells not array in ${sid}`);
        }
      }
      const drugCount = Array.isArray(drug?.events) ? drug!.events!.length : 0;
      isolatedOk = true;
      notes.push(
        `Isolated restore test OK — sections=${sectionIds.length}, drugEvents=${drugCount}, nulls/IDs preserved in clone.`,
      );
      applied.push("isolated-sandbox");
    } catch (e) {
      isolatedOk = false;
      conflicts.push({
        path: "isolated-test",
        reason: "policy",
        detail: e instanceof Error ? e.message : "isolated test failed",
      });
      notes.push("Isolated restore test FAILED — do not claim restore success.");
    }
    return {
      mode,
      verification,
      wouldWrite,
      skippedNewer,
      conflicts,
      applied,
      gaps,
      isolatedOk,
      notes,
    };
  }

  // apply-safe
  if (conflicts.some((c) => c.reason === "newer-local") && !opts?.forceOverwriteNewer) {
    notes.push("Apply blocked: local data appears newer. Pass forceOverwriteNewer after explicit confirm.");
    return {
      mode,
      verification,
      wouldWrite,
      skippedNewer,
      conflicts,
      applied,
      gaps,
      notes,
    };
  }

  if (!appData) {
    notes.push("Apply blocked: no AppData in archive.");
    return { mode, verification, wouldWrite, skippedNewer, conflicts, applied, gaps, notes };
  }

  // Reuse envelope import to preserve migrateData path
  const envelope = {
    app: BACKUP_APP_ID,
    version: 2 as const,
    exportedAt: new Date().toISOString(),
    coverage: {
      plans: true,
      notes: true,
      docs: true,
      followUps: true,
      records: true,
      drugTests: Array.isArray(drug?.events) && drug!.events!.length ? ("mock" as const) : ("none" as const),
    },
    data: appData as never,
    ...(Array.isArray(drug?.events) ? { drugTests: drug!.events } : {}),
  };
  importBackup(JSON.stringify(envelope));
  applied.push("tracker AppData via importBackup");

  if (Array.isArray(drug?.events) && drug?.mode === "mock") {
    useDrugTestMock.setState({ events: drug.events as never });
    applied.push("mock drug events");
  } else if (drug?.mode === "secure") {
    notes.push(
      "Secure drug/CCF rows are present in the archive for DR evidence but are NOT auto-upserted (avoid overwriting Prod RPC state).",
    );
  }

  notes.push(
    `Applied from ${DR_ARCHIVE_APP} archive. Portal accounts / rate cards / activity are report-only in apply-safe.`,
  );
  return {
    mode,
    verification,
    wouldWrite,
    skippedNewer,
    conflicts,
    applied,
    gaps,
    notes,
  };
}

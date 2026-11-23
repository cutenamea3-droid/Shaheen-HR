/**
 * Build a one-click portable Compliance DR archive.
 * Layout: manifest.json, README.md, application-version.json, schema/, data/, attachments/, changes/, integrity/
 */

import { getDriverDrugTestMode } from "@/lib/driver-hr/drug-test-mode";
import { getDriverRateCardMode } from "@/lib/driver-hr/rate-card-mode";
import { SECTIONS } from "@/lib/sections";
import { extractAttachmentUrls, safeAttachmentFilename } from "./attachments";
import { createDefaultCollectors } from "./collectors";
import { encryptArchiveBytes, encryptedPackageToBytes } from "./crypto";
import { fromUtf8, sha256Bytes, utf8 } from "./hash";
import { COMPLIANCE_DR_INVENTORY } from "./inventory";
import {
  DR_ARCHIVE_APP,
  DR_ARCHIVE_FORMAT_VERSION,
  type DrArchiveFile,
  type DrBuildOptions,
  type DrBuildResult,
  type DrCollectors,
  type DrCoverageSlice,
  type DrGap,
  type DrManifest,
  type DrVerificationStatus,
} from "./types";
import { buildZip } from "./zip";

function jsonBytes(value: unknown): Uint8Array {
  return utf8(JSON.stringify(value, null, 2));
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sectionsToCsv(appData: unknown): string {
  const sections =
    appData && typeof appData === "object"
      ? (appData as { sections?: Record<string, { headers?: string[]; rows?: { id: string; driverId: string; cells: string[] }[] }> })
          .sections
      : undefined;
  const lines: string[] = ["section_id,row_id,driver_id,col_index,header,value"];
  if (!sections) return lines.join("\n");
  for (const [sid, sec] of Object.entries(sections)) {
    const headers = Array.isArray(sec.headers) ? sec.headers : [];
    const rows = Array.isArray(sec.rows) ? sec.rows : [];
    for (const row of rows) {
      const cells = Array.isArray(row.cells) ? row.cells : [];
      for (let i = 0; i < Math.max(cells.length, headers.length); i++) {
        lines.push(
          [sid, row.id, row.driverId, i, headers[i] ?? "", cells[i] ?? ""]
            .map(csvEscape)
            .join(","),
        );
      }
    }
  }
  return lines.join("\n");
}

function schemaDoc(): unknown {
  return {
    app: DR_ARCHIVE_APP,
    formatVersion: DR_ARCHIVE_FORMAT_VERSION,
    sectionIds: SECTIONS.map((s) => ({ id: s.id, title: s.title, types: s.types })),
    inventory: COMPLIANCE_DR_INVENTORY,
    restoreRules: [
      "Dry-run is the default restore mode.",
      "Never auto-overwrite a newer local/cloud copy (timestamp / version compare).",
      "Preserve IDs, relationships, nulls, and history fields exactly.",
      "Secrets, JWTs, and service keys are never present in this archive.",
      "Isolated restore test must pass before claiming success.",
    ],
  };
}

function readmeText(verification: DrVerificationStatus, gaps: DrGap[]): string {
  const gapLines = gaps.length
    ? gaps.map((g) => `- **${g.sourceId}**: ${g.reason}${g.detail ? ` — ${g.detail}` : ""}`).join("\n")
    : "- (none)";
  return `# Shaheen Driver Compliance — Complete Backup Archive

**Verification:** ${verification}

This portable archive is produced by the Driver Compliance portal (admin-only Complete Backup).
It is designed for disaster recovery of Driver Compliance data only.

## Contents

- \`manifest.json\` — coverage, counts, SHA-256 file list, verification
- \`application-version.json\` — export metadata / secure flags
- \`README.md\` — this file
- \`schema/\` — section types + inventory
- \`data/\` — JSON (+ CSV where useful) for tracker, drugs, rates, portal
- \`attachments/\` — real file bytes for reachable PDFs/images (when any)
- \`changes/\` — offline dirty hint + change summary
- \`integrity/\` — checksums.json

## Gaps

${gapLines}

## Excludes (by design)

- Admin Attendance (\`app_state\` / \`hr-attendance-v1\`)
- Dispatch tables (\`dispatch_*\`)
- Personal Study project
- Passwords, JWTs, portal secret hashes, service role keys

## Restore

1. Prefer **dry-run** (default) to list writes/conflicts.
2. Run **isolated restore test** before applying.
3. Apply-safe never overwrites newer live data without an explicit conflict choice.
`;
}

function decideVerification(gaps: DrGap[], requiredCovered: Set<string>): DrVerificationStatus {
  const required = COMPLIANCE_DR_INVENTORY.filter((i) => i.requiredForComplete).map((i) => i.id);
  for (const id of required) {
    if (!requiredCovered.has(id)) return "INCOMPLETE";
  }
  // Any gap on a required source → incomplete
  if (gaps.some((g) => required.includes(g.sourceId))) return "INCOMPLETE";
  return "VERIFIED COMPLETE";
}

export async function buildCompleteArchive(opts: DrBuildOptions = {}): Promise<DrBuildResult> {
  const collectors: DrCollectors = { ...createDefaultCollectors(), ...opts.collectors };
  const includeUi = opts.includeUiPrefs !== false;
  const fetchAtt = opts.fetchAttachments !== false;
  const exportedAt = new Date().toISOString();
  const files: DrArchiveFile[] = [];
  const gaps: DrGap[] = [];
  const coverage: DrCoverageSlice[] = [];
  const counts: Record<string, number> = {};
  const requiredCovered = new Set<string>();

  const push = async (path: string, bytes: Uint8Array, contentType: string) => {
    files.push({ path, bytes, contentType });
    return sha256Bytes(bytes);
  };

  // --- AppData / tracker ---
  const appData = collectors.getAppData();
  const appJson = jsonBytes(appData);
  const appSha = await push("data/tracker/appdata.json", appJson, "application/json");
  await push("data/tracker/appdata.csv", utf8(sectionsToCsv(appData)), "text/csv");
  const sectionCount =
    appData && typeof appData === "object"
      ? Object.keys((appData as { sections?: object }).sections || {}).length
      : 0;
  counts.sections = sectionCount;
  const driverIds = collectors.listDriverIds();
  counts.drivers = driverIds.length;
  if (sectionCount > 0 && driverIds.length > 0) {
    requiredCovered.add("tracker_sections");
    requiredCovered.add("appdata_cache");
    coverage.push({ id: "tracker_sections", included: true, count: sectionCount, bytes: appJson.length, sha256: appSha });
  } else {
    gaps.push({ sourceId: "tracker_sections", reason: "No sections or drivers in AppData", detail: `sections=${sectionCount} drivers=${driverIds.length}` });
    coverage.push({ id: "tracker_sections", included: false, gap: "empty AppData" });
  }

  // --- Drug tests ---
  const drug = await collectors.listDrugEvents(driverIds);
  const drugBytes = jsonBytes({ mode: drug.mode, events: drug.events });
  const drugSha = await push("data/drug-tests/events.json", drugBytes, "application/json");
  counts.drugEvents = Array.isArray(drug.events) ? drug.events.length : 0;
  if (drug.error) {
    gaps.push({ sourceId: "drug_test_events", reason: "Drug/CCF export failed", detail: drug.error });
    coverage.push({ id: "drug_test_events", included: false, count: counts.drugEvents, gap: drug.error });
  } else if (drug.mode === "secure" || drug.mode === "mock" || counts.drugEvents >= 0) {
    // Empty drug list with successful fetch still counts as covered
    requiredCovered.add("drug_test_events");
    coverage.push({
      id: "drug_test_events",
      included: true,
      count: counts.drugEvents,
      bytes: drugBytes.length,
      sha256: drugSha,
    });
  }

  // --- Rate cards ---
  const rates = await collectors.listRateCards(driverIds);
  const rateBytes = jsonBytes({ mode: rates.mode, cards: rates.cards });
  const rateSha = await push("data/rate-cards/cards.json", rateBytes, "application/json");
  counts.rateCards = Array.isArray(rates.cards) ? rates.cards.length : 0;
  if (rates.error) {
    gaps.push({ sourceId: "rate_cards", reason: "Rate card export failed", detail: rates.error });
    coverage.push({ id: "rate_cards", included: false, gap: rates.error });
  } else {
    requiredCovered.add("rate_cards");
    coverage.push({ id: "rate_cards", included: true, count: counts.rateCards, bytes: rateBytes.length, sha256: rateSha });
  }

  // --- Portal accounts (no secrets) ---
  const portals = await collectors.listPortalAccounts();
  const portalBytes = jsonBytes({ accounts: portals.accounts });
  const portalSha = await push("data/portal/accounts.json", portalBytes, "application/json");
  counts.portalAccounts = Array.isArray(portals.accounts) ? portals.accounts.length : 0;
  if (portals.error) {
    gaps.push({ sourceId: "portal_accounts", reason: "Portal accounts export failed", detail: portals.error });
    coverage.push({ id: "portal_accounts", included: false, gap: portals.error });
  } else {
    requiredCovered.add("portal_accounts");
    coverage.push({
      id: "portal_accounts",
      included: true,
      count: counts.portalAccounts,
      bytes: portalBytes.length,
      sha256: portalSha,
    });
  }

  // --- Activity (optional) ---
  const activity = await collectors.listPortalActivity();
  const actBytes = jsonBytes({ rows: activity.rows, error: activity.error });
  await push("data/portal/activity.json", actBytes, "application/json");
  counts.portalActivity = Array.isArray(activity.rows) ? activity.rows.length : 0;
  if (activity.error) {
    gaps.push({
      sourceId: "portal_activity",
      reason: "Activity export failed (non-blocking)",
      detail: activity.error,
    });
  }
  coverage.push({
    id: "portal_activity",
    included: !activity.error,
    count: counts.portalActivity,
  });

  // Document deny-all audit as intentional exclude (not a COMPLETE blocker)
  coverage.push({
    id: "sensitive_audit_log",
    included: false,
    gap: "Deny-all RLS — requires service_role / Dashboard export approval",
  });

  // --- UI prefs ---
  if (includeUi) {
    const prefs = collectors.readLocalPrefs();
    await push("data/browser/ui-prefs.json", jsonBytes(prefs), "application/json");
    counts.uiPrefKeys = Object.keys(prefs).length;
    coverage.push({ id: "ui_prefs", included: true, count: counts.uiPrefKeys });
  }

  // --- Offline dirty ---
  const dirty = collectors.readOfflineDirty();
  await push("changes/offline-dirty.json", jsonBytes(dirty), "application/json");
  await push(
    "changes/summary.json",
    jsonBytes({
      exportedAt,
      driverCount: driverIds.length,
      drugEvents: counts.drugEvents,
      rateCards: counts.rateCards,
      dirtySectionIds: dirty.dirtySectionIds,
    }),
    "application/json",
  );

  // --- Attachments ---
  const urls = extractAttachmentUrls(appData);
  counts.attachmentUrlsFound = urls.length;
  let attachmentOk = 0;
  const attachmentIndex: { url: string; path?: string; status: string; reason?: string }[] = [];
  if (fetchAtt && urls.length) {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!;
      const res = await collectors.fetchAttachment(url);
      if (res.ok) {
        const name = safeAttachmentFilename(url, i);
        const path = `attachments/${name}`;
        await push(path, res.bytes, res.contentType);
        attachmentOk += 1;
        attachmentIndex.push({ url, path, status: "ok" });
      } else {
        attachmentIndex.push({ url, status: "missing", reason: res.reason });
        gaps.push({
          sourceId: "attachments_bytes",
          reason: "Attachment missing or unreachable",
          detail: `${url} (${res.reason})`,
        });
      }
    }
  } else if (urls.length && !fetchAtt) {
    for (const url of urls) {
      attachmentIndex.push({ url, status: "skipped" });
    }
  }
  counts.attachmentsFetched = attachmentOk;
  await push("attachments/index.json", jsonBytes({ urls: attachmentIndex }), "application/json");
  coverage.push({
    id: "attachments_bytes",
    included: attachmentOk > 0 || urls.length === 0,
    count: attachmentOk,
    ...(urls.length && attachmentOk < urls.length ? { gap: "some attachments missing" } : {}),
  });

  // --- Schema + version ---
  await push("schema/sections.json", jsonBytes(schemaDoc()), "application/json");
  const appVersion = {
    app: DR_ARCHIVE_APP,
    formatVersion: DR_ARCHIVE_FORMAT_VERSION,
    exportedAt,
    gitHint: "shaheen-hr.pages.dev / Driver Compliance",
    viteModes: {
      drugTestsSecure: getDriverDrugTestMode() === "secure",
      rateCardSecure: getDriverRateCardMode() === "secure",
    },
  };
  await push("application-version.json", jsonBytes(appVersion), "application/json");

  const verification = decideVerification(gaps, requiredCovered);

  // Integrity checksums (all data files so far; README/manifest added after)
  const checksums: Record<string, string> = {};
  for (const f of files) {
    checksums[f.path] = await sha256Bytes(f.bytes);
  }
  await push("integrity/checksums.json", jsonBytes({ algorithm: "SHA-256", files: checksums }), "application/json");

  const fileList = [];
  for (const f of files) {
    fileList.push({ path: f.path, sha256: await sha256Bytes(f.bytes), bytes: f.bytes.length });
  }

  const manifest: DrManifest = {
    app: DR_ARCHIVE_APP,
    formatVersion: DR_ARCHIVE_FORMAT_VERSION,
    exportedAt,
    exportedByEmail: opts.actorEmail ?? null,
    verification,
    gaps,
    coverage,
    counts,
    files: fileList,
    encryption: opts.passphrase ? "aes-256-gcm" : "none",
    notes: [
      "Driver Compliance only — Admin/Dispatch/Personal excluded",
      "No passwords, JWTs, or service keys included",
      verification === "VERIFIED COMPLETE"
        ? "All required sources present with successful collection"
        : "See gaps[] for exact incomplete items",
    ],
  };

  await push("manifest.json", jsonBytes(manifest), "application/json");
  await push("README.md", utf8(readmeText(verification, gaps)), "text/markdown");

  // Recompute final checksums including manifest/readme
  const finalChecksums: Record<string, string> = {};
  for (const f of files) finalChecksums[f.path] = await sha256Bytes(f.bytes);
  const integrityIdx = files.findIndex((f) => f.path === "integrity/checksums.json");
  if (integrityIdx >= 0) {
    files[integrityIdx] = {
      path: "integrity/checksums.json",
      bytes: jsonBytes({ algorithm: "SHA-256", files: finalChecksums }),
      contentType: "application/json",
    };
  }

  const zipBytes = buildZip(files.map((f) => ({ path: f.path, bytes: f.bytes })));
  const day = exportedAt.slice(0, 10);
  const tag = verification === "VERIFIED COMPLETE" ? "COMPLETE" : "INCOMPLETE";

  if (opts.passphrase) {
    const pkg = await encryptArchiveBytes(zipBytes, opts.passphrase, {
      verificationHint: verification,
      exportedAt,
    });
    const encBytes = encryptedPackageToBytes(pkg);
    return {
      manifest,
      files,
      bytes: encBytes,
      blob: new Blob([encBytes.slice()], { type: "application/json" }),
      filename: `shaheen-compliance-dr-${day}-${tag}.encrypted.json`,
      verification,
      gaps,
    };
  }

  return {
    manifest,
    files,
    bytes: zipBytes,
    blob: new Blob([zipBytes.slice()], { type: "application/zip" }),
    filename: `shaheen-compliance-dr-${day}-${tag}.zip`,
    verification,
    gaps,
  };
}

export async function verifyArchiveFiles(files: DrArchiveFile[]): Promise<{
  ok: boolean;
  mismatches: string[];
  manifest: DrManifest | null;
}> {
  const manifestFile = files.find((f) => f.path === "manifest.json");
  if (!manifestFile) return { ok: false, mismatches: ["manifest.json missing"], manifest: null };
  const manifest = JSON.parse(fromUtf8(manifestFile.bytes)) as DrManifest;
  const mismatches: string[] = [];
  for (const entry of manifest.files) {
    const f = files.find((x) => x.path === entry.path);
    if (!f) {
      mismatches.push(`missing ${entry.path}`);
      continue;
    }
    const h = await sha256Bytes(f.bytes);
    if (h !== entry.sha256) mismatches.push(`checksum ${entry.path}`);
  }
  return { ok: mismatches.length === 0, mismatches, manifest };
}

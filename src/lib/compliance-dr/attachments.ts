/** Scan AppData cells for http(s) attachment URLs. */

const URL_RE = /https?:\/\/[^\s"'<>]+/gi;

export function extractAttachmentUrls(appData: unknown): string[] {
  const found = new Set<string>();
  if (!appData || typeof appData !== "object") return [];
  const sections = (appData as { sections?: Record<string, { rows?: { cells?: unknown[] }[] }> }).sections;
  if (!sections || typeof sections !== "object") return [];
  for (const sec of Object.values(sections)) {
    const rows = Array.isArray(sec?.rows) ? sec.rows : [];
    for (const row of rows) {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      for (const cell of cells) {
        if (typeof cell !== "string" || !cell.includes("http")) continue;
        const matches = cell.match(URL_RE);
        if (!matches) continue;
        for (const m of matches) {
          const cleaned = m.replace(/[),.;]+$/g, "");
          found.add(cleaned);
        }
      }
    }
  }
  return [...found].sort();
}

export function safeAttachmentFilename(url: string, index: number): string {
  try {
    const u = new URL(url);
    const base = u.pathname.split("/").filter(Boolean).pop() || `file-${index}`;
    const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    return `${String(index).padStart(3, "0")}_${safe || "attachment"}`;
  } catch {
    return `${String(index).padStart(3, "0")}_attachment`;
  }
}

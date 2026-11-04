import { afterEach, expect, test, vi } from "vitest";
import {
  buildDriverDossier,
  printDriverDossier,
  renderDriverDossierHtml,
} from "@/lib/driver-dossier";
import { buildSeed, type AppData, type Row } from "@/lib/sections";

function isoOffset(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function mockData(): AppData {
  const base = buildSeed();
  const driverA = "d_print_a";
  const driverB = "d_print_b";

  const row = (id: string, driverId: string, cells: string[]): Row => ({ id, driverId, cells });

  return {
    ...base,
    sections: {
      ...base.sections,
      dmv: {
        ...base.sections.dmv,
        rows: [
          row("dmv_a", driverA, [
            "Alpha Driver",
            "CA111",
            "Applied",
            isoOffset(10),
            "NONE",
            "DMV note A",
            "Active",
            "",
            "CA",
            "",
          ]),
          row("dmv_b", driverB, [
            "Bravo Driver",
            "CA222",
            "Valid",
            isoOffset(90),
            "NONE",
            "DMV note B",
            "Active",
            "",
            "CA",
            "",
          ]),
        ],
      },
      medical: {
        ...base.sections.medical,
        rows: [
          row("med_a", driverA, ["Alpha Driver", "Valid", isoOffset(40), "Med note", "", "Active", "", ""]),
          row("med_b", driverB, ["Bravo Driver", "Expired", isoOffset(-2), "Other med", "", "Active", "", ""]),
        ],
      },
      queries: {
        ...base.sections.queries,
        rows: [
          row("q_a", driverA, [
            "Alpha Driver",
            "Applied",
            isoOffset(14),
            "Applied",
            isoOffset(-3),
            "CH notes",
            "",
            "",
            "Active",
            "",
          ]),
          row("q_b", driverB, [
            "Bravo Driver",
            "Valid",
            isoOffset(100),
            "Valid",
            isoOffset(100),
            "Other CH",
            "",
            "",
            "Active",
            "",
          ]),
        ],
      },
      ssccdl: {
        ...base.sections.ssccdl,
        rows: [
          row("s_a", driverA, ["Alpha Driver", "CA111", "Valid", isoOffset(200), "Valid", "", "SSC note", "", "Active", ""]),
          row("s_b", driverB, ["Bravo Driver", "CA222", "Valid", isoOffset(200), "Valid", "", "Other SSC", "", "Active", ""]),
        ],
      },
      docs: {
        ...base.sections.docs,
        rows: [
          row("docs_a", driverA, [
            "Alpha Driver",
            "",
            "Valid",
            "Valid",
            "Missing",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Sign Missing",
            "Docs note A",
            "Active",
            "",
          ]),
          row("docs_b", driverB, [
            "Bravo Driver",
            "",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Valid",
            "Docs note B",
            "Active",
            "",
          ]),
        ],
      },
      info: {
        ...base.sections.info,
        rows: [
          row("info_a", driverA, ["Alpha Driver", "555-0100", "alpha@example.com", "CA"]),
          row("info_b", driverB, ["Bravo Driver", "555-0200", "bravo@example.com", "NV"]),
        ],
      },
      rec_drivers: {
        headers: ["Name", "Document", "Status", "Expiry Date", "Notes", "Active Status"],
        widths: [200, 200, 200, 200, 200, 150],
        hidden: [false, false, false, false, false, false],
        rows: [
          row("rd_a", "r_a", ["Alpha Driver", "Hazmat Cert", "Valid", isoOffset(30), "Extra A", "Active"]),
          row("rd_b", "r_b", ["Bravo Driver", "Other Cert", "Expired", isoOffset(-1), "Extra B", "Active"]),
        ],
      },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("buildDriverDossier keeps Applied + Expiration and only this driver’s data", () => {
  const data = mockData();
  const a = buildDriverDossier(data, "d_print_a");

  expect(a.driverId).toBe("d_print_a");
  expect(a.name).toBe("Alpha Driver");
  expect(a.cdl).toBe("CA111");
  expect(a.phone).toBe("555-0100");
  expect(a.email).toBe("alpha@example.com");

  const dmv = a.lines.find((l) => l.label === "DMV Pull Notice")!;
  expect(dmv.status).toBe("Applied + 10 Days Remaining");
  expect(dmv.expiry).not.toBe("—");
  expect(dmv.notes).toContain("DMV note A");
  expect(dmv.notes).not.toContain("DMV note B");

  const annual = a.lines.find((l) => l.label === "Annual Query")!;
  expect(annual.status).toBe("Applied + 14 Days Remaining");
  expect(annual.section).toBe("Clearinghouse");

  const pre = a.lines.find((l) => l.label === "Pre-Employment Query")!;
  expect(pre.status).toBe("Expired + Applied");

  expect(a.lines.some((l) => /Bravo|Other med|Other CH|Docs note B/i.test(`${l.status}${l.notes}`))).toBe(false);
  expect(a.otherDocs.every((d) => !/Docs note B/i.test(d.notes))).toBe(true);
  expect(a.records).toHaveLength(1);
  expect(a.records[0].document).toBe("Hazmat Cert");
  expect(a.records[0].notes).toContain("Extra A");
});

test("renderDriverDossierHtml brands Shaheen and hides chrome for print", () => {
  const html = renderDriverDossierHtml(mockData(), "d_print_a", { logoUrl: "https://example.test/logo.jpg" });
  expect(html).toContain("Shaheen Transport LLC");
  expect(html).toContain("Alpha Driver");
  expect(html).toContain("data-driver-id=\"d_print_a\"");
  expect(html).toContain("Clearinghouse");
  expect(html).toContain("Other documents");
  expect(html).toContain("Relevant records");
  expect(html).toContain("Hazmat Cert");
  expect(html).toContain("Applied + 10 Days Remaining");
  expect(html).toContain("@media print");
  expect(html).toContain("dossier-actions");
  expect(html).toContain("window.print()");
  expect(html).toContain("@page");
  expect(html).not.toContain("Bravo Driver");
  expect(html).not.toContain("Other Cert");
  expect(html).not.toContain("bravo@example.com");
});

test("printDriverDossier opens window without noopener and writes HTML", () => {
  const doc = {
    open: vi.fn(),
    write: vi.fn(),
    close: vi.fn(),
  };
  const popup = { document: doc, opener: {} as Window | null };
  const open = vi.fn((_url?: string, _target?: string, features?: string) => {
    void features;
    return popup;
  });
  vi.stubGlobal("window", { open, location: { origin: "http://localhost:5173" } });
  vi.stubGlobal("document", { createElement: vi.fn(), body: { appendChild: vi.fn() } });

  const ok = printDriverDossier(mockData(), "d_print_a");
  expect(ok).toBe(true);
  expect(open).toHaveBeenCalledTimes(1);
  const featuresArg = String(open.mock.calls[0]?.[2] ?? "");
  expect(featuresArg).not.toMatch(/noopener/i);
  expect(doc.open).toHaveBeenCalled();
  expect(doc.write).toHaveBeenCalledTimes(1);
  const written = String(doc.write.mock.calls[0]?.[0] ?? "");
  expect(written).toContain("Alpha Driver");
  expect(written).toContain("window.print()");
  expect(doc.close).toHaveBeenCalled();
  expect(popup.opener).toBeNull();
});

test("printDriverDossier falls back to iframe when pop-up blocked", () => {
  const iframeDoc = { open: vi.fn(), write: vi.fn(), close: vi.fn() };
  const iframe = {
    setAttribute: vi.fn(),
    style: { cssText: "" },
    contentDocument: iframeDoc,
    contentWindow: { document: iframeDoc },
    remove: vi.fn(),
  };
  const createElement = vi.fn(() => iframe);
  const appendChild = vi.fn();
  vi.stubGlobal("window", { open: vi.fn(() => null), location: { origin: "http://localhost" } });
  vi.stubGlobal("document", { createElement, body: { appendChild } });

  const ok = printDriverDossier(mockData(), "d_print_a");
  expect(ok).toBe(true);
  expect(createElement).toHaveBeenCalledWith("iframe");
  expect(appendChild).toHaveBeenCalledWith(iframe);
  expect(iframeDoc.write).toHaveBeenCalled();
  expect(String(iframeDoc.write.mock.calls[0]?.[0] ?? "")).toContain("Alpha Driver");
});

test("printDriverDossier rejects empty driverId", () => {
  expect(printDriverDossier(mockData(), "")).toBe(false);
});

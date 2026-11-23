import { describe, expect, it, beforeEach } from "vitest";
import { isValidPkIban, maskPkIban, normalizePkIban, pkIbanLast4 } from "./pk-iban";
import {
  PK_PAYMENT_INSTITUTIONS,
  PK_PAYMENT_INSTITUTIONS_REF_DATE,
  PK_INSTITUTION_OTHER_ID,
  countInstitutionsByKind,
  institutionDisplayLabel,
  searchPkInstitutions,
} from "./pk-payment-institutions";
import { shortName } from "./reports";
import {
  employeeFinancePersistenceGuard,
  useEmployeeFinanceMock,
} from "./employee-finance-mock";
import { getEmployeeFinanceMode, shouldShowFinanceMockUi } from "./employee-finance-mode";
import { normalizeEmployee } from "./store";
import { decideHrSync, isHrPayloadEmpty, refuseSeedOrEmptyPush } from "./hr-sync-protect";
import { tenureFromJoiningDate } from "./employee-finance-types";
import { HR_SYNC_KEYS } from "./hr-sync-protect";

describe("pk-iban", () => {
  it("validates synthetic MOD-97 IBANs", () => {
    expect(isValidPkIban("PK13HABB0000001234567001")).toBe(true);
    expect(isValidPkIban("PK13 MEZN 0000 0012 3456 7002")).toBe(true);
    expect(isValidPkIban("PK00HABB0000001234567001")).toBe(false);
    expect(isValidPkIban("DE89370400440532013000")).toBe(false);
  });

  it("masks by default and exposes last4", () => {
    const iban = "PK13HABB0000001234567001";
    expect(maskPkIban(iban)).toBe("PK** HABB **** **** **** 7001");
    expect(pkIbanLast4(iban)).toBe("7001");
    expect(normalizePkIban("pk13 habb 0000001234567001")).toBe(iban);
    expect(normalizePkIban(null as unknown as string)).toBe("");
    expect(() => normalizePkIban(13 as unknown as string)).not.toThrow();
  });
});

describe("pk-payment-institutions", () => {
  it("institutionDisplayLabel and shortName coerce non-string labels", () => {
    expect(institutionDisplayLabel(PK_INSTITUTION_OTHER_ID, null as unknown as string)).toBe("Other");
    expect(() => institutionDisplayLabel(PK_INSTITUTION_OTHER_ID, 42 as unknown as string)).not.toThrow();
    expect(shortName(null)).toBe("");
    expect(shortName("Alexander Longname")).toBe("Alexander");
  });

  it("has reference date and category coverage", () => {
    expect(PK_PAYMENT_INSTITUTIONS_REF_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const counts = countInstitutionsByKind();
    expect(counts.commercial_bank).toBeGreaterThan(5);
    expect(counts.islamic_bank).toBeGreaterThan(2);
    expect(counts.digital_bank).toBeGreaterThan(1);
    expect(counts.microfinance_bank).toBeGreaterThan(3);
    expect(counts.emi_psp).toBeGreaterThan(3);
    expect(PK_PAYMENT_INSTITUTIONS.every((i) => (i.kind === "emi_psp" ? !i.isBank : true))).toBe(true);
  });

  it("searches aliases without calling wallets banks", () => {
    const jazz = searchPkInstitutions("JazzCash");
    expect(jazz.some((j) => j.id === "jazzcash" && !j.isBank)).toBe(true);
    expect(searchPkInstitutions("Meezan").some((x) => x.id === "meezan")).toBe(true);
    for (const id of ["easypaisa", "jazzcash", "sadapay", "nayapay"] as const) {
      const hit = PK_PAYMENT_INSTITUTIONS.find((x) => x.id === id);
      expect(hit?.kind).toBe("emi_psp");
      expect(hit?.isBank).toBe(false);
    }
  });
});

describe("employee-finance-mode", () => {
  it("defaults to live Team roster; secure requires explicit flag + applied migration", () => {
    // Vitest runs in DEV; preview-isolated is off; secure flag unset → live.
    expect(getEmployeeFinanceMode()).toBe("live");
  });

  it("keeps mock chrome off by default (live roster; never auto-replace)", () => {
    // Opt-in only via VITE_SHOW_FINANCE_MOCK or preview-isolated.
    expect(shouldShowFinanceMockUi()).toBe(false);
  });
});

describe("directory soft-delete + sync safety", () => {
  it("normalizeEmployee keeps inactive soft-delete without dropping id", () => {
    const e = normalizeEmployee({
      id: "emp-live-1",
      name: "Sara",
      deptId: "d1",
      afterHours: false,
      joinMonth: "2024-01",
      openingLeave: 0,
      inactive: true,
    });
    expect(e.id).toBe("emp-live-1");
    expect(e.inactive).toBe(true);
    const cleared = normalizeEmployee({ ...e, inactive: false });
    expect(cleared.inactive).toBeUndefined();
  });

  it("never applies empty cloud over meaningful local employees/records", () => {
    const local = {
      depts: [{ id: "d1", name: "Ops", start: 540, end: 1140 }],
      employees: [{ id: "e1", name: "Sara", deptId: "d1", afterHours: false, joinMonth: "2024-01", openingLeave: 0 }],
      records: { "2026-11-01": { e1: { status: "present" } } },
      perf: {},
      tasks: [],
      settings: {},
      team: [],
      logs: [],
    };
    const empty = { employees: [], records: {} };
    expect(isHrPayloadEmpty(empty)).toBe(true);
    expect(decideHrSync(local, empty)).toBe("push_local");
    expect(refuseSeedOrEmptyPush(empty, local)).toBe(true);
  });
});

describe("tenureFromJoiningDate", () => {
  it("computes years/months without inventing hire dates", () => {
    const t = tenureFromJoiningDate("2024-02-01", new Date("2026-05-15"));
    expect(t?.years).toBe(2);
    expect(t?.months).toBe(3);
    expect(tenureFromJoiningDate(null)).toBeNull();
  });
});

describe("employee-finance-mock security", () => {
  beforeEach(() => {
    useEmployeeFinanceMock.getState().resetMockSeed();
  });

  it("does not use localStorage persist and stays off sync keys", () => {
    const g = employeeFinancePersistenceGuard();
    expect(g.usesLocalStorage).toBe(false);
    expect(HR_SYNC_KEYS).not.toContain("banking" as never);
    expect(HR_SYNC_KEYS).not.toContain("payments" as never);
    expect(HR_SYNC_KEYS).not.toContain("employeeFinance" as never);
    expect(HR_SYNC_KEYS).toEqual(["depts", "employees", "records", "perf", "tasks", "settings", "team", "logs"]);
  });

  it("requires confirm to deactivate and reactivates same id", () => {
    const s = useEmployeeFinanceMock.getState();
    expect(s.setStatus("mock-emp-a1", "inactive").ok).toBe(false);
    expect(s.setStatus("mock-emp-a1", "inactive", true).ok).toBe(true);
    expect(useEmployeeFinanceMock.getState().meta["mock-emp-a1"]?.status).toBe("inactive");
    expect(s.setStatus("mock-emp-a1", "active").ok).toBe(true);
    expect(useEmployeeFinanceMock.getState().meta["mock-emp-a1"]?.status).toBe("active");
    expect(useEmployeeFinanceMock.getState().meta["mock-emp-a1"]?.reactivatedAt).toBeTruthy();
  });

  it("setDesignation and addBankingChange coerce non-string fields", () => {
    const s = useEmployeeFinanceMock.getState();
    expect(() => s.setDesignation("mock-emp-a1", null as unknown as string)).not.toThrow();
    expect(() =>
      s.addBankingChange({
        employeeId: "mock-emp-a1",
        institutionId: "other",
        accountTitle: null as unknown as string,
        accountRef: null as unknown as string,
        isIban: false,
        otherLabel: null as unknown as string,
        note: 9 as unknown as string,
        effectiveFrom: "2026-11-17",
      }),
    ).not.toThrow();
    expect(
      s.addBankingChange({
        employeeId: "mock-emp-a1",
        institutionId: "other",
        accountTitle: null as unknown as string,
        accountRef: null as unknown as string,
        isIban: false,
        otherLabel: null as unknown as string,
        effectiveFrom: "2026-11-17",
      }).ok,
    ).toBe(false);
  });

  it("keeps banking history without overwrite", () => {
    const s = useEmployeeFinanceMock.getState();
    const before = s.bankingHistory("mock-emp-d4").length;
    expect(before).toBeGreaterThanOrEqual(2);
    const r = s.addBankingChange({
      employeeId: "mock-emp-d4",
      institutionId: "ubl",
      accountTitle: "Danish Iqbal",
      accountRef: "PK94UNIL0000001234567003",
      isIban: true,
      effectiveFrom: "2026-11-05",
      note: "New",
    });
    expect(r.ok).toBe(true);
    const hist = useEmployeeFinanceMock.getState().bankingHistory("mock-emp-d4");
    expect(hist.length).toBe(before + 1);
    expect(hist.filter((h) => !h.supersededAt)).toHaveLength(1);
  });

  it("rejects invalid IBAN", () => {
    const s = useEmployeeFinanceMock.getState();
    expect(
      s.addBankingChange({
        employeeId: "mock-emp-a1",
        institutionId: "hbl",
        accountTitle: "X",
        accountRef: "PK00HABB0000001234567001",
        isIban: true,
        effectiveFrom: "2026-11-05",
      }).ok,
    ).toBe(false);
  });

  it("stores joining date and designation without touching sync keys", () => {
    const s = useEmployeeFinanceMock.getState();
    expect(s.setJoiningDate("mock-emp-a1", "2024-02-01").ok).toBe(true);
    expect(useEmployeeFinanceMock.getState().meta["mock-emp-a1"]?.joiningDate).toBe("2024-02-01");
    expect(s.setDesignation("mock-emp-a1", "HR Officer").ok).toBe(true);
    expect(useEmployeeFinanceMock.getState().meta["mock-emp-a1"]?.designation).toBe("HR Officer");
  });

  it("reveal keeps plaintext in session memory only", () => {
    const s = useEmployeeFinanceMock.getState();
    const r = s.revealAccount("bank-a1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toContain("HABB");
    expect(s.isRevealed("bank-a1")).toBe(true);
    expect(s.getRevealedPlaintext("bank-a1")).toMatch(/^PK/);
  });
});

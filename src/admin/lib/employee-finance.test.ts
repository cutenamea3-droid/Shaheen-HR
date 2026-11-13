import { describe, expect, it, beforeEach } from "vitest";
import { isValidPkIban, maskPkIban, normalizePkIban, pkIbanLast4 } from "./pk-iban";
import {
  PK_PAYMENT_INSTITUTIONS,
  PK_PAYMENT_INSTITUTIONS_REF_DATE,
  countInstitutionsByKind,
  searchPkInstitutions,
} from "./pk-payment-institutions";
import {
  employeeFinancePersistenceGuard,
  useEmployeeFinanceMock,
} from "./employee-finance-mock";
import { getEmployeeFinanceMode } from "./employee-finance-mode";
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
  });
});

describe("pk-payment-institutions", () => {
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
  it("defaults to mock (secure requires explicit flag + applied migration)", () => {
    expect(getEmployeeFinanceMode()).toBe("mock");
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

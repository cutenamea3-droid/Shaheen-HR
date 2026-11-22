import { describe, expect, it } from "vitest";
import {
  clearSensitiveAudit,
  healSensitiveAuditEntry,
  listSensitiveAudit,
  recordSensitiveAudit,
} from "@/lib/driver-hr/sensitive-audit";
import { buildComplianceHistory } from "@/lib/compliance-history";
import { getData } from "@/lib/store";

describe("Sensitive audit text heal guards", () => {
  it("healSensitiveAuditEntry coerces actor/detail and drops bad action", () => {
    const ok = healSensitiveAuditEntry({
      id: 1,
      at: "100",
      actor: true,
      action: "rate_card_view",
      driverId: 9,
      detail: { d: 1 },
    });
    expect(ok?.actor).toBe("true");
    expect(ok?.driverId).toBe("9");
    expect(ok?.detail).toBe("[object Object]");
    expect(ok?.at).toBe(100);
    expect(healSensitiveAuditEntry({ action: "nope", actor: "a", driverId: "d" })).toBeNull();
  });

  it("recordSensitiveAudit stringifies actor/detail", () => {
    clearSensitiveAudit();
    const e = recordSensitiveAudit({
      actor: 3 as unknown as string,
      action: "drug_test_list",
      driverId: true as unknown as string,
      detail: { n: 1 } as unknown as string,
    });
    expect(e.actor).toBe("3");
    expect(e.driverId).toBe("true");
    expect(e.detail).toBe("[object Object]");
    expect(listSensitiveAudit(1)[0]?.actor).toBe("3");
  });

  it("buildComplianceHistory coerces sensitive audit text into detail", () => {
    clearSensitiveAudit();
    recordSensitiveAudit({
      actor: "hr",
      action: "rate_card_view",
      driverId: "d1",
      detail: "ok",
    });
    const events = buildComplianceHistory(getData(), {
      sensitiveAudit: [
        {
          id: "x",
          at: Date.now(),
          actor: 7 as unknown as string,
          action: "rate_card_view",
          driverId: "d1",
          detail: true as unknown as string,
        },
      ],
      limit: 20,
    });
    const sens = events.find((e) => e.source === "sensitive_audit");
    expect(sens?.detail).toContain("true");
    expect(typeof sens?.actor).toBe("string");
  });
});

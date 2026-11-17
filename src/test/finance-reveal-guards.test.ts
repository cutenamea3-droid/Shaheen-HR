import { beforeEach, describe, expect, it } from "vitest";
import { useEmployeeFinanceMock } from "@/admin/lib/employee-finance-mock";

describe("finance reveal Set/map guards", () => {
  beforeEach(() => {
    useEmployeeFinanceMock.getState().resetMockSeed();
  });

  it("isRevealed/toggleReveal tolerate non-Set revealAccountIds", () => {
    useEmployeeFinanceMock.setState({
      revealAccountIds: null as never,
      revealedPlaintext: null as never,
    });
    expect(useEmployeeFinanceMock.getState().isRevealed("missing")).toBe(false);
    expect(() => useEmployeeFinanceMock.getState().toggleReveal("missing")).not.toThrow();
  });
});

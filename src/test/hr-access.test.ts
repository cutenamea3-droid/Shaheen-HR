import { describe, expect, it } from "vitest";
import { HR_OWNER_EMAIL, isAdminHrAdmin, resolveAdminHrRoleFromEmail } from "@/admin/lib/hr-access";

describe("Admin-HR access resolution", () => {
  it("owner email is admin", () => {
    expect(resolveAdminHrRoleFromEmail(HR_OWNER_EMAIL)).toBe("admin");
    expect(isAdminHrAdmin(HR_OWNER_EMAIL)).toBe(true);
  });

  it("active team directory member role is honored (soft ACL)", () => {
    expect(
      resolveAdminHrRoleFromEmail("ops@example.com", [
        { id: "1", name: "Ops", email: "ops@example.com", role: "admin", active: true },
      ]),
    ).toBe("admin");
    expect(
      resolveAdminHrRoleFromEmail("ops@example.com", [
        { id: "1", name: "Ops", email: "ops@example.com", role: "standard", active: true },
      ]),
    ).toBe("standard");
  });

  it("inactive directory member falls back to standard", () => {
    expect(
      resolveAdminHrRoleFromEmail("ops@example.com", [
        { id: "1", name: "Ops", email: "ops@example.com", role: "admin", active: false },
      ]),
    ).toBe("standard");
  });
});

import { describe, expect, it } from "vitest";
import { healDispatchAccount } from "@/dispatch/lib/auth";
import { healPortalAccount } from "@/lib/cloud";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Portal account display heal guards", () => {
  it("healDispatchAccount coerces display_name/email", () => {
    const a = healDispatchAccount({
      user_id: 1 as unknown as string,
      email: true as unknown as string,
      display_name: { n: 1 } as unknown as string,
      role: "dispatcher",
      active: 1 as unknown as boolean,
    });
    expect(a.user_id).toBe("1");
    expect(a.email).toBe("true");
    expect(a.display_name).toBe("[object Object]");
    expect(a.active).toBe(true);
  });

  it("healPortalAccount coerces display_name/email/role", () => {
    const a = healPortalAccount({
      user_id: "u",
      email: 9 as unknown as string,
      display_name: false as unknown as string,
      role: "nope" as never,
      active: false,
    });
    expect(a.email).toBe("9");
    expect(a.display_name).toBe("false");
    expect(a.role).toBe("standard");
  });

  it("DriverManageControls coerces name before trim", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/DriverManageControls.tsx"),
      "utf8",
    );
    expect(src).toMatch(/typeof name === "string" \? name : String\(name\)/);
  });
});

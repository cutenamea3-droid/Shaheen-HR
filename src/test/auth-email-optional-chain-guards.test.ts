import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("auth email optional-chain coerce guards", () => {
  it("dispatch ensure_self uses asLoginEmail before split", () => {
    const src = readFileSync(resolve(process.cwd(), "src/dispatch/lib/auth.ts"), "utf8");
    expect(src).toMatch(/asLoginEmail\(user\.email\)\.split\("@\"\)/);
    expect(src).not.toMatch(/user\.email\?\.split\("/);
  });

  it("Driver cloud ACL compare coerces email via asErrText", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/cloud.ts"), "utf8");
    expect(src).toMatch(/asErrText\(userData\.user\.email\)\.trim\(\)\.toLowerCase\(\)/);
    expect(src).not.toMatch(/userData\.user\.email\?\.toLowerCase\(\)/);
  });

  it("module-access Admin mail coerce before toLowerCase", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/module-access/resolve.ts"), "utf8");
    expect(src).toMatch(/typeof mailRaw === "string" \? mailRaw : String\(mailRaw\)/);
    expect(src).not.toMatch(/user\?\.email\?\.toLowerCase\(\)/);
  });

  it("AdminApp session email coerce before toLowerCase", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/AdminApp.tsx"), "utf8");
    expect(src).toMatch(/typeof sessMail === "string" \? sessMail : String\(sessMail\)/);
    expect(src).not.toMatch(/user\.email\?\.toLowerCase\(\)/);
  });

  it("employee-finance-secure errMsg coerces message before trim", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/lib/employee-finance-secure.ts"),
      "utf8",
    );
    expect(src).toMatch(/typeof error\.message === "string"/);
    expect(src).not.toMatch(/error\?\.message\?\.trim\(\)/);
  });
});

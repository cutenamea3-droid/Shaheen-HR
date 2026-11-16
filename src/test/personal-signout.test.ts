import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Personal sign-out hard clear", () => {
  it("scrubs prefixed auth storage and flips authed immediately", () => {
    const secure = readFileSync(resolve(process.cwd(), "src/personal/lib/secure-auth.ts"), "utf8");
    expect(secure).toMatch(/signOut\(\{\s*scope:\s*"local"\s*\}\)/);
    expect(secure).toMatch(/PERSONAL_SB_AUTH_STORAGE_KEY/);
    expect(secure).toMatch(/localStorage\.removeItem/);

    const session = readFileSync(resolve(process.cwd(), "src/personal/lib/session.ts"), "utf8");
    expect(session).toMatch(/authed:\s*false/);

    const workspace = readFileSync(
      resolve(process.cwd(), "src/personal/PersonalWorkspace.tsx"),
      "utf8",
    );
    // Sidebar must not double-call personalSignOut before onLock.
    expect(workspace).toMatch(/Promise\.resolve\(onLock\(\)\)/);
    expect(workspace).not.toMatch(/personalSignOut\(\)\.then\(\(\)\s*=>\s*onLock/);
  });
});

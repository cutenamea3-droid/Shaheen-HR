import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Dispatch UserAdmin invite autofill", () => {
  it("uses onInput + FormData for invite fields", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/UserAdmin.tsx"),
      "utf8",
    );
    expect(src).toMatch(/onInput=\{\(e\) => setDisplayName/);
    expect(src).toMatch(/onInput=\{\(e\) => setEmail/);
    expect(src).toMatch(/onInput=\{\(e\) => setPassword/);
    expect(src).toMatch(/new FormData\(e\.currentTarget\)/);
    expect(src).toMatch(/dispatch-invite-name/);
  });
});

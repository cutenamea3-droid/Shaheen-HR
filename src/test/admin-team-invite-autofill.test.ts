import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Admin TeamManagement invite autofill", () => {
  it("reads name/email via onInput + FormData on submit", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/TeamManagement.tsx"),
      "utf8",
    );
    expect(src).toMatch(/onInput=\{\(e\) => setName/);
    expect(src).toMatch(/onInput=\{\(e\) => setEmail/);
    expect(src).toMatch(/new FormData\(e\.currentTarget\)/);
    expect(src).toMatch(/admin-team-name/);
  });
});

describe("Admin MyAccount password autofill", () => {
  it("mirrors password fields via onInput + FormData", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/MyAccount.tsx"),
      "utf8",
    );
    expect(src).toMatch(/onInput=\{\(e\) => setCurrent/);
    expect(src).toMatch(/onInput=\{\(e\) => setPass/);
    expect(src).toMatch(/new FormData\(e\.currentTarget\)/);
  });
});

describe("Admin Attendance note autofill", () => {
  it("wires onInput for note and half-day reason", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Attendance.tsx"),
      "utf8",
    );
    expect(src).toMatch(/onInput=\{\(ev\) => set\(\{ note:/);
    expect(src).toMatch(/onInput=\{\(ev\) => set\(\{ halfReason:/);
  });
});

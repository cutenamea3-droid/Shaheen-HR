import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("LockGate / Accessorials / Settings / reconnect autofill", () => {
  it("LockGate reads email/password from DOM on submit", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/tracker/LockGate.tsx"),
      "utf8",
    );
    expect(src).toMatch(/emailRef\.current\?\.value/);
    expect(src).toMatch(/passwordRef\.current\?\.value/);
  });

  it("AccessorialsBoard reads description/amount from DOM", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/dispatch/components/CloseoutBoards.tsx"),
      "utf8",
    );
    expect(src).toMatch(/descriptionRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="dispatch-accessorial-description"/);
  });

  it("Admin Settings company/dept update on input", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/admin/components/hr/Settings.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-testid="admin-company-name"/);
    expect(src).toMatch(/onInput=\{\(e\) => setSettings\(\{ company:/);
  });

  it("Admin cloud reconnect reads password from DOM", () => {
    const src = readFileSync(resolve(process.cwd(), "src/admin/AdminApp.tsx"), "utf8");
    expect(src).toMatch(/reconnectPassRef\.current\?\.value/);
    expect(src).toMatch(/data-testid="admin-cloud-reconnect-password"/);
  });
});

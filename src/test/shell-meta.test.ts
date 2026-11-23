import { describe, expect, it } from "vitest";
import { shellMeta } from "@/lib/shell-meta";

describe("shellMeta exhaustive paths", () => {
  it.each([
    ["/", "Compliance Dashboard"],
    ["/drivers", "Driver Cards"],
    ["/alerts", "My Compliance Today"],
    ["/drug-tests", "Drug Test Records"],
    ["/records", "Other Records"],
    ["/account", "My Account"],
    ["/team", "User Accounts"],
    ["/activity", "Activity Logs"],
  ] as const)("%s → %s", (path, title) => {
    expect(shellMeta(path).title).toBe(title);
  });
});

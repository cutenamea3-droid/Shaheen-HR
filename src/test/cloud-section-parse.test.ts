import { describe, expect, it } from "vitest";
import { parseCloudSectionJson } from "@/lib/store";

describe("parseCloudSectionJson", () => {
  it("accepts a normal section payload", () => {
    const raw = JSON.stringify({
      headers: ["Name"],
      widths: [120],
      hidden: [false],
      rows: [{ id: "r1", cells: ["A"] }],
    });
    const sec = parseCloudSectionJson(raw);
    expect(sec?.headers).toEqual(["Name"]);
    expect(sec?.rows).toHaveLength(1);
  });

  it("rejects truncated / invalid JSON without throwing", () => {
    expect(parseCloudSectionJson("{not-json")).toBeUndefined();
    expect(parseCloudSectionJson("null")).toBeUndefined();
    expect(parseCloudSectionJson("[]")).toBeUndefined();
    expect(parseCloudSectionJson(JSON.stringify({ headers: "x" }))).toBeUndefined();
  });
});

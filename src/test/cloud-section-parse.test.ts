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

  it("coerces null cells and drops rows without id", () => {
    const raw = JSON.stringify({
      headers: ["Name", null],
      rows: [
        { id: "r1", driverId: "d1", cells: null },
        { id: "r2", driverId: "d2", cells: ["A", 2] },
        { cells: ["orphan"] },
      ],
    });
    const sec = parseCloudSectionJson(raw);
    expect(sec?.headers).toEqual(["Name", ""]);
    expect(sec?.rows).toHaveLength(2);
    expect(sec?.rows[0].cells).toEqual([]);
    expect(sec?.rows[1].cells).toEqual(["A", "2"]);
  });
});

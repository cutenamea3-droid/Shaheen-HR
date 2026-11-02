import { expect, test } from "vitest";
import { buildSeed, driverKey } from "@/lib/sections";

test("ID numbers in names don't split a driver", () => {
  expect(driverKey("Carlos 498250 Valencia")).toBe(driverKey("Carlos Valencia"));
  expect(driverKey("Mohammad Aimal,s232 Akbary")).toBe(driverKey("Mohammad Aimal Akbary"));
  expect(driverKey("Filip lacob")).toBe(driverKey("Filip S327 Iacob"));
});

test("each driver gets one card", () => {
  const d = buildSeed();
  // Driver Cards only use SECTIONS — record lists (rec_*) keep separate row ids.
  const cardSections = ["dmv", "medical", "queries", "ssccdl", "docs", "info", "inactive"];
  const ids = (n: string) =>
    new Set(
      cardSections.flatMap((id) =>
        (d.sections[id]?.rows ?? [])
          .filter((r) => driverKey(r.cells[0]) === driverKey(n))
          .map((r) => r.driverId),
      ),
    );
  expect(ids("Carlos Valencia").size).toBe(1);
  expect(ids("Scott Edwerd Beavers").size).toBe(1);
});

test("small name typos join one driver, different CDLs never do", async () => {
  const { linkDrivers } = await import("@/lib/sections");
  const sec = (rows: [string, string, string][]) => ({ headers: ["Name", "CDL"], widths: [], hidden: [], rows: rows.map(([id, d, n]) => ({ id, driverId: d, cells: [n, ""] })) });
  const data = {
    version: 1,
    sections: {
      docs: sec([["a", "d1", "Sara Haqi Ismail"]]),
      info: sec([["b", "d2", "Sarah Haqi Ismael"]]),
      ssccdl: { ...sec([]), rows: [
        { id: "c", driverId: "d3", cells: ["Sukhminder Singh", "111111"] },
        { id: "e", driverId: "d4", cells: ["Sukhwinder Singh", "222222"] },
      ] },
    },
  } as never;
  const out = linkDrivers(data).data.sections;
  expect(out.docs.rows[0].driverId).toBe(out.info.rows[0].driverId);
  expect(out.ssccdl.rows[0].driverId).not.toBe(out.ssccdl.rows[1].driverId);
});

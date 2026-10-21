import { BigNumber } from "bignumber.js";
import { describe, expect, it } from "vite-plus/test";
import * as z from "zod/mini";

import { row, workbook, type Worksheet } from "../tests/workbook.ts";
import { parseRsuLotList } from "./parser.ts";

function fixture(): Worksheet[] {
  return workbook([
    row({ 0: "Grant", 1: "EXAMPLE", 11: "G1" }),
    row({ 0: "Vest Schedule", 11: "G1", 18: 1, 19: "20-Sep-2025" }),
    row({
      0: "Sellable Shares",
      11: "G1",
      18: "1",
      32: "10.125",
      35: "12.34567890123456789",
      59: "Yes",
      61: "9/22/2025",
    }),
    row({ 0: "Totals" }),
  ]);
}

function changed(index: number, column: number, value: unknown): Worksheet[] {
  const sheets = fixture();
  // Widened so tests can inject values a real decoder never produces.
  const cells: unknown[] | undefined = sheets[0]?.data[index];
  if (cells === undefined) throw new Error("Invalid fixture row");
  cells[column] = value;
  return sheets;
}

/** Paths of every issue the parser reports; fails if parsing succeeds or throws otherwise. */
function failures(input: unknown): unknown[] {
  try {
    parseRsuLotList(input);
  } catch (error) {
    if (error instanceof z.core.$ZodError) return error.issues.map((issue) => issue.path);
    throw error;
  }
  throw new Error("Expected the workbook to be rejected");
}

const sheet = "Restricted Stock";

describe("RSU parser", () => {
  it("returns only current lots with exact decimals", () => {
    const lots = parseRsuLotList(fixture());
    expect(lots).toHaveLength(1);
    expect(lots[0]).toEqual({
      grantNumber: "G1",
      vestPeriod: "1",
      symbol: "EXAMPLE",
      vestDate: "2025-09-20",
      quantity: new BigNumber("10.125"),
      estimatedCostBasisPerShare: new BigNumber("12.34567890123456789"),
    });
  });
  it("joins grants and vest periods independently of record order", () => {
    const input = fixture();
    const sheet = input[0];
    if (sheet === undefined) throw new Error("Missing fixture sheet");
    sheet.data.splice(
      1,
      sheet.data.length,
      row({ 0: "Sellable Shares", 11: "G2", 18: "2", 32: "3", 35: "40" }),
      row({ 0: "Vest Schedule", 11: "G1", 18: 2, 19: "2026-02-01" }),
      row({ 0: "Grant", 1: "AAA", 11: "G1" }),
      row({ 0: "Vest Schedule", 11: "G2", 18: 1, 19: "2026-03-01" }),
      row({ 0: "Sellable Shares", 11: "G1", 18: "1", 32: "2", 35: "10" }),
      row({ 0: "Grant", 1: "BBB", 11: "G2" }),
      row({ 0: "Vest Schedule", 11: "G2", 18: 2, 19: "2026-04-01" }),
      row({ 0: "Sellable Shares", 11: "G1", 18: "2", 32: "4", 35: "20" }),
      row({ 0: "Vest Schedule", 11: "G1", 18: 1, 19: "2026-01-01" }),
      row({ 0: "Sellable Shares", 11: "G2", 18: "1", 32: "5", 35: "30" }),
    );
    expect(parseRsuLotList(input)).toEqual([
      {
        grantNumber: "G2",
        vestPeriod: "2",
        symbol: "BBB",
        vestDate: "2026-04-01",
        quantity: new BigNumber(3),
        estimatedCostBasisPerShare: new BigNumber(40),
      },
      {
        grantNumber: "G1",
        vestPeriod: "1",
        symbol: "AAA",
        vestDate: "2026-01-01",
        quantity: new BigNumber(2),
        estimatedCostBasisPerShare: new BigNumber(10),
      },
      {
        grantNumber: "G1",
        vestPeriod: "2",
        symbol: "AAA",
        vestDate: "2026-02-01",
        quantity: new BigNumber(4),
        estimatedCostBasisPerShare: new BigNumber(20),
      },
      {
        grantNumber: "G2",
        vestPeriod: "1",
        symbol: "BBB",
        vestDate: "2026-03-01",
        quantity: new BigNumber(5),
        estimatedCostBasisPerShare: new BigNumber(30),
      },
    ]);
  });
  it.each([
    ["0", "10.125", ["10.125"]],
    ["5.25", "10.125", ["5.25"]],
    ["0", "0", []],
    ["0", null, []],
    ["0", "", []],
  ])("resolves held quantity from sellable %s and blocked %s", (sellable, blocked, held) => {
    const input = changed(3, 30, blocked);
    const cells = input[0]?.data[3];
    if (cells === undefined) throw new Error("Missing fixture row");
    cells[32] = sellable;
    expect(parseRsuLotList(input).map((lot) => lot.quantity.toString())).toEqual(held);
  });
  it.each([-1, "junk", "Infinity"])("rejects invalid blocked quantity %s", (value) => {
    expect(failures(changed(3, 30, value))).toEqual([[sheet, 4, "blockedShareQuantity"]]);
  });
  it.each(["2025-09-22", "9/22/2025", new Date("2025-09-22T00:00:00Z")])(
    "normalizes date %s",
    (value) => {
      expect(parseRsuLotList(changed(2, 19, value))[0]?.vestDate).toBe("2025-09-22");
    },
  );
  it("ignores unused release date fields and headers", () => {
    const input = changed(3, 61, "not a date");
    for (const sheet of input) sheet.data[0]?.splice(61);
    expect(parseRsuLotList(input)).toEqual(parseRsuLotList(fixture()));
  });
  it.each([7, "7", "1e2", ".5"])("accepts decimal %s", (value) => {
    expect(parseRsuLotList(changed(3, 32, value))[0]?.quantity.toString()).toBe(
      new BigNumber(value).toString(),
    );
  });
  it.each([null, undefined, "", "junk", "Infinity", Infinity, -1, "0xff", "1e9999999999"])(
    "rejects invalid quantity %s",
    (value) => {
      expect(failures(changed(3, 32, value))).toEqual([[sheet, 4, "sellableQuantity"]]);
    },
  );
  it.each([null, "", "2025-02-30", "30-Feb-2025", "01-XYZ-2025", new Date(NaN)])(
    "rejects invalid date %s",
    (value) => {
      expect(failures(changed(2, 19, value))).toEqual([[sheet, 3, "vestDate"]]);
    },
  );
  it.each([
    [1, 1, null, 2, "symbol"],
    [2, 19, null, 3, "vestDate"],
    [3, 35, null, 4, "estimatedCostBasisPerShare"],
  ] as const)("locates invalid %s on its source row", (row, col, value, sourceRow, field) => {
    expect(failures(changed(row, col, value))).toEqual([[sheet, sourceRow, field]]);
  });
  it.each([
    ["a missing sheet", [], [[sheet, 1, "sheet"]]],
    ["a wrong header", changed(0, 32, "Wrong"), [[sheet, 1, 32]]],
    ["a non-workbook", null, [[]]],
  ])("rejects %s", (_, input, paths) => {
    expect(failures(input)).toEqual(paths);
  });
  it("reports every missing header", () => {
    expect(failures([{ sheet, data: [] }])).toEqual(
      [0, 1, 11, 18, 19, 30, 32, 35].map((column) => [sheet, 1, column]),
    );
  });
  it.each([
    [1, "grantNumber"],
    [2, "vestPeriod"],
  ])("rejects a holding missing related record %s", (index, field) => {
    expect(failures(changed(index, 0, "Ignored"))).toEqual([[sheet, 4, field]]);
  });
  it("ignores other sheets and unrelated records", () => {
    const input = changed(3, 0, "Tax Withholding");
    input.push({ sheet: "Options", data: [["anything"]] });
    expect(parseRsuLotList(input)).toEqual([]);
  });
  it("rejects a repeated grant and vest period", () => {
    const input = fixture();
    const sheet = input[0];
    const holding = sheet?.data[3];
    if (holding === undefined) throw new Error("Missing fixture row");
    sheet?.data.push([...holding]);
    expect(failures(input)).toEqual([["Restricted Stock", 6, "vestPeriod"]]);
  });
  it("rejects non-finite vest identifiers", () => {
    expect(failures(changed(3, 18, Infinity))).toEqual([[sheet, 4, "vestPeriod"]]);
  });
});

import { BigNumber } from "bignumber.js";
import { describe, expect, it } from "vite-plus/test";

import { parseRsuLotList } from "./parser.ts";

function row(values: Record<number, unknown>): unknown[] {
  const cells: unknown[] = Array(63).fill(null);
  for (const [index, value] of Object.entries(values)) cells[Number(index)] = value;
  return cells;
}

function workbook(): { sheet: string; data: unknown[][] }[] {
  const headers: unknown[] = Array(63).fill(null);
  for (const [index, name] of [
    [0, "Record Type"],
    [1, "Symbol"],
    [11, "Grant Number"],
    [18, "Vest Period"],
    [19, "Vest Date"],
    [30, "Blocked Share Qty."],
    [32, "Sellable Qty."],
    [35, "Est. Cost Basis (per share):"],
    [61, "Release Date"],
  ] as const)
    headers[index] = name;
  return [
    {
      sheet: "Restricted Stock",
      data: [
        headers,
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
      ],
    },
  ];
}

function changed(row: number, column: number, value: unknown): ReturnType<typeof workbook> {
  const sheets = workbook();
  const cells = sheets[0]?.data[row];
  if (cells === undefined) throw new Error("Invalid fixture row");
  cells[column] = value;
  return sheets;
}

describe("RSU parser", () => {
  it("returns only current lots, retains blocked lots and exact decimals", () => {
    const lots = parseRsuLotList(workbook());
    expect(lots).toHaveLength(1);
    expect(lots[0]).toEqual({
      grantNumber: "G1",
      vestPeriod: "1",
      symbol: "EXAMPLE",
      vestDate: "2025-09-20",
      blocked: false,
      quantity: new BigNumber("10.125"),
      estimatedCostBasisPerShare: new BigNumber("12.34567890123456789"),
    });
  });
  it("joins grants and vest periods independently of record order", () => {
    const input = workbook();
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
        blocked: false,
        quantity: new BigNumber(3),
        estimatedCostBasisPerShare: new BigNumber(40),
      },
      {
        grantNumber: "G1",
        vestPeriod: "1",
        symbol: "AAA",
        vestDate: "2026-01-01",
        blocked: false,
        quantity: new BigNumber(2),
        estimatedCostBasisPerShare: new BigNumber(10),
      },
      {
        grantNumber: "G1",
        vestPeriod: "2",
        symbol: "AAA",
        vestDate: "2026-02-01",
        blocked: false,
        quantity: new BigNumber(4),
        estimatedCostBasisPerShare: new BigNumber(20),
      },
      {
        grantNumber: "G2",
        vestPeriod: "1",
        symbol: "BBB",
        vestDate: "2026-03-01",
        blocked: false,
        quantity: new BigNumber(5),
        estimatedCostBasisPerShare: new BigNumber(30),
      },
    ]);
  });
  it.each([
    ["0", "10.125", "10.125", true],
    ["5.25", "10.125", "5.25", false],
    ["0", "0", "0", true],
    ["0", null, "0", true],
    ["0", "", "0", true],
  ])(
    "resolves held quantity from sellable %s and blocked %s",
    (sellable, blocked, held, isBlocked) => {
      const input = changed(3, 30, blocked);
      const cells = input[0]?.data[3];
      if (cells === undefined) throw new Error("Missing fixture row");
      cells[32] = sellable;
      const lot = parseRsuLotList(input)[0];
      if (lot === undefined) throw new Error("Missing parsed lot");
      expect(lot.quantity.toString()).toBe(held);
      expect(lot.blocked).toBe(isBlocked);
    },
  );
  it.each([-1, "junk", "Infinity"])("rejects invalid blocked quantity %s", (value) => {
    expect(() => parseRsuLotList(changed(3, 30, value))).toThrow();
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
    expect(parseRsuLotList(input)).toEqual(parseRsuLotList(workbook()));
  });
  it.each([0, "0", "1e2", ".5"])("accepts decimal %s", (value) => {
    expect(parseRsuLotList(changed(3, 32, value))[0]?.quantity.toString()).toBe(
      new BigNumber(value).toString(),
    );
  });
  it.each([null, undefined, "", "junk", "Infinity", Infinity, -1, "0xff", "1e9999999999"])(
    "rejects invalid quantity %s",
    (value) => {
      expect(() => parseRsuLotList(changed(3, 32, value))).toThrow();
    },
  );
  it.each([null, "", "2025-02-30", "30-Feb-2025", "01-XYZ-2025", new Date(NaN)])(
    "rejects invalid date %s",
    (value) => {
      expect(() => parseRsuLotList(changed(2, 19, value))).toThrow();
    },
  );
  it.each([
    [1, 1, null, 2, "symbol"],
    [2, 19, null, 3, "vestDate"],
    [3, 35, null, 4, "estimatedCostBasisPerShare"],
  ] as const)("locates invalid field", (row, col, value, sourceRow, field) => {
    expect.assertions(1);
    try {
      parseRsuLotList(changed(row, col, value));
    } catch (error) {
      expect(error).toHaveProperty("issues.0.path", ["Restricted Stock", sourceRow, field]);
    }
  });
  it("rejects absent or malformed sheets and headers", () => {
    for (const input of [
      [],
      [{ sheet: "Restricted Stock", data: [] }],
      changed(0, 32, "Wrong"),
      null,
    ])
      expect(() => parseRsuLotList(input)).toThrow();
  });
  it.each([1, 2])("rejects missing related records %s", (index) => {
    expect(() => parseRsuLotList(changed(index, 0, "Ignored"))).toThrow();
  });
  it("ignores other sheets and unrelated records", () => {
    const input = changed(3, 0, "Tax Withholding");
    input.push({ sheet: "Options", data: [["anything"]] });
    expect(parseRsuLotList(input)).toEqual([]);
  });
  it("rejects non-finite vest identifiers", () => {
    expect(() => parseRsuLotList(changed(3, 18, Infinity))).toThrow();
  });
});

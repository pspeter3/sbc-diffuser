import { BigNumber } from "bignumber.js";
import { describe, expect, it } from "vite-plus/test";

import { parseRsuLotList } from "./parser.ts";

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
  const row = (values: Record<number, unknown>): unknown[] => {
    const cells: unknown[] = Array(63).fill(null);
    for (const [index, value] of Object.entries(values)) cells[Number(index)] = value;
    return cells;
  };
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
  if (!cells) throw new Error("Invalid fixture row");
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
      releaseDate: "2025-09-22",
      quantity: new BigNumber("10.125"),
      estimatedCostBasisPerShare: new BigNumber("12.34567890123456789"),
    });
  });
  it.each([
    ["0", "10.125", "10.125"],
    ["5.25", "10.125", "5.25"],
    ["0", "0", "0"],
    ["0", null, "0"],
    ["0", "", "0"],
  ])("resolves held quantity from sellable %s and blocked %s", (sellable, blocked, held) => {
    const input = changed(3, 30, blocked);
    const cells = input[0]?.data[3];
    if (!cells) throw new Error("Missing fixture row");
    cells[32] = sellable;
    const lot = parseRsuLotList(input)[0];
    if (!lot) throw new Error("Missing parsed lot");
    expect(lot.quantity.toString()).toBe(held);
  });
  it.each([-1, "junk", "Infinity"])("rejects invalid blocked quantity %s", (value) => {
    expect(() => parseRsuLotList(changed(3, 30, value))).toThrow();
  });
  it.each(["2025-09-22", new Date("2025-09-22T00:00:00Z")])("normalizes date %s", (value) => {
    expect(parseRsuLotList(changed(3, 61, value))[0]?.releaseDate).toBe("2025-09-22");
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
      expect(() => parseRsuLotList(changed(3, 61, value))).toThrow();
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

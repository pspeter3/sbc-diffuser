import { BigNumber } from "bignumber.js";
import * as z from "zod/mini";

import {
  grantNumberSchema,
  isoDateSchema,
  type RsuLot,
  type RsuLotList,
  vestPeriodSchema,
} from "./schema.ts";
const amountSchema = z
  .instanceof(BigNumber)
  .check(z.refine((value) => value.isFinite() && !value.isNegative()));

const rsuLotSchema = z.object({
  grantNumber: grantNumberSchema,
  vestPeriod: vestPeriodSchema,
  symbol: z.string().check(z.minLength(1)),
  vestDate: isoDateSchema,
  sellableQuantity: amountSchema,
  blockedShareQuantity: z.nullable(amountSchema),
  estimatedCostBasisPerShare: amountSchema,
});

const sheetName = "Restricted Stock";
// Repeated column labels make their positions significant in this export.
const columns = {
  recordType: { index: 0, label: "Record Type" },
  symbol: { index: 1, label: "Symbol" },
  grantNumber: { index: 11, label: "Grant Number" },
  vestPeriod: { index: 18, label: "Vest Period" },
  vestDate: { index: 19, label: "Vest Date" },
  blockedQuantity: { index: 30, label: "Blocked Share Qty." },
  sellableQuantity: { index: 32, label: "Sellable Qty." },
  costBasis: { index: 35, label: "Est. Cost Basis (per share):" },
} as const;

const inputSchema = z.array(z.object({ sheet: z.string(), data: z.array(z.array(z.unknown())) }));

function text(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function period(value: unknown): unknown {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : text(value);
}

function decimal(value: unknown): unknown {
  if (typeof value !== "string" && typeof value !== "number") return value;
  const trimmed = String(value).trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)
    ? new BigNumber(trimmed)
    : value;
}

function date(value: unknown): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? value : value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const named = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(trimmed);
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (named !== null) {
    const month =
      ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(
        String(named[2]).toUpperCase(),
      ) + 1;
    return `${named[3]}-${String(month).padStart(2, "0")}-${String(named[1]).padStart(2, "0")}`;
  }
  if (slash !== null)
    return `${slash[3]}-${String(slash[1]).padStart(2, "0")}-${String(slash[2]).padStart(2, "0")}`;
  return trimmed;
}

const parser = z.pipe(
  inputSchema,
  z.transform((sheets, context): RsuLotList => {
    const issues = context.issues;
    const fail = (row: number, field: string | number, message: string): void => {
      issues.push({ code: "custom", input: sheets, path: [sheetName, row, field], message });
    };
    const sheet = sheets.find((sheet) => sheet.sheet === sheetName);
    if (sheet === undefined) {
      fail(1, "sheet", "Missing Restricted Stock worksheet");
      return [];
    }
    for (const { index, label } of Object.values(columns)) {
      if (sheet.data[0]?.[index] !== label) fail(1, index, `Expected column ${label}`);
    }
    if (issues.length > 0) return [];

    const rows = sheet.data.slice(1).map((cells, index) => ({
      row: index + 2,
      cell: (column: keyof typeof columns): unknown => cells[columns[column].index],
    }));
    const grants = new Map<unknown, (typeof rows)[number]>();
    const vests = new Map<string, (typeof rows)[number]>();
    const holdings: typeof rows = [];
    for (const entry of rows) {
      const grantNumber = text(entry.cell("grantNumber"));
      const recordType = entry.cell("recordType");
      if (recordType === "Grant") grants.set(grantNumber, entry);
      else if (recordType === "Vest Schedule")
        vests.set(JSON.stringify([grantNumber, period(entry.cell("vestPeriod"))]), entry);
      else if (recordType === "Sellable Shares") holdings.push(entry);
    }

    const lots: RsuLot[] = [];
    for (const { cell, row } of holdings) {
      const grantNumber = text(cell("grantNumber"));
      const vestPeriod = period(cell("vestPeriod"));
      const grant = grants.get(grantNumber);
      const vest = vests.get(JSON.stringify([grantNumber, vestPeriod]));
      if (grant === undefined) fail(row, "grantNumber", "Missing matching grant");
      if (vest === undefined) fail(row, "vestPeriod", "Missing matching vest schedule");
      if (grant === undefined || vest === undefined) continue;
      const blocked = cell("blockedQuantity");
      const result = rsuLotSchema.safeParse({
        grantNumber,
        vestPeriod,
        symbol: text(grant.cell("symbol")),
        vestDate: date(vest.cell("vestDate")),
        sellableQuantity: decimal(cell("sellableQuantity")),
        blockedShareQuantity: blocked == null || text(blocked) === "" ? null : decimal(blocked),
        estimatedCostBasisPerShare: decimal(cell("costBasis")),
      });
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = String(issue.path[0]);
          const sourceRow = field === "symbol" ? grant.row : field === "vestDate" ? vest.row : row;
          fail(sourceRow, field, issue.message);
        }
        continue;
      }
      const quantity = result.data.sellableQuantity.isGreaterThan(0)
        ? result.data.sellableQuantity
        : result.data.blockedShareQuantity;
      if (quantity === null || quantity.isZero()) continue;
      lots.push({
        grantNumber: result.data.grantNumber,
        vestPeriod: result.data.vestPeriod,
        symbol: result.data.symbol,
        vestDate: result.data.vestDate,
        estimatedCostBasisPerShare: result.data.estimatedCostBasisPerShare,
        quantity,
      });
    }
    return lots;
  }),
);

/**
 * Accepts decoded worksheets: [{ sheet: "Restricted Stock", data: [headers, ...rows] }].
 * Returns held Sellable Shares records in source order, counting blocked shares as held
 * and skipping records without any held shares.
 * Throws a Zod error for invalid input.
 * Issue paths identify the worksheet, one-based row, and field or column.
 */
export function parseRsuLotList(workbook: unknown): RsuLotList {
  return parser.parse(workbook);
}

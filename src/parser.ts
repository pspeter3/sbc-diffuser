import { BigNumber } from "bignumber.js";
import * as z from "zod/mini";

import {
  type GrantNumber,
  type IsoDate,
  type RsuLot,
  type RsuLotList,
  type VestPeriod,
} from "./schema.ts";

const grantNumberSchema = z.custom<GrantNumber>(
  (value) => typeof value === "string" && value.length > 0,
);
const vestPeriodSchema = z.custom<VestPeriod>(
  (value) => typeof value === "string" && value.length > 0,
);
const isoDateSchema = z.custom<IsoDate>((value) => z.iso.date().safeParse(value).success);
const amountSchema = z
  .instanceof(BigNumber)
  .check(z.refine((value) => value.isFinite() && !value.isNegative()));

const rsuLotSchema = z.object({
  grantNumber: grantNumberSchema,
  vestPeriod: vestPeriodSchema,
  symbol: z.string().check(z.minLength(1)),
  vestDate: isoDateSchema,
  releaseDate: isoDateSchema,
  sellableQuantity: amountSchema,
  blockedShareQuantity: z.nullable(amountSchema),
  estimatedCostBasisPerShare: amountSchema,
});

const sheetName = "Restricted Stock";
// Repeated column labels make their positions significant in this export.
const columns = new Map<number, string>([
  [0, "Record Type"],
  [1, "Symbol"],
  [11, "Grant Number"],
  [18, "Vest Period"],
  [19, "Vest Date"],
  [30, "Blocked Share Qty."],
  [32, "Sellable Qty."],
  [35, "Est. Cost Basis (per share):"],
  [61, "Release Date"],
]);

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
  if (named) {
    const month =
      ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(
        String(named[2]).toUpperCase(),
      ) + 1;
    return `${named[3]}-${String(month).padStart(2, "0")}-${String(named[1]).padStart(2, "0")}`;
  }
  if (slash)
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
    const matches = sheets.filter((sheet) => sheet.sheet === sheetName);
    const sheet = matches[0];
    if (matches.length !== 1 || !sheet) {
      fail(1, "sheet", "Expected exactly one Restricted Stock worksheet");
      return [];
    }
    for (const [index, label] of columns) {
      if (sheet.data[0]?.[index] !== label) fail(1, index, `Expected column ${label}`);
    }
    if (issues.length) return [];

    const rows = sheet.data.slice(1).map((cells, index) => ({ cells, row: index + 2 }));
    const lots: RsuLot[] = [];
    const seen = new Set<string>();
    for (const { cells, row } of rows) {
      if (cells[0] !== "Sellable Shares") continue;
      const grantNumber = text(cells[11]);
      const vestPeriod = period(cells[18]);
      const grants = rows.filter(
        (entry) => entry.cells[0] === "Grant" && text(entry.cells[11]) === grantNumber,
      );
      const vests = rows.filter(
        (entry) =>
          entry.cells[0] === "Vest Schedule" &&
          text(entry.cells[11]) === grantNumber &&
          period(entry.cells[18]) === vestPeriod,
      );
      const grant = grants[0];
      const vest = vests[0];
      if (grants.length !== 1 || !grant)
        fail(row, "grantNumber", "Expected exactly one matching grant");
      if (vests.length !== 1 || !vest)
        fail(row, "vestPeriod", "Expected exactly one matching vest schedule");
      if (!grant || !vest) continue;
      const result = rsuLotSchema.safeParse({
        grantNumber,
        vestPeriod,
        symbol: text(grant.cells[1]),
        vestDate: date(vest.cells[19]),
        releaseDate: date(cells[61]),
        sellableQuantity: decimal(cells[32]),
        blockedShareQuantity:
          cells[30] == null || text(cells[30]) === "" ? null : decimal(cells[30]),
        estimatedCostBasisPerShare: decimal(cells[35]),
      });
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = String(issue.path[0]);
          const sourceRow = field === "symbol" ? grant.row : field === "vestDate" ? vest.row : row;
          fail(sourceRow, field, issue.message);
        }
        continue;
      }
      const key = JSON.stringify([result.data.grantNumber, result.data.vestPeriod]);
      if (seen.has(key)) fail(row, "vestPeriod", "Duplicate RSU lot for grant and vest period");
      seen.add(key);
      lots.push({
        grantNumber: result.data.grantNumber,
        vestPeriod: result.data.vestPeriod,
        symbol: result.data.symbol,
        vestDate: result.data.vestDate,
        releaseDate: result.data.releaseDate,
        estimatedCostBasisPerShare: result.data.estimatedCostBasisPerShare,
        quantity: result.data.sellableQuantity.isGreaterThan(0)
          ? result.data.sellableQuantity
          : (result.data.blockedShareQuantity ?? result.data.sellableQuantity),
      });
    }
    return lots;
  }),
);

/**
 * Accepts decoded worksheets: [{ sheet: "Restricted Stock", data: [headers, ...rows] }].
 * Returns only Sellable Shares records, in source order, including blocked lots.
 * Throws a Zod error for invalid input.
 * Issue paths identify the worksheet, one-based row, and field or column.
 */
export function parseRsuLotList(workbook: unknown): RsuLotList {
  return parser.parse(workbook);
}

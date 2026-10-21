type Cell = string | number | boolean | null;
export interface Worksheet {
  sheet: string;
  data: Cell[][];
}

const width = 63;
const headers: Record<number, string> = {
  0: "Record Type",
  1: "Symbol",
  11: "Grant Number",
  18: "Vest Period",
  19: "Vest Date",
  30: "Blocked Share Qty.",
  32: "Sellable Qty.",
  35: "Est. Cost Basis (per share):",
  61: "Release Date",
};

/** A worksheet row with the given cells set by column index and the rest empty. */
export function row(values: Record<number, Cell>): Cell[] {
  const cells: Cell[] = Array<Cell>(width).fill(null);
  for (const [index, value] of Object.entries(values)) cells[Number(index)] = value;
  return cells;
}

/** The grant, vest schedule, and sellable shares records for one holding. */
export function holding({
  symbol = "TEST",
  grant = "grant-1",
  period = "1",
  vestDate = "2026-09-01",
  sellable = "10",
  basis = "25",
}: {
  symbol?: string;
  grant?: string;
  period?: string;
  vestDate?: string;
  sellable?: string;
  basis?: string;
} = {}): Cell[][] {
  return [
    row({ 0: "Grant", 1: symbol, 11: grant }),
    row({ 0: "Vest Schedule", 11: grant, 18: period, 19: vestDate }),
    row({ 0: "Sellable Shares", 11: grant, 18: period, 32: sellable, 35: basis }),
  ];
}

/** A decoded E*TRADE workbook whose Restricted Stock sheet holds the given rows. */
export function workbook(rows: Cell[][] = holding()): Worksheet[] {
  return [{ sheet: "Restricted Stock", data: [row(headers), ...rows] }];
}

import { BigNumber } from "bignumber.js";

import { type Parameters } from "../src/planner.ts";
import { grantNumberSchema, isoDateSchema, type RsuLot, vestPeriodSchema } from "../src/schema.ts";

let sequence = 0;

/** Builds a lot; each call gets its own vest period unless one is given. */
export function lot({
  symbol = "AAA",
  vestDate = "2026-01-01",
  basis = "10",
  quantity = "10",
  grant = "1",
  period = `auto-${String((sequence += 1))}`,
}: {
  symbol?: string;
  vestDate?: string;
  basis?: string;
  quantity?: string;
  grant?: string;
  period?: string;
} = {}): RsuLot {
  return {
    symbol,
    vestDate: isoDateSchema.parse(vestDate),
    grantNumber: grantNumberSchema.parse(grant),
    vestPeriod: vestPeriodSchema.parse(period),
    estimatedCostBasisPerShare: new BigNumber(basis),
    quantity: new BigNumber(quantity),
  };
}

export function parameters(target = "50", wealth = "0", saleDate = "2099-12-31"): Parameters {
  return {
    prices: new Map([
      ["AAA", new BigNumber(20)],
      ["BBB", new BigNumber(40)],
    ]),
    wealth: new BigNumber(wealth),
    target: new BigNumber(target),
    saleDate: isoDateSchema.parse(saleDate),
  };
}

import { BigNumber } from "bignumber.js";

import { type Parameters } from "../src/planner.ts";
import { grantNumberSchema, isoDateSchema, type RsuLot, vestPeriodSchema } from "../src/schema.ts";

export function lot(
  symbol = "AAA",
  date = "2026-01-01",
  basis = "10",
  quantity = "10",
  grant = "1",
  period = "1",
): RsuLot {
  return {
    symbol,
    vestDate: isoDateSchema.parse(date),
    grantNumber: grantNumberSchema.parse(grant),
    vestPeriod: vestPeriodSchema.parse(period),
    estimatedCostBasisPerShare: new BigNumber(basis),
    quantity: new BigNumber(quantity),
  };
}
export function parameters(target = "50", wealth = "0"): Parameters {
  return {
    prices: new Map([
      ["AAA", new BigNumber(20)],
      ["BBB", new BigNumber(40)],
    ]),
    wealth: new BigNumber(wealth),
    target: new BigNumber(target),
  };
}

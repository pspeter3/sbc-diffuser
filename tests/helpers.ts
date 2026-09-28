import { BigNumber } from "bignumber.js";
import * as z from "zod/mini";

import { type Parameters } from "../src/planner.ts";
import { type RsuLot } from "../src/schema.ts";
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
    vestDate: z.custom<RsuLot["vestDate"]>((v) => z.iso.date().safeParse(v).success).parse(date),
    releaseDate: z
      .custom<RsuLot["releaseDate"]>((v) => z.iso.date().safeParse(v).success)
      .parse(date),
    grantNumber: z.custom<RsuLot["grantNumber"]>((v) => typeof v === "string").parse(grant),
    vestPeriod: z.custom<RsuLot["vestPeriod"]>((v) => typeof v === "string").parse(period),
    estimatedCostBasisPerShare: new BigNumber(basis),
    quantity: new BigNumber(quantity),
    blocked: false,
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

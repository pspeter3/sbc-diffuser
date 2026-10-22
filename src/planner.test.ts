import { describe, expect, it } from "vite-plus/test";

import { lot, parameters } from "../tests/helpers.ts";
import { availableLots, priceFor, recommend, summarize } from "./planner.ts";
import { lotKey, type RsuLot } from "./schema.ts";

function keys(...lots: RsuLot[]): Set<string> {
  return new Set(lots.map(lotKey));
}

describe("planning", (): void => {
  it("requires a price for every symbol", (): void => {
    expect(() => priceFor(parameters(), "missing")).toThrow("Missing stock price");
  });
  it("ranks weighted vest-date groups across grants and prices symbols independently", (): void => {
    const expensive = lot({ vestDate: "2026-01-01", basis: "30", quantity: "1" });
    const free = lot({ symbol: "BBB", vestDate: "2026-01-01", basis: "0", quantity: "9" });
    const cheap = lot({ vestDate: "2026-02-01", basis: "5", quantity: "10" });
    const lots = [expensive, free, cheap];
    expect(recommend(lots, parameters("80"))).toEqual(keys(cheap));
    expect(recommend(lots, parameters("0"))).toEqual(keys(cheap, expensive, free));
    expect(recommend(lots, parameters("100"))).toEqual(keys());
    const summary = summarize(lots, parameters(), keys(free));
    expect(summary.portfolio.total.value.toFixed()).toBe("580");
    expect(summary.sale.total.value.toFixed()).toBe("360");
    expect(summary.sale.total.basis.toFixed()).toBe("0");
    expect(summary.sale.total.shares.toFixed()).toBe("9");
    expect(summary.sale.total.gain.toFixed()).toBe("360");
    expect(summary.minimumSale.toFixed()).toBe("290");
    expect(summary.finalConcentration.toFixed(2)).toBe("37.93");
  });
  it("breaks basis ties by date, overshoots whole groups, and handles empty holdings", (): void => {
    const later = lot({ vestDate: "2026-02-01" });
    const earlier = lot();
    const otherGrant = lot({ grant: "2" });
    const lots = [later, earlier, otherGrant];
    expect(recommend(lots, parameters("90"))).toEqual(keys(earlier, otherGrant));
    expect(recommend([], parameters()).size).toBe(0);
    expect(summarize([], parameters(), new Set()).finalConcentration.toFixed()).toBe("0");
    expect(summarize([], parameters(), new Set()).currentConcentration.toFixed()).toBe("0");
    expect(recommend(lots, parameters("50", "10000")).size).toBe(0);
  });
  it("only holds and sells lots vested by the sale date", (): void => {
    const vested = lot({ vestDate: "2026-01-01", basis: "30" });
    const onSaleDate = lot({ vestDate: "2026-03-01", basis: "20" });
    const unvested = lot({ vestDate: "2026-03-02", basis: "0" });
    const lots = [vested, onSaleDate, unvested];
    const configured = parameters("0", "0", "2026-03-01");
    expect(availableLots(lots, configured.saleDate)).toEqual([vested, onSaleDate]);
    expect(recommend(lots, configured)).toEqual(keys(vested, onSaleDate));
    const summary = summarize(lots, configured, keys(onSaleDate, unvested));
    expect(summary.portfolio.total.lots).toBe(2);
    expect(summary.sale.total.lots).toBe(1);
    expect(summary.finalConcentration.toFixed()).toBe("50");
  });
});

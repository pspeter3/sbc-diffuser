import { describe, expect, it } from "vite-plus/test";

import { lot, parameters } from "../tests/helpers.ts";
import { decimalInput, priceFor, recommend, summarize } from "./planner.ts";
import { lotKey, type RsuLot } from "./schema.ts";

function keys(...lots: RsuLot[]): Set<string> {
  return new Set(lots.map(lotKey));
}

describe("planning", (): void => {
  it("validates decimal fields", (): void => {
    for (const value of ["", "-1", "NaN", "Infinity", "1e2", "1.2.3"])
      expect(decimalInput(value)).toBeNull();
    expect(decimalInput("101", 100)).toBeNull();
    expect(decimalInput("100", 100)?.toFixed()).toBe("100");
    expect(decimalInput("0.01")?.toFixed()).toBe("0.01");
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
    expect(summary.value.toFixed()).toBe("580");
    expect(summary.proceeds.toFixed()).toBe("360");
    expect(summary.basis.toFixed()).toBe("0");
    expect(summary.selectedShares.toFixed()).toBe("9");
    expect(summary.gain.toFixed()).toBe("360");
    expect(summary.minimum.toFixed()).toBe("290");
    expect(summary.ending.toFixed(2)).toBe("37.93");
  });
  it("breaks basis ties by date, overshoots whole groups, and handles empty holdings", (): void => {
    const later = lot({ vestDate: "2026-02-01" });
    const earlier = lot();
    const otherGrant = lot({ grant: "2" });
    const lots = [later, earlier, otherGrant];
    expect(recommend(lots, parameters("90"))).toEqual(keys(earlier, otherGrant));
    expect(recommend([], parameters()).size).toBe(0);
    expect(summarize([], parameters(), new Set()).ending.toFixed()).toBe("0");
    expect(summarize([], parameters(), new Set()).current.toFixed()).toBe("0");
    expect(recommend(lots, parameters("50", "10000")).size).toBe(0);
  });
});

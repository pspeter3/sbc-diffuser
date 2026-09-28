import { describe, expect, it } from "vite-plus/test";

import { lot, parameters } from "../tests/helpers.ts";
import { decimalInput, priceFor, recommend, summarize } from "./planner.ts";

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
    const lots = [
      lot("AAA", "2026-01-01", "30", "1"),
      lot("BBB", "2026-01-01", "0", "9", "2"),
      lot("AAA", "2026-02-01", "5", "10"),
    ];
    expect([...recommend(lots, parameters("80"))]).toEqual([2]);
    expect([...recommend(lots, parameters("0"))]).toEqual([2, 0, 1]);
    expect([...recommend(lots, parameters("100"))]).toEqual([]);
    const summary = summarize(lots, parameters(), new Set([1]));
    expect(summary.value.toFixed()).toBe("580");
    expect(summary.proceeds.toFixed()).toBe("360");
    expect(summary.basis.toFixed()).toBe("0");
    expect(summary.remainingShares.toFixed()).toBe("11");
    expect(summary.gain.toFixed()).toBe("360");
    expect(summary.meetsTarget).toBe(true);
    expect(summarize(lots, parameters(), new Set()).meetsTarget).toBe(false);
  });
  it("breaks basis ties by date, overshoots whole groups, and handles empty holdings", (): void => {
    const lots = [lot("AAA", "2026-02-01"), lot(), lot("AAA", "2026-01-01", "10", "10", "2")];
    expect([...recommend(lots, parameters("90"))]).toEqual([1, 2]);
    expect(recommend([], parameters()).size).toBe(0);
    expect(summarize([], parameters(), new Set()).ending.toFixed()).toBe("0");
    expect(summarize([], parameters(), new Set()).current.toFixed()).toBe("0");
    expect(recommend(lots, parameters("50", "10000")).size).toBe(0);
  });
});

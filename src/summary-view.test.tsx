import { render, screen } from "@testing-library/preact";
import { expect, it } from "vite-plus/test";

import { lot, parameters } from "../tests/helpers.ts";
import { cells, column, definitions } from "../tests/table.ts";
import { summarize } from "./planner.ts";
import { lotKey } from "./schema.ts";
import { PortfolioSummary, SaleSummary } from "./summary-view.tsx";

const sold = lot({ symbol: "BBB", quantity: "5" });
const kept = lot({ vestDate: "2026-01-02" });
const partial = lot({ vestDate: "2026-01-03", basis: "5", quantity: "2" });
const lots = [sold, kept, partial];
const configured = parameters("50", "100");

function region(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

it("summarizes every held lot by symbol", (): void => {
  render(
    <PortfolioSummary
      summary={summarize(lots, configured, new Set([lotKey(sold), lotKey(partial)]))}
    />,
  );
  expect(cells(region("Portfolio summary"))).toEqual([
    ["Symbol", "Lots", "Shares", "Value"],
    ["AAA", "2", "12", "$240.00"],
    ["BBB", "1", "5", "$200.00"],
    ["Total", "3", "17", "$440.00"],
  ]);
  expect(definitions(region("Portfolio summary"))).toEqual({
    "Total Wealth": "$540.00",
    "Current Concentration": "81.48%",
  });
});

it("summarizes only selected lots in the sale", (): void => {
  render(
    <SaleSummary summary={summarize(lots, configured, new Set([lotKey(sold), lotKey(partial)]))} />,
  );
  expect(cells(region("Sale summary"))).toEqual([
    ["Symbol", "Lots", "Shares", "Proceeds", "Basis", "Gain"],
    ["AAA", "1", "2", "$40.00", "$10.00", "$30.00"],
    ["BBB", "1", "5", "$200.00", "$50.00", "$150.00"],
    ["Total", "2", "7", "$240.00", "$60.00", "$180.00"],
  ]);
  expect(definitions(region("Sale summary"))).toEqual({
    "Minimum Sale": "$170.00",
    "Final Concentration": "37.04%",
  });
});

it.each([
  ["Portfolio summary", PortfolioSummary, ["Total", "0", "0", "$0.00"]],
  ["Sale summary", SaleSummary, ["Total", "0", "0", "$0.00", "$0.00", "$0.00"]],
])("shows zero totals in an empty %s", (name, Summary, total): void => {
  render(<Summary summary={summarize([], configured, new Set())} />);
  expect(cells(region(name)).slice(1)).toEqual([total]);
});

it("colors gains and losses while leaving zero neutral", (): void => {
  const gain = lot({ quantity: "1" });
  const loss = lot({ symbol: "BBB", basis: "50", quantity: "1" });
  render(
    <SaleSummary
      summary={summarize([gain, loss], parameters(), new Set([lotKey(gain), lotKey(loss)]))}
    />,
  );
  const tones = column(region("Sale summary"), "Gain").map((cell) => [
    cell.textContent,
    cell.classList.contains("gain-positive"),
    cell.classList.contains("gain-negative"),
  ]);
  expect(tones).toEqual([
    ["$10.00", true, false],
    ["-$10.00", false, true],
    ["$0.00", false, false],
  ]);
});

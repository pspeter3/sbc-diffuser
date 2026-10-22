import { type BigNumber } from "bignumber.js";
import { type JSX } from "preact";

import { formatUsd } from "./format.ts";
import { type Breakdown, type Summary, type Totals } from "./planner.ts";

interface Column {
  heading: string;
  text: (totals: Totals) => string;
  className?: (totals: Totals) => string;
}

function gainCellClass(gain: Readonly<BigNumber>): string {
  if (gain.gt(0)) return "numeric-cell gain-positive";
  if (gain.lt(0)) return "numeric-cell gain-negative";
  return "numeric-cell";
}

function usd(heading: string, amount: (totals: Totals) => BigNumber): Column {
  return { heading, text: (totals) => formatUsd(amount(totals)) };
}

const lots: Column = { heading: "Lots", text: (totals) => String(totals.lots) };
const shares: Column = { heading: "Shares", text: (totals) => totals.shares.toFixed() };
const gain: Column = {
  ...usd("Gain", (totals) => totals.gain),
  className: (totals) => gainCellClass(totals.gain),
};

function SummaryTable({
  label,
  details,
  columns,
  breakdown,
}: {
  label: string;
  details: ReadonlyArray<readonly [string, string]>;
  columns: ReadonlyArray<Column>;
  breakdown: Breakdown;
}): JSX.Element {
  const symbols = [...breakdown.bySymbol].sort(([a], [b]) => a.localeCompare(b));
  const cells = (totals: Totals): JSX.Element[] =>
    columns.map((column) => (
      <td key={column.heading} class={column.className?.(totals) ?? "numeric-cell"}>
        {column.text(totals)}
      </td>
    ));
  return (
    <section class="overflow-auto" aria-label={label}>
      <table class="summary-table">
        <caption>
          <dl class="grid">
            {details.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </caption>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            {columns.map((column) => (
              <th key={column.heading} scope="col" class="numeric-cell">
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map(([symbol, totals]) => (
            <tr key={symbol}>
              <th scope="row">{symbol}</th>
              {cells(totals)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {cells(breakdown.total)}
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

export function PortfolioSummary({ summary }: { summary: Summary }): JSX.Element {
  return (
    <SummaryTable
      label="Portfolio summary"
      details={[
        ["Total Wealth", formatUsd(summary.wealth)],
        ["Current Concentration", `${summary.currentConcentration.toFixed(2)}%`],
      ]}
      columns={[lots, shares, usd("Value", (totals) => totals.value)]}
      breakdown={summary.portfolio}
    />
  );
}

export function SaleSummary({ summary }: { summary: Summary }): JSX.Element {
  return (
    <SummaryTable
      label="Sale summary"
      details={[
        ["Minimum Sale", formatUsd(summary.minimumSale)],
        ["Final Concentration", `${summary.finalConcentration.toFixed(2)}%`],
      ]}
      columns={[
        lots,
        shares,
        usd("Proceeds", (totals) => totals.value),
        usd("Basis", (totals) => totals.basis),
        gain,
      ]}
      breakdown={summary.sale}
    />
  );
}

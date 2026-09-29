import { type JSX } from "preact";

import { formatUsd } from "./format.ts";
import { type Parameters, summarize } from "./planner.ts";
import { type RsuLotList } from "./schema.ts";

const headings = [
  "Symbol",
  "Held",
  "Value",
  "Lots",
  "Sell",
  "Proceeds",
  "Basis",
  "Gain",
  "Left",
  "Balance",
];

export function SummaryView({
  lots,
  parameters,
  selected,
}: {
  lots: RsuLotList;
  parameters: Parameters | null;
  selected: ReadonlySet<number>;
}): JSX.Element | null {
  if (parameters === null) return null;
  const summary = summarize(lots, parameters, selected);
  const symbols = [...summary.bySymbol].sort(([a], [b]) => a.localeCompare(b));
  const details = [
    ["Non-workbook wealth", formatUsd(parameters.wealth)],
    ["Total modeled wealth", formatUsd(summary.total)],
    ["Current concentration", `${summary.current.toFixed(2)}%`],
    ["Desired concentration", `${parameters.target.toFixed(2)}%`],
    ["Minimum required sale", formatUsd(summary.minimum)],
    ["Ending concentration", `${summary.ending.toFixed(2)}%`],
    [
      "Target",
      summary.meetsTarget ? "Selection meets the target" : "Selection does not meet the target",
    ],
  ];
  const selectedLots = symbols.reduce((count, [, position]) => count + position.selectedLots, 0);
  return (
    <section class="overflow-auto" aria-label="Stock summary">
      <table class="summary-table">
        <caption>
          <strong>Portfolio</strong>
          <small>
            Held, Sell, and Left are shares. Value, Proceeds, Basis, Gain, and Balance are USD.
          </small>
          <dl class="summary-caption-details">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </caption>
        <thead>
          <tr>
            {headings.map((heading, index) => (
              <th key={heading} scope="col" class={index === 0 ? undefined : "numeric-cell"}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map(([symbol, position]) => (
            <tr key={symbol}>
              <th scope="row">{symbol}</th>
              <td class="numeric-cell">{position.shares.toFixed()}</td>
              <td class="numeric-cell">{formatUsd(position.value)}</td>
              <td class="numeric-cell">{position.selectedLots}</td>
              <td class="numeric-cell">{position.selectedShares.toFixed()}</td>
              <td class="numeric-cell">{formatUsd(position.proceeds)}</td>
              <td class="numeric-cell">{formatUsd(position.basis)}</td>
              <td class="numeric-cell">{formatUsd(position.gain)}</td>
              <td class="numeric-cell">{position.remainingShares.toFixed()}</td>
              <td class="numeric-cell">{formatUsd(position.remainingValue)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td class="numeric-cell">{summary.shares.toFixed()}</td>
            <td class="numeric-cell">{formatUsd(summary.value)}</td>
            <td class="numeric-cell">{selectedLots}</td>
            <td class="numeric-cell">{summary.selectedShares.toFixed()}</td>
            <td class="numeric-cell">{formatUsd(summary.proceeds)}</td>
            <td class="numeric-cell">{formatUsd(summary.basis)}</td>
            <td class="numeric-cell">{formatUsd(summary.gain)}</td>
            <td class="numeric-cell">{summary.remainingShares.toFixed()}</td>
            <td class="numeric-cell">{formatUsd(summary.remainingValue)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

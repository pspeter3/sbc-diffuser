import { type BigNumber } from "bignumber.js";
import { type JSX } from "preact";

import { formatUsd } from "./format.ts";
import { type Summary } from "./planner.ts";

function gainCellClass(gain: Readonly<BigNumber>): string {
  if (gain.gt(0)) return "numeric-cell gain-positive";
  if (gain.lt(0)) return "numeric-cell gain-negative";
  return "numeric-cell";
}

export function SummaryView({
  kind,
  summary,
}: {
  kind: "Portfolio" | "Sale";
  summary: Summary | null;
}): JSX.Element | null {
  if (summary === null) return null;
  const portfolio = kind === "Portfolio";
  const { bySymbol, total } = portfolio ? summary.portfolio : summary.sale;
  const symbols = [...bySymbol].sort(([a], [b]) => a.localeCompare(b));
  const headings = portfolio
    ? ["Symbol", "Lots", "Shares", "Value"]
    : ["Symbol", "Lots", "Shares", "Proceeds", "Basis", "Gain"];
  const details = portfolio
    ? [
        ["Total Wealth", formatUsd(summary.wealth)],
        ["Current Concentration", `${summary.currentConcentration.toFixed(2)}%`],
      ]
    : [
        ["Minimum Sale", formatUsd(summary.minimumSale)],
        ["Final Concentration", `${summary.finalConcentration.toFixed(2)}%`],
      ];
  return (
    <section class="overflow-auto" aria-label={`${kind} summary`}>
      <table class="summary summary-table">
        <caption>
          <dl class="grid">
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
              <td class="numeric-cell">{position.lots}</td>
              <td class="numeric-cell">{position.shares.toFixed()}</td>
              <td class="numeric-cell">{formatUsd(position.value)}</td>
              {!portfolio && (
                <>
                  <td class="numeric-cell">{formatUsd(position.basis)}</td>
                  <td class={gainCellClass(position.gain)}>{formatUsd(position.gain)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td class="numeric-cell">{total.lots}</td>
            <td class="numeric-cell">{total.shares.toFixed()}</td>
            <td class="numeric-cell">{formatUsd(total.value)}</td>
            {!portfolio && (
              <>
                <td class="numeric-cell">{formatUsd(total.basis)}</td>
                <td class={gainCellClass(total.gain)}>{formatUsd(total.gain)}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

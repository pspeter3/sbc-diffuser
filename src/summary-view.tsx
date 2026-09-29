import { type BigNumber } from "bignumber.js";
import { type JSX } from "preact";

import { formatUsd } from "./format.ts";
import { type Parameters, summarize } from "./planner.ts";
import { type RsuLotList } from "./schema.ts";

function gainCellClass(gain: Readonly<BigNumber>): string {
  if (gain.gt(0)) return "numeric-cell gain-positive";
  if (gain.lt(0)) return "numeric-cell gain-negative";
  return "numeric-cell";
}

export function SummaryView({
  kind,
  lots,
  parameters,
  selected,
}: {
  kind: "Portfolio" | "Sale";
  lots: RsuLotList;
  parameters: Parameters | null;
  selected: ReadonlySet<number>;
}): JSX.Element | null {
  if (parameters === null) return null;
  const summary = summarize(lots, parameters, selected);
  const portfolio = kind === "Portfolio";
  const symbols = [...summary.bySymbol]
    .filter(([, position]) => portfolio || position.selectedLots > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const headings = portfolio
    ? ["Symbol", "Lots", "Shares", "Value"]
    : ["Symbol", "Lots", "Shares", "Proceeds", "Basis", "Gain"];
  const details = portfolio
    ? [
        ["Total Wealth", formatUsd(summary.total)],
        ["Current Concentration", `${summary.current.toFixed(2)}%`],
      ]
    : [
        ["Minimum Sale", formatUsd(summary.minimum)],
        ["Final Concentration", `${summary.ending.toFixed(2)}%`],
        [
          "Target",
          summary.meetsTarget ? "Selection meets the target" : "Selection does not meet the target",
        ],
      ];
  const lotCount = symbols.reduce(
    (count, [, position]) => count + (portfolio ? position.lots : position.selectedLots),
    0,
  );
  return (
    <section class="overflow-auto" aria-label={`${kind} summary`}>
      <table class="summary-table">
        <caption>
          <strong>{kind}</strong>
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
              <td class="numeric-cell">{portfolio ? position.lots : position.selectedLots}</td>
              <td class="numeric-cell">
                {(portfolio ? position.shares : position.selectedShares).toFixed()}
              </td>
              <td class="numeric-cell">
                {formatUsd(portfolio ? position.value : position.proceeds)}
              </td>
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
            <td class="numeric-cell">{lotCount}</td>
            <td class="numeric-cell">
              {(portfolio ? summary.shares : summary.selectedShares).toFixed()}
            </td>
            <td class="numeric-cell">{formatUsd(portfolio ? summary.value : summary.proceeds)}</td>
            {!portfolio && (
              <>
                <td class="numeric-cell">{formatUsd(summary.basis)}</td>
                <td class={gainCellClass(summary.gain)}>{formatUsd(summary.gain)}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

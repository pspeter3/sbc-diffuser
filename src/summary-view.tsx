import { Fragment, type JSX } from "preact";

import { type Parameters, summarize } from "./planner.ts";
import { type RsuLotList } from "./schema.ts";

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
  const entries: [string, string][] = [
    ["Symbols", [...parameters.prices.keys()].join(", ")],
    ["Held shares", summary.shares.toFixed()],
    ["Current stock value (USD)", summary.value.toFixed(2)],
    ["Non-workbook wealth (USD)", parameters.wealth.toFixed(2)],
    ["Total modeled wealth (USD)", summary.total.toFixed(2)],
    ["Current concentration", `${summary.current.toFixed(2)}%`],
    ["Desired concentration", `${parameters.target.toFixed(2)}%`],
    ["Minimum required sale (USD)", summary.minimum.toFixed(2)],
    ["Selected lots", String(selected.size)],
    ["Selected shares", summary.selectedShares.toFixed()],
    ["Selected proceeds (USD)", summary.proceeds.toFixed(2)],
    ["Estimated total basis (USD)", summary.basis.toFixed(2)],
    ["Estimated gain/loss (USD)", summary.gain.toFixed(2)],
    ["Remaining shares", summary.remainingShares.toFixed()],
    ["Remaining stock value (USD)", summary.remainingValue.toFixed(2)],
    ["Ending concentration", `${summary.ending.toFixed(2)}%`],
    [
      "Target",
      summary.meetsTarget ? "Selection meets the target" : "Selection does not meet the target",
    ],
  ];
  return (
    <dl>
      {entries.map(([label, value]) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

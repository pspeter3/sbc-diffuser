import { type BigNumber } from "bignumber.js";
import { type JSX } from "preact";
import { useMemo } from "preact/hooks";

import { formatUsd } from "./format.ts";
import { type RsuLot, type RsuLotList } from "./schema.ts";

const numericColumns: ReadonlySet<string> = new Set([
  "Vest",
  "Shares",
  "Basis",
  "Proceeds",
  "Result",
]);
export function LotTableView({
  lots,
  prices,
  selected,
  onSelection,
}: {
  lots: RsuLotList;
  prices: ReadonlyMap<string, BigNumber> | null;
  selected: ReadonlySet<number>;
  onSelection: (index: number, checked: boolean) => void;
}): JSX.Element {
  const sorted = useMemo(
    () => lots.map((lot, index) => ({ lot, index })).sort((a, b) => compareLots(a.lot, b.lot)),
    [lots],
  );
  return (
    <section class="overflow-auto" aria-label="Held RSU lots">
      <table>
        <thead>
          <tr>
            {[
              "Sell",
              "Symbol",
              "Vest",
              "Grant",
              "Period",
              "Shares",
              "Basis",
              "Proceeds",
              "Result",
            ].map((label) => (
              <th
                key={label}
                scope="col"
                class={numericColumns.has(label) ? "numeric-cell" : undefined}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ lot, index }) => {
            const price = prices?.get(lot.symbol);
            return (
              <tr key={index}>
                <td>
                  <input
                    type="checkbox"
                    disabled={prices === null}
                    checked={selected.has(index)}
                    aria-label={`Plan to sell ${lot.symbol}, grant ${lot.grantNumber}, vest period ${lot.vestPeriod}, ${lot.vestDate}`}
                    onChange={(event) => onSelection(index, event.currentTarget.checked)}
                  />
                </td>
                <td>{lot.symbol}</td>
                <td class="numeric-cell">{lot.vestDate}</td>
                <td>{lot.grantNumber}</td>
                <td>{lot.vestPeriod}</td>
                <td class="numeric-cell">{lot.quantity.toFixed()}</td>
                <td class="numeric-cell">{formatUsd(lot.estimatedCostBasisPerShare)}</td>
                <td class="numeric-cell">
                  {price === undefined ? "—" : formatUsd(lot.quantity.times(price))}
                </td>
                <td class="numeric-cell">
                  {price === undefined
                    ? "—"
                    : formatUsd(lot.quantity.times(price.minus(lot.estimatedCostBasisPerShare)))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function compareLots(a: RsuLot, b: RsuLot): number {
  const basis = Number(b.estimatedCostBasisPerShare.comparedTo(a.estimatedCostBasisPerShare));
  if (basis !== 0) return basis;
  const date = a.vestDate.localeCompare(b.vestDate);
  if (date !== 0) return date;
  const grant = a.grantNumber.localeCompare(b.grantNumber);
  return grant !== 0
    ? grant
    : a.vestPeriod.localeCompare(b.vestPeriod, undefined, { numeric: true });
}

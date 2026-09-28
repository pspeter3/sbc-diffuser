import { type BigNumber } from "bignumber.js";
import { type JSX } from "preact";

import { type RsuLot, type RsuLotList } from "./schema.ts";

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
  const sorted = lots
    .map((lot, index) => ({ lot, index }))
    .sort((a, b) => compareLots(a.lot, b.lot));
  return (
    <div class="overflow-auto" tabIndex={0} role="region" aria-label="Held RSU lots">
      <table>
        <thead>
          <tr>
            {[
              "Plan to sell",
              "Symbol",
              "Vest date",
              "Grant number",
              "Vest period",
              "Shares",
              "Estimated basis/share",
              "Proceeds",
              "Estimated gain/loss",
              "Block status",
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody id="lot-rows">
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
                <td>{lot.vestDate}</td>
                <td>{lot.grantNumber}</td>
                <td>{lot.vestPeriod}</td>
                <td>{lot.quantity.toFixed()}</td>
                <td>{lot.estimatedCostBasisPerShare.toFixed(2)}</td>
                <td>{price === undefined ? "—" : lot.quantity.times(price).toFixed(2)}</td>
                <td>
                  {price === undefined
                    ? "—"
                    : lot.quantity.times(price.minus(lot.estimatedCostBasisPerShare)).toFixed(2)}
                </td>
                <td>{lot.blocked ? "Blocked" : "Sellable"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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

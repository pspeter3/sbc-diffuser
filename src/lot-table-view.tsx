import { type BigNumber } from "bignumber.js";
import { type JSX } from "preact";
import { useMemo } from "preact/hooks";

import { formatUsd } from "./format.ts";
import { type Valuation, valuation } from "./planner.ts";
import { lotKey, type RsuLot, type RsuLotList } from "./schema.ts";

interface Column {
  label: string;
  numeric: boolean;
  /** Valuation is null until prices are configured. */
  text: (lot: RsuLot, valued: Valuation | null) => string;
}

const columns: ReadonlyArray<Column> = [
  { label: "Symbol", numeric: false, text: (lot) => lot.symbol },
  { label: "Vest", numeric: true, text: (lot) => lot.vestDate },
  { label: "Grant", numeric: false, text: (lot) => lot.grantNumber },
  { label: "Period", numeric: false, text: (lot) => lot.vestPeriod },
  { label: "Shares", numeric: true, text: (lot) => lot.quantity.toFixed() },
  { label: "Basis", numeric: true, text: (lot) => formatUsd(lot.estimatedCostBasisPerShare) },
  {
    label: "Proceeds",
    numeric: true,
    text: (_, valued) => (valued === null ? "—" : formatUsd(valued.value)),
  },
  {
    label: "Result",
    numeric: true,
    text: (_, valued) => (valued === null ? "—" : formatUsd(valued.gain)),
  },
];

function cellClass(column: Column): string | undefined {
  return column.numeric ? "numeric-cell" : undefined;
}

export function LotTableView({
  lots,
  prices,
  selected,
  onSelection,
}: {
  lots: RsuLotList;
  prices: ReadonlyMap<string, BigNumber> | null;
  selected: ReadonlySet<string>;
  onSelection: (key: string, checked: boolean) => void;
}): JSX.Element {
  const sorted = useMemo(() => lots.toSorted(compareLots), [lots]);
  return (
    <section class="overflow-auto" aria-label="Held RSU lots">
      <table>
        <thead>
          <tr>
            <th scope="col">Sell</th>
            {columns.map((column) => (
              <th key={column.label} scope="col" class={cellClass(column)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((lot) => {
            const key = lotKey(lot);
            const price = prices?.get(lot.symbol);
            const valued = price === undefined ? null : valuation(lot, price);
            return (
              <tr key={key}>
                <td>
                  <input
                    type="checkbox"
                    disabled={prices === null}
                    checked={selected.has(key)}
                    aria-label={`Plan to sell ${lot.symbol}, grant ${lot.grantNumber}, vest period ${lot.vestPeriod}, ${lot.vestDate}`}
                    onChange={(event) => onSelection(key, event.currentTarget.checked)}
                  />
                </td>
                {columns.map((column) => (
                  <td key={column.label} class={cellClass(column)}>
                    {column.text(lot, valued)}
                  </td>
                ))}
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

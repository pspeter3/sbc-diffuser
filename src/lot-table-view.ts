import { type BigNumber } from "bignumber.js";

import { element } from "./dom.ts";
import { type RsuLot, type RsuLotList } from "./schema.ts";

export class LotTableView {
  readonly #body: HTMLTableSectionElement;
  readonly #template = document.createElement("template");
  #rows: {
    lot: RsuLot;
    index: number;
    checkbox: HTMLInputElement;
    proceeds: HTMLTableCellElement;
    gain: HTMLTableCellElement;
  }[] = [];

  constructor(
    body: HTMLTableSectionElement,
    onSelection: (index: number, checked: boolean) => void,
  ) {
    this.#body = body;
    this.#template.innerHTML = `<tr><td><input type="checkbox"></td>${"<td></td>".repeat(9)}</tr>`;
    body.addEventListener("change", (event): void => {
      const row = this.#rows.find(({ checkbox }) => checkbox === event.target);
      if (row !== undefined) onSelection(row.index, row.checkbox.checked);
    });
  }

  setLots(lots: RsuLotList): void {
    this.#body.replaceChildren();
    this.#rows = [];
    const sorted = lots
      .map((lot, index) => ({ lot, index }))
      .sort((a, b) => compareLots(a.lot, b.lot));
    for (const { lot, index } of sorted) {
      const fragment = document.importNode(this.#template.content, true);
      const row = element(fragment, "tr", HTMLTableRowElement);
      const checkbox = element(row, "input", HTMLInputElement);
      const values = [
        lot.symbol,
        lot.vestDate,
        lot.grantNumber,
        lot.vestPeriod,
        lot.quantity.toFixed(),
        lot.estimatedCostBasisPerShare.toFixed(2),
        "—",
        "—",
        lot.blocked ? "Blocked" : "Sellable",
      ];
      values.forEach((value, cell): void => {
        const target = element(row, `td:nth-child(${cell + 2})`, HTMLTableCellElement);
        target.textContent = value;
      });
      checkbox.setAttribute(
        "aria-label",
        `Plan to sell ${lot.symbol}, grant ${lot.grantNumber}, vest period ${lot.vestPeriod}, ${lot.vestDate}`,
      );
      const proceeds = element(row, "td:nth-child(8)", HTMLTableCellElement);
      const gain = element(row, "td:nth-child(9)", HTMLTableCellElement);
      this.#rows.push({
        lot,
        index,
        checkbox,
        proceeds,
        gain,
      });
      this.#body.append(row);
    }
  }

  update(prices: ReadonlyMap<string, BigNumber> | null, selected: ReadonlySet<number>): void {
    for (const { lot, index, checkbox, proceeds, gain } of this.#rows) {
      const price = prices?.get(lot.symbol);
      checkbox.disabled = prices === null;
      checkbox.checked = selected.has(index);
      proceeds.textContent = price === undefined ? "—" : lot.quantity.times(price).toFixed(2);
      gain.textContent =
        price === undefined
          ? "—"
          : lot.quantity.times(price.minus(lot.estimatedCostBasisPerShare)).toFixed(2);
    }
  }
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

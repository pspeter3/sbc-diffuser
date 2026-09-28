import { BigNumber } from "bignumber.js";

import { type RsuLotList } from "./schema.ts";

export interface Parameters {
  prices: ReadonlyMap<string, BigNumber>;
  wealth: BigNumber;
  target: BigNumber;
}

export function decimalInput(value: string, maximum?: number): BigNumber | null {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const number = new BigNumber(value);
  return number.isFinite() && (maximum === undefined || number.lte(maximum)) ? number : null;
}

export function priceFor(parameters: Parameters, symbol: string): BigNumber {
  const price = parameters.prices.get(symbol);
  if (price === undefined) throw new Error(`Missing stock price for ${symbol}`);
  return price;
}

export function summarize(
  lots: RsuLotList,
  parameters: Parameters,
  selected: ReadonlySet<number>,
): {
  shares: BigNumber;
  value: BigNumber;
  total: BigNumber;
  minimum: BigNumber;
  current: BigNumber;
  selectedShares: BigNumber;
  proceeds: BigNumber;
  basis: BigNumber;
  gain: BigNumber;
  remainingShares: BigNumber;
  remainingValue: BigNumber;
  ending: BigNumber;
  meetsTarget: boolean;
} {
  let shares = new BigNumber(0);
  let value = new BigNumber(0);
  let selectedShares = new BigNumber(0);
  let proceeds = new BigNumber(0);
  let basis = new BigNumber(0);
  lots.forEach((lot, index): void => {
    const lotValue = lot.quantity.times(priceFor(parameters, lot.symbol));
    shares = shares.plus(lot.quantity);
    value = value.plus(lotValue);
    if (selected.has(index)) {
      selectedShares = selectedShares.plus(lot.quantity);
      proceeds = proceeds.plus(lotValue);
      basis = basis.plus(lot.quantity.times(lot.estimatedCostBasisPerShare));
    }
  });
  const total = value.plus(parameters.wealth);
  const minimum = BigNumber.maximum(0, value.minus(total.times(parameters.target).div(100)));
  const remainingValue = value.minus(proceeds);
  return {
    shares,
    value,
    total,
    minimum,
    current: total.isZero() ? new BigNumber(0) : value.times(100).div(total),
    selectedShares,
    proceeds,
    basis,
    gain: proceeds.minus(basis),
    remainingShares: shares.minus(selectedShares),
    remainingValue,
    ending: total.isZero() ? new BigNumber(0) : remainingValue.times(100).div(total),
    meetsTarget: proceeds.gte(minimum),
  };
}

export function recommend(lots: RsuLotList, parameters: Parameters): Set<number> {
  const selected = new Set<number>();
  const { minimum } = summarize(lots, parameters, selected);
  const groups = new Map<
    string,
    { date: string; indices: number[]; shares: BigNumber; basis: BigNumber; proceeds: BigNumber }
  >();
  lots.forEach((lot, index): void => {
    const group = groups.get(lot.vestDate) ?? {
      date: lot.vestDate,
      indices: [],
      shares: new BigNumber(0),
      basis: new BigNumber(0),
      proceeds: new BigNumber(0),
    };
    group.indices.push(index);
    group.shares = group.shares.plus(lot.quantity);
    group.basis = group.basis.plus(lot.quantity.times(lot.estimatedCostBasisPerShare));
    group.proceeds = group.proceeds.plus(lot.quantity.times(priceFor(parameters, lot.symbol)));
    groups.set(lot.vestDate, group);
  });
  // Compare weighted means by cross multiplication to avoid rounding during ranking.
  const ranked = [...groups.values()].sort((a, b) => {
    const comparison = b.basis.times(a.shares).comparedTo(a.basis.times(b.shares));
    return comparison !== null && comparison !== 0 ? comparison : a.date.localeCompare(b.date);
  });
  let proceeds = new BigNumber(0);
  for (const group of ranked) {
    if (proceeds.gte(minimum)) break;
    for (const index of group.indices) selected.add(index);
    proceeds = proceeds.plus(group.proceeds);
  }
  return selected;
}

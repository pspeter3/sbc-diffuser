import { BigNumber } from "bignumber.js";

import { lotKey, type RsuLotList } from "./schema.ts";

export interface Parameters {
  prices: ReadonlyMap<string, BigNumber>;
  wealth: BigNumber;
  target: BigNumber;
}

export interface SymbolSummary {
  lots: number;
  shares: BigNumber;
  value: BigNumber;
  selectedLots: number;
  selectedShares: BigNumber;
  proceeds: BigNumber;
  basis: BigNumber;
  gain: BigNumber;
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

export interface Summary {
  bySymbol: ReadonlyMap<string, SymbolSummary>;
  shares: BigNumber;
  value: BigNumber;
  total: BigNumber;
  minimum: BigNumber;
  current: BigNumber;
  selectedShares: BigNumber;
  proceeds: BigNumber;
  basis: BigNumber;
  gain: BigNumber;
  ending: BigNumber;
}

export function summarize(
  lots: RsuLotList,
  parameters: Parameters,
  selected: ReadonlySet<string>,
): Summary {
  const positions = new Map<string, Omit<SymbolSummary, "gain">>();
  let shares = new BigNumber(0);
  let value = new BigNumber(0);
  let selectedShares = new BigNumber(0);
  let proceeds = new BigNumber(0);
  let basis = new BigNumber(0);
  for (const lot of lots) {
    const lotValue = lot.quantity.times(priceFor(parameters, lot.symbol));
    const position = positions.get(lot.symbol) ?? {
      lots: 0,
      shares: new BigNumber(0),
      value: new BigNumber(0),
      selectedLots: 0,
      selectedShares: new BigNumber(0),
      proceeds: new BigNumber(0),
      basis: new BigNumber(0),
    };
    position.lots += 1;
    position.shares = position.shares.plus(lot.quantity);
    position.value = position.value.plus(lotValue);
    if (selected.has(lotKey(lot))) {
      position.selectedLots += 1;
      position.selectedShares = position.selectedShares.plus(lot.quantity);
      position.proceeds = position.proceeds.plus(lotValue);
      position.basis = position.basis.plus(lot.quantity.times(lot.estimatedCostBasisPerShare));
    }
    positions.set(lot.symbol, position);
  }
  const bySymbol = new Map<string, SymbolSummary>();
  for (const [symbol, position] of positions) {
    shares = shares.plus(position.shares);
    value = value.plus(position.value);
    selectedShares = selectedShares.plus(position.selectedShares);
    proceeds = proceeds.plus(position.proceeds);
    basis = basis.plus(position.basis);
    bySymbol.set(symbol, {
      ...position,
      gain: position.proceeds.minus(position.basis),
    });
  }
  const total = value.plus(parameters.wealth);
  const minimum = BigNumber.maximum(0, value.minus(total.times(parameters.target).div(100)));
  const remainingValue = value.minus(proceeds);
  return {
    bySymbol,
    shares,
    value,
    total,
    minimum,
    current: total.isZero() ? new BigNumber(0) : value.times(100).div(total),
    selectedShares,
    proceeds,
    basis,
    gain: proceeds.minus(basis),
    ending: total.isZero() ? new BigNumber(0) : remainingValue.times(100).div(total),
  };
}

export function recommend(lots: RsuLotList, parameters: Parameters): Set<string> {
  const selected = new Set<string>();
  const { minimum } = summarize(lots, parameters, selected);
  const groups = new Map<
    string,
    { date: string; keys: string[]; shares: BigNumber; basis: BigNumber; proceeds: BigNumber }
  >();
  for (const lot of lots) {
    const group = groups.get(lot.vestDate) ?? {
      date: lot.vestDate,
      keys: [],
      shares: new BigNumber(0),
      basis: new BigNumber(0),
      proceeds: new BigNumber(0),
    };
    group.keys.push(lotKey(lot));
    group.shares = group.shares.plus(lot.quantity);
    group.basis = group.basis.plus(lot.quantity.times(lot.estimatedCostBasisPerShare));
    group.proceeds = group.proceeds.plus(lot.quantity.times(priceFor(parameters, lot.symbol)));
    groups.set(lot.vestDate, group);
  }
  // Compare weighted means by cross multiplication to avoid rounding during ranking.
  const ranked = [...groups.values()].sort((a, b) => {
    const comparison = b.basis.times(a.shares).comparedTo(a.basis.times(b.shares));
    return comparison !== null && comparison !== 0 ? comparison : a.date.localeCompare(b.date);
  });
  let proceeds = new BigNumber(0);
  for (const group of ranked) {
    if (proceeds.gte(minimum)) break;
    for (const key of group.keys) selected.add(key);
    proceeds = proceeds.plus(group.proceeds);
  }
  return selected;
}

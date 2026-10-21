import { BigNumber } from "bignumber.js";

import { lotKey, type RsuLot, type RsuLotList } from "./schema.ts";

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

/** Market value, cost basis, and gain of a single lot at a share price. */
export interface Valuation {
  value: BigNumber;
  basis: BigNumber;
  gain: BigNumber;
}

export function valuation(lot: RsuLot, price: BigNumber): Valuation {
  const value = lot.quantity.times(price);
  const basis = lot.quantity.times(lot.estimatedCostBasisPerShare);
  return { value, basis, gain: value.minus(basis) };
}

export interface Totals extends Valuation {
  lots: number;
  shares: BigNumber;
}

const emptyTotals: Totals = {
  lots: 0,
  shares: new BigNumber(0),
  value: new BigNumber(0),
  basis: new BigNumber(0),
  gain: new BigNumber(0),
};

function add(totals: Totals, lot: RsuLot, price: BigNumber): Totals {
  const { value, basis, gain } = valuation(lot, price);
  return {
    lots: totals.lots + 1,
    shares: totals.shares.plus(lot.quantity),
    value: totals.value.plus(value),
    basis: totals.basis.plus(basis),
    gain: totals.gain.plus(gain),
  };
}

export interface Breakdown {
  bySymbol: ReadonlyMap<string, Totals>;
  total: Totals;
}

function breakdown(lots: RsuLotList, parameters: Parameters): Breakdown {
  const bySymbol = new Map<string, Totals>();
  let total = emptyTotals;
  for (const lot of lots) {
    const price = priceFor(parameters, lot.symbol);
    bySymbol.set(lot.symbol, add(bySymbol.get(lot.symbol) ?? emptyTotals, lot, price));
    total = add(total, lot, price);
  }
  return { bySymbol, total };
}

export interface Summary {
  /** Every held lot. */
  portfolio: Breakdown;
  /** Selected lots; value is sale proceeds. */
  sale: Breakdown;
  /** Holdings plus other investable wealth. */
  wealth: BigNumber;
  minimumSale: BigNumber;
  /** Percentages of wealth held in workbook lots before and after the sale. */
  currentConcentration: BigNumber;
  finalConcentration: BigNumber;
}

function percentage(part: BigNumber, whole: BigNumber): BigNumber {
  return whole.isZero() ? new BigNumber(0) : part.times(100).div(whole);
}

export function summarize(
  lots: RsuLotList,
  parameters: Parameters,
  selected: ReadonlySet<string>,
): Summary {
  const portfolio = breakdown(lots, parameters);
  const sale = breakdown(
    lots.filter((lot) => selected.has(lotKey(lot))),
    parameters,
  );
  const held = portfolio.total.value;
  const wealth = held.plus(parameters.wealth);
  return {
    portfolio,
    sale,
    wealth,
    minimumSale: BigNumber.maximum(0, held.minus(wealth.times(parameters.target).div(100))),
    currentConcentration: percentage(held, wealth),
    finalConcentration: percentage(held.minus(sale.total.value), wealth),
  };
}

export function recommend(lots: RsuLotList, parameters: Parameters): Set<string> {
  const groups = new Map<string, RsuLot[]>();
  for (const lot of lots) {
    const group = groups.get(lot.vestDate) ?? [];
    group.push(lot);
    groups.set(lot.vestDate, group);
  }
  const ranked = [...groups].map(([date, group]) => ({
    date,
    keys: group.map(lotKey),
    totals: breakdown(group, parameters).total,
  }));
  // Compare weighted mean basis by cross multiplication to avoid rounding during ranking.
  ranked.sort((a, b) => {
    const comparison = b.totals.basis
      .times(a.totals.shares)
      .comparedTo(a.totals.basis.times(b.totals.shares));
    return comparison !== null && comparison !== 0 ? comparison : a.date.localeCompare(b.date);
  });
  const { minimumSale } = summarize(lots, parameters, new Set());
  const selected = new Set<string>();
  let proceeds = new BigNumber(0);
  for (const group of ranked) {
    if (proceeds.gte(minimumSale)) break;
    for (const key of group.keys) selected.add(key);
    proceeds = proceeds.plus(group.totals.value);
  }
  return selected;
}

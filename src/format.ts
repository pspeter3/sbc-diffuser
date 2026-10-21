import { type BigNumber } from "bignumber.js";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// BigNumber#toFixed always yields a finite decimal string.
function isDecimalString(value: string): value is `${number}` {
  return /^-?\d+(?:\.\d+)?$/.test(value);
}

export function formatUsd(value: Readonly<BigNumber>): string {
  const decimal = value.toFixed(2);
  // Intl formats decimal strings exactly, avoiding float rounding of large amounts.
  return isDecimalString(decimal) ? usd.format(decimal) : decimal;
}

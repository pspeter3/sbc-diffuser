import { type BigNumber } from "bignumber.js";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatUsd(value: Readonly<BigNumber>): string {
  // Intl accepts decimal strings exactly; TypeScript requires a numeric-string type.
  return String(Reflect.apply((decimal: number) => usd.format(decimal), null, [value.toFixed(2)]));
}

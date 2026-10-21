import { BigNumber } from "bignumber.js";
import { expect, it } from "vite-plus/test";

import { formatUsd } from "./format.ts";

it.each([
  ["0", "$0.00"],
  ["-98122.5", "-$98,122.50"],
  ["9007199254740993.01", "$9,007,199,254,740,993.01"],
  ["NaN", "NaN"],
])("formats %s as %s", (value, expected): void => {
  expect(formatUsd(new BigNumber(value))).toBe(expected);
});

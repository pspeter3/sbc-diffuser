import { type BigNumber } from "bignumber.js";

declare const brand: unique symbol;

export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
export type GrantNumber = Brand<string, "GrantNumber">;
export type VestPeriod = Brand<string, "VestPeriod">;
export type IsoDate = Brand<string, "IsoDate">;

/** One current holding; blocked holdings are retained without changing quantities. */
export interface RsuLot {
  readonly grantNumber: GrantNumber;
  readonly vestPeriod: VestPeriod;
  readonly symbol: string;
  readonly vestDate: IsoDate;
  readonly releaseDate: IsoDate;
  /** Positive sellable quantity, otherwise blocked quantity; never their sum. */
  readonly quantity: Readonly<BigNumber>;
  readonly estimatedCostBasisPerShare: Readonly<BigNumber>;
}

export type RsuLotList = ReadonlyArray<RsuLot>;

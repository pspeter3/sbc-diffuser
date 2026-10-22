import { type BigNumber } from "bignumber.js";
import * as z from "zod/mini";

declare const brand: unique symbol;

export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
export type GrantNumber = Brand<string, "GrantNumber">;
export type VestPeriod = Brand<string, "VestPeriod">;
export type IsoDate = Brand<string, "IsoDate">;

export const grantNumberSchema = z.custom<GrantNumber>(
  (value) => typeof value === "string" && value.length > 0,
);
export const vestPeriodSchema = z.custom<VestPeriod>(
  (value) => typeof value === "string" && value.length > 0,
);
export const isoDateSchema = z.custom<IsoDate>((value) => z.iso.date().safeParse(value).success);

/** One current holding; blocked status is ignored because plans target a future trading window. */
export interface RsuLot {
  readonly grantNumber: GrantNumber;
  readonly vestPeriod: VestPeriod;
  readonly symbol: string;
  readonly vestDate: IsoDate;
  /** Positive sellable quantity, otherwise blocked quantity; never their sum. */
  readonly quantity: Readonly<BigNumber>;
  readonly estimatedCostBasisPerShare: Readonly<BigNumber>;
}

export type RsuLotList = ReadonlyArray<RsuLot>;

/** Identifies a lot across sorting and re-renders; the parser rejects duplicates. */
export function lotKey(lot: RsuLot): string {
  return JSON.stringify([lot.grantNumber, lot.vestPeriod]);
}

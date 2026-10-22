import { BigNumber } from "bignumber.js";
import { type JSX, type TargetedInputEvent, type TargetedSubmitEvent } from "preact";
import { useId } from "preact/hooks";
import * as z from "zod/mini";

import { type Parameters } from "./planner.ts";
import { type IsoDate, isoDateSchema } from "./schema.ts";

/** Plain non-negative decimals; rejects signs, exponents, and non-finite values. */
function decimal(
  message: string,
  valid: (value: BigNumber) => boolean = () => true,
): z.ZodMiniType<BigNumber, unknown> {
  return z.pipe(
    z
      .string()
      .check(
        z.refine(
          (value) => /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && valid(new BigNumber(value)),
          message,
        ),
      ),
    z.transform((value) => new BigNumber(value)),
  );
}

// Field names match issue paths so each issue can be reported on its input.
const parametersSchema = z.object({
  prices: z.map(
    z.string(),
    decimal("Enter a positive stock price.", (value) => value.gt(0)),
  ),
  wealth: decimal("Enter a valid value."),
  target: decimal("Enter a percentage from 0 to 100.", (value) => value.lte(100)),
  saleDate: z.custom<IsoDate>(
    (value) => isoDateSchema.safeParse(value).success,
    "Enter a valid sale date.",
  ),
});

/** Today's local calendar date, matching what a date input shows. */
function today(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function PlannerFormView({
  symbols,
  onSubmit,
}: {
  symbols: ReadonlyArray<string>;
  onSubmit: (parameters: Parameters) => void;
}): JSX.Element {
  const id = useId();
  function submit(event: TargetedSubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const result = parametersSchema.safeParse({
      prices: new Map(symbols.map((symbol) => [symbol, values.get(`prices.${symbol}`)])),
      wealth: values.get("wealth"),
      target: values.get("target"),
      saleDate: values.get("saleDate"),
    });
    const issues = new Map(
      result.error?.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
    for (const input of form.querySelectorAll("input")) {
      const message = issues.get(input.name) ?? "";
      input.setCustomValidity(message);
      input.setAttribute("aria-invalid", String(message !== ""));
    }
    if (result.success) onSubmit(result.data);
    else form.reportValidity();
  }
  function clearValidity(event: TargetedInputEvent<HTMLInputElement>): void {
    event.currentTarget.setCustomValidity("");
    event.currentTarget.removeAttribute("aria-invalid");
  }
  return (
    <form onSubmit={submit}>
      {symbols.map((symbol, index) => (
        <label key={symbol}>
          {symbol}
          <input
            onInput={clearValidity}
            name={`prices.${symbol}`}
            type="number"
            min="0"
            step="any"
            required
            aria-describedby={`${id}-price-${String(index)}`}
          />
          <small id={`${id}-price-${String(index)}`}>Price per share (USD)</small>
        </label>
      ))}
      <label htmlFor="wealth">Wealth</label>
      <input
        onInput={clearValidity}
        id="wealth"
        name="wealth"
        type="number"
        min="0"
        step="any"
        required
        aria-describedby="wealth-helper"
      />
      <small id="wealth-helper">Investable wealth excluding workbook holdings (USD)</small>
      <label htmlFor="target">Concentration</label>
      <input
        onInput={clearValidity}
        id="target"
        name="target"
        type="number"
        min="0"
        max="100"
        step="any"
        required
        aria-describedby="target-helper"
      />
      <small id="target-helper">Desired wealth concentration (%)</small>
      <label htmlFor="saleDate">Sale date</label>
      <input
        onInput={clearValidity}
        id="saleDate"
        name="saleDate"
        type="date"
        defaultValue={today()}
        required
        aria-describedby="saleDate-helper"
      />
      <small id="saleDate-helper">Only lots vested by this date are available</small>
      <button type="submit">Recommend</button>
    </form>
  );
}

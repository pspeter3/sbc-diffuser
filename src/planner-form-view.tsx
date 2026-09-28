import { type BigNumber } from "bignumber.js";
import { type JSX, type TargetedSubmitEvent } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

import { decimalInput, type Parameters } from "./planner.ts";

export function PlannerFormView({
  symbols,
  onSubmit,
}: {
  symbols: ReadonlyArray<string>;
  onSubmit: (parameters: Parameters) => void;
}): JSX.Element {
  const form = useRef<HTMLFormElement>(null);
  useLayoutEffect(() => {
    form.current?.querySelector("input")?.focus();
  }, []);
  function submit(event: TargetedSubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const inputs = [...event.currentTarget.querySelectorAll("input")];
    const prices = new Map<string, BigNumber>();
    let wealth: BigNumber | null = null;
    let target: BigNumber | null = null;
    for (const input of inputs) {
      const value = decimalInput(input.value, input.name === "target" ? 100 : undefined);
      const isPrice = input.name.startsWith("price:");
      const valid = value !== null && (!isPrice || value.gt(0));
      input.setAttribute("aria-invalid", String(!valid));
      input.setCustomValidity(
        valid ? "" : isPrice ? "Enter a positive stock price." : "Enter a valid value.",
      );
      if (valid) {
        if (isPrice) prices.set(input.name.slice(6), value);
        else if (input.name === "wealth") wealth = value;
        else target = value;
      }
    }
    if (prices.size === symbols.length && wealth !== null && target !== null)
      onSubmit({ prices, wealth, target });
    else event.currentTarget.reportValidity();
  }
  return (
    <form
      ref={form}
      aria-label="Planning parameters"
      aria-describedby="configuration-help"
      onSubmit={submit}
      onInput={(event) => {
        if (event.target instanceof HTMLInputElement) {
          event.target.setCustomValidity("");
          event.target.removeAttribute("aria-invalid");
        }
      }}
    >
      {symbols.map((symbol) => (
        <label key={symbol}>
          {symbol} stock price (USD per share)
          <input name={`price:${symbol}`} type="number" min="0" step="any" required />
        </label>
      ))}
      <label for="wealth">Investable wealth excluding workbook holdings (USD)</label>
      <input id="wealth" name="wealth" type="number" min="0" step="any" required />
      <label for="target">Desired wealth concentration (%)</label>
      <input id="target" name="target" type="number" min="0" max="100" step="any" required />
      <small id="configuration-help">
        Submitting new parameters replaces manual selections with a new recommendation.
      </small>
      <button type="submit">Update plan</button>
    </form>
  );
}

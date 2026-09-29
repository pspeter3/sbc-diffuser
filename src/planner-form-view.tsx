import { type BigNumber } from "bignumber.js";
import { type JSX, type TargetedInputEvent, type TargetedSubmitEvent } from "preact";

import { decimalInput, type Parameters } from "./planner.ts";

export function PlannerFormView({
  symbols,
  onSubmit,
}: {
  symbols: ReadonlyArray<string>;
  onSubmit: (parameters: Parameters) => void;
}): JSX.Element {
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
  function clearValidity(event: TargetedInputEvent<HTMLInputElement>): void {
    event.currentTarget.setCustomValidity("");
    event.currentTarget.removeAttribute("aria-invalid");
  }
  return (
    <form onSubmit={submit}>
      {symbols.map((symbol) => (
        <label key={symbol}>
          {symbol}
          <input
            onInput={clearValidity}
            name={`price:${symbol}`}
            type="number"
            min="0"
            step="any"
            required
            aria-describedby={`${symbol}-helper`}
          />
          <small id={`${symbol}-helper`}>Price per share (USD)</small>
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
      <button type="submit">Recommend</button>
    </form>
  );
}

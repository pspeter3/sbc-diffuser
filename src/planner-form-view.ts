import { type BigNumber } from "bignumber.js";

import { element } from "./dom.ts";
import { decimalInput, type Parameters } from "./planner.ts";

export class PlannerFormView {
  readonly #form: HTMLFormElement;
  readonly #prices: HTMLElement;
  readonly #wealth: HTMLInputElement;
  readonly #target: HTMLInputElement;
  readonly #template = document.createElement("template");
  #fields: { symbol: string; input: HTMLInputElement }[] = [];

  constructor(
    form: HTMLFormElement,
    prices: HTMLElement,
    wealth: HTMLInputElement,
    target: HTMLInputElement,
    onSubmit: (parameters: Parameters) => void,
  ) {
    this.#form = form;
    this.#prices = prices;
    this.#wealth = wealth;
    this.#target = target;
    this.#template.innerHTML =
      '<label><span></span><input type="number" min="0" step="any" required></label>';
    form.addEventListener("submit", (event): void => {
      event.preventDefault();
      const parameters = this.#read();
      if (parameters === null) this.#form.reportValidity();
      else onSubmit(parameters);
    });
    form.addEventListener("input", (event): void => {
      if (event.target instanceof HTMLInputElement) {
        event.target.setCustomValidity("");
        event.target.removeAttribute("aria-invalid");
      }
    });
  }

  setSymbols(symbols: ReadonlyArray<string>): void {
    this.#form.reset();
    this.#prices.replaceChildren();
    this.#fields = symbols.map((symbol) => {
      const fragment = document.importNode(this.#template.content, true);
      const label = element(fragment, "label", HTMLLabelElement);
      const input = element(label, "input", HTMLInputElement);
      const span = element(label, "span", HTMLSpanElement);
      span.textContent = `${symbol} stock price (USD per share)`;
      this.#prices.append(label);
      return { symbol, input };
    });
    this.#wealth.removeAttribute("aria-invalid");
    this.#target.removeAttribute("aria-invalid");
  }

  focus(): void {
    (this.#fields[0]?.input ?? this.#wealth).focus();
  }

  #read(): Parameters | null {
    const prices = new Map<string, BigNumber>();
    for (const { symbol, input } of this.#fields) {
      const value = decimalInput(input.value);
      const valid = value !== null && value.gt(0);
      input.setAttribute("aria-invalid", String(!valid));
      input.setCustomValidity(valid ? "" : "Enter a positive stock price.");
      if (valid) prices.set(symbol, value);
    }
    const wealth = decimalInput(this.#wealth.value);
    const target = decimalInput(this.#target.value, 100);
    this.#wealth.setAttribute("aria-invalid", String(wealth === null));
    this.#target.setAttribute("aria-invalid", String(target === null));
    const valid = prices.size === this.#fields.length && wealth !== null && target !== null;
    return valid ? { prices, wealth, target } : null;
  }
}

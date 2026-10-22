import { fireEvent, render, screen } from "@testing-library/preact";
import { BigNumber } from "bignumber.js";
import { expect, it, vi } from "vite-plus/test";

import { PlannerFormView } from "./planner-form-view.tsx";

function fill(values: Record<string, string>): void {
  for (const [label, value] of Object.entries(values))
    fireEvent.input(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
}

// Submit directly: browsers would block most invalid values before the handler runs.
function submit(): void {
  const form = screen.getByRole("button", { name: "Recommend" }).closest("form");
  if (form === null) throw new Error("Missing planner form");
  fireEvent.submit(form);
}

it("describes each price input, including symbols with spaces", (): void => {
  render(<PlannerFormView symbols={["AAA", "BRK B"]} onSubmit={vi.fn()} />);
  for (const symbol of ["AAA", "BRK B"]) {
    const input = screen.getByLabelText(new RegExp(`^${symbol}`));
    const description = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toBe("Price per share (USD)");
  }
});

it("reports an invalid price on its input until it is edited", (): void => {
  const onSubmit = vi.fn();
  render(<PlannerFormView symbols={["AAA"]} onSubmit={onSubmit} />);
  fill({ Wealth: "0", Concentration: "50" });
  submit();
  const price = screen.getByLabelText<HTMLInputElement>(/^AAA/);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(price.validationMessage).toBe("Enter a positive stock price.");
  expect(price.getAttribute("aria-invalid")).toBe("true");
  fill({ AAA: "20" });
  expect(price.validationMessage).toBe("");
  expect(price.hasAttribute("aria-invalid")).toBe(false);
});

it.each([
  ["AAA", "0"],
  ["Wealth", ""],
  ["Wealth", "-1"],
  ["Wealth", "1e2"],
  ["Wealth", "1.2.3"],
  ["Concentration", "100.01"],
  ["Sale date", ""],
])("rejects %s of %j", (label, value): void => {
  const onSubmit = vi.fn();
  render(<PlannerFormView symbols={["AAA"]} onSubmit={onSubmit} />);
  fill({ AAA: "20", Wealth: "0", Concentration: "50", [label]: value });
  submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByLabelText(new RegExp(`^${label}`)).getAttribute("aria-invalid")).toBe("true");
});

it("submits exact parameters at the boundaries", (): void => {
  const onSubmit = vi.fn();
  render(<PlannerFormView symbols={["AAA", "BRK B"]} onSubmit={onSubmit} />);
  fill({
    AAA: "0.01",
    "BRK B": "40",
    Wealth: "0",
    Concentration: "100",
    "Sale date": "2026-12-15",
  });
  submit();
  expect(onSubmit).toHaveBeenCalledWith({
    prices: new Map([
      ["AAA", new BigNumber("0.01")],
      ["BRK B", new BigNumber(40)],
    ]),
    wealth: new BigNumber(0),
    target: new BigNumber(100),
    saleDate: "2026-12-15",
  });
});

it("defaults the sale date to today", (): void => {
  vi.useFakeTimers({ now: new Date(2026, 0, 5, 23, 30), toFake: ["Date"] });
  try {
    render(<PlannerFormView symbols={[]} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText<HTMLInputElement>("Sale date").value).toBe("2026-01-05");
  } finally {
    vi.useRealTimers();
  }
});

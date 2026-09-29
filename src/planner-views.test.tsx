import { fireEvent, render, screen } from "@testing-library/preact";
import { expect, it, vi } from "vite-plus/test";

import { lot, parameters } from "../tests/helpers.ts";
import { LotTableView } from "./lot-table-view.tsx";
import { PlannerFormView } from "./planner-form-view.tsx";
import { SummaryView } from "./summary-view.tsx";

it("validates all parameters and safely labels each symbol", (): void => {
  const submit = vi.fn();
  render(<PlannerFormView symbols={["AAA", "<img src=x>"]} onSubmit={submit} />);
  const price = screen.getByLabelText<HTMLInputElement>(/^AAA/);
  const other = screen.getByLabelText(/^<img src=x>/);
  expect(document.querySelector("img")).toBeNull();
  expect(price.getAttribute("aria-describedby")).toBe("AAA-helper");
  expect(screen.getAllByText("Price per share (USD)")).toHaveLength(2);
  const form = screen.getByRole("button", { name: "Recommend" }).closest("form");
  if (form === null) throw new Error("Missing planner form");
  fireEvent.submit(form);
  expect(submit).not.toHaveBeenCalled();
  expect(price.validationMessage).toBe("Enter a positive stock price.");
  fireEvent.input(price, { target: { value: "20" } });
  expect(price.hasAttribute("aria-invalid")).toBe(false);
  expect(price.validationMessage).toBe("");
  fireEvent.input(other, { target: { value: "40" } });
  fireEvent.input(screen.getByLabelText("Wealth"), { target: { value: "0" } });
  fireEvent.input(screen.getByLabelText("Concentration"), { target: { value: "101" } });
  fireEvent.submit(form);
  expect(submit).not.toHaveBeenCalled();
  fireEvent.input(screen.getByLabelText("Concentration"), { target: { value: "50" } });
  fireEvent.input(form);
  fireEvent.submit(form);
  expect(submit.mock.lastCall?.[0]).toEqual({
    ...parameters(),
    prices: new Map([
      ["AAA", parameters().prices.get("AAA")],
      ["<img src=x>", parameters().prices.get("BBB")],
    ]),
  });
});

it("sorts lots while preserving their identity and focus across renders", (): void => {
  const lots = [
    lot("AAA", "2026-02-01"),
    lot("AAA", "2026-01-01", "10", "10", "2"),
    lot("AAA", "2026-01-01", "10", "10", "1", "10"),
    { ...lot("<script>", "2026-01-01", "10", "10", "1", "2"), blocked: true },
    lot("AAA", "2026-01-01", "30"),
  ];
  const onSelection = vi.fn();
  const { rerender } = render(
    <LotTableView lots={lots} prices={null} selected={new Set()} onSelection={onSelection} />,
  );
  const boxes = screen.getAllByRole<HTMLInputElement>("checkbox");
  expect(boxes.every((box) => box.disabled)).toBe(true);
  expect(
    screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.children[6]?.textContent),
  ).toEqual(["$30.00", "$10.00", "$10.00", "$10.00", "$10.00"]);
  expect(boxes[1]?.getAttribute("aria-label")).toContain("vest period 2");
  expect(document.querySelector("script")).toBeNull();
  rerender(
    <LotTableView
      lots={lots}
      prices={parameters().prices}
      selected={new Set([4])}
      onSelection={onSelection}
    />,
  );
  const first = screen.getByRole<HTMLInputElement>("checkbox", {
    name: "Plan to sell AAA, grant 1, vest period 1, 2026-01-01",
  });
  first.focus();
  rerender(
    <LotTableView
      lots={lots}
      prices={parameters().prices}
      selected={new Set()}
      onSelection={onSelection}
    />,
  );
  expect(document.activeElement).toBe(first);
  expect(first.checked).toBe(false);
  fireEvent.click(first);
  expect(onSelection).toHaveBeenCalledWith(4, true);
  expect(screen.getAllByText("$200.00")).toHaveLength(4);
  rerender(<LotTableView lots={[]} prices={null} selected={new Set()} onSelection={onSelection} />);
  expect(screen.queryByRole("checkbox")).toBeNull();
});

it("aligns dates and numeric cells and formats USD without losing precision", (): void => {
  const { rerender } = render(
    <LotTableView
      lots={[lot("AAA", "2026-01-01", "1000", "100.125")]}
      prices={parameters().prices}
      selected={new Set()}
      onSelection={vi.fn()}
    />,
  );
  const [headers, values] = screen.getAllByRole("row");
  for (const row of [headers, values]) {
    expect(row?.children[0]?.classList.contains("numeric-cell")).toBe(false);
    expect(row?.children[1]?.classList.contains("numeric-cell")).toBe(false);
    expect(row?.children[3]?.classList.contains("numeric-cell")).toBe(false);
    expect(row?.children[4]?.classList.contains("numeric-cell")).toBe(false);
    for (const index of [2, 5, 6, 7, 8]) {
      expect(row?.children[index]?.classList.contains("numeric-cell")).toBe(true);
    }
  }
  expect(values?.children[2]?.textContent).toBe("2026-01-01");
  expect(values?.children[5]?.textContent).toBe("100.125");
  expect(values?.children[6]?.textContent).toBe("$1,000.00");
  expect(values?.children[7]?.textContent).toBe("$2,002.50");
  expect(values?.children[8]?.textContent).toBe("-$98,122.50");

  rerender(
    <LotTableView
      lots={[lot("AAA", "2026-01-01", "9007199254740993.01", "1")]}
      prices={null}
      selected={new Set()}
      onSelection={vi.fn()}
    />,
  );
  expect(screen.getAllByRole("row")[1]?.children[6]?.textContent).toBe("$9,007,199,254,740,993.01");
});

it("renders the actual selection and clears stale summaries", (): void => {
  const { rerender, container } = render(
    <SummaryView lots={[lot()]} parameters={parameters()} selected={new Set()} />,
  );
  expect(screen.getByText("Selection does not meet the target")).toBeTruthy();
  rerender(<SummaryView lots={[lot()]} parameters={parameters()} selected={new Set([0])} />);
  expect(screen.getByText("Selection meets the target")).toBeTruthy();
  rerender(<SummaryView lots={[lot()]} parameters={null} selected={new Set()} />);
  expect(container.textContent).toBe("");
});

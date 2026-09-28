import { describe, expect, it, vi } from "vite-plus/test";

import { page, lot, parameters, plannerForm, enter } from "../tests/helpers.ts";
import { element } from "./dom.ts";
import { LotTableView } from "./lot-table-view.ts";
import { type Parameters } from "./planner.ts";
import { SummaryView } from "./summary-view.ts";

describe("planner views", (): void => {
  it("keeps the three planner sections collapsible", (): void => {
    page();
    expect(document.querySelector("#replace-workbook")).toBeNull();
    expect(document.querySelector("#workbook-name")).toBeNull();
    expect(document.querySelector("#configuration-status")).toBeNull();
    expect(document.querySelector("#planner-form button[type='submit']")?.textContent).toBe(
      "Update plan",
    );
    const details = [...document.querySelectorAll("#planner > details")];
    expect(details.map((section) => section.querySelector("summary")?.textContent)).toEqual([
      "Configuration",
      "Sale plan summary",
      "Lot selectors",
    ]);
    expect(details.every((section) => section.hasAttribute("open"))).toBe(true);
    expect(details[0]?.querySelector("#planner-form")).not.toBeNull();
    expect(details[1]?.querySelector("#summary")).not.toBeNull();
    expect(details[2]?.querySelector("#lot-rows")).not.toBeNull();
  });
  it("creates one safely labeled price input per symbol, validates and resets", (): void => {
    page();
    element(document, "#planner", HTMLElement).hidden = false;
    const submit = vi.fn<(parameters: Parameters) => void>();
    const form = plannerForm(submit);
    const formElement = element(document, "#planner-form", HTMLFormElement);
    form.setSymbols(["AAA", "<img src=x>"]);
    expect(document.querySelectorAll("#stock-prices input")).toHaveLength(2);
    expect(document.querySelector("#stock-prices img")).toBeNull();
    form.focus();
    expect(document.activeElement).toBe(document.querySelector("#stock-prices input"));
    enter("#wealth", "0");
    enter("#target", "101");
    enter("#stock-prices label:first-child input", "0");
    expect(submit).not.toHaveBeenCalled();
    expect(formElement.dispatchEvent(new Event("submit", { cancelable: true }))).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    expect(element(document, "#stock-prices input", HTMLInputElement).validationMessage).toBe(
      "Enter a positive stock price.",
    );
    enter("#stock-prices label:first-child input", "20");
    enter("#stock-prices label:last-child input", "40");
    enter("#target", "50");
    formElement.dispatchEvent(new Event("input", { bubbles: true }));
    expect(submit).not.toHaveBeenCalled();
    expect(formElement.dispatchEvent(new Event("submit", { cancelable: true }))).toBe(false);
    expect(submit.mock.lastCall?.[0].prices.size).toBe(2);
    form.setSymbols([]);
    form.focus();
    expect(document.activeElement?.id).toBe("wealth");
    expect(element(document, "#wealth", HTMLInputElement).value).toBe("");
  });
  it("sorts dates, grants, and numeric periods and preserves focus on updates", (): void => {
    page();
    element(document, "#planner", HTMLElement).hidden = false;
    const body = element(document, "#lot-rows", HTMLTableSectionElement);
    const change = vi.fn();
    const table = new LotTableView(body, change);
    table.setLots([
      lot("AAA", "2026-02-01"),
      lot("AAA", "2026-01-01", "10", "10", "2"),
      lot("AAA", "2026-01-01", "10", "10", "1", "10"),
      { ...lot("<script>", "2026-01-01", "10", "10", "1", "2"), blocked: true },
    ]);
    expect(body.rows.item(0)?.textContent).toContain("<script>");
    expect(body.querySelector("script")).toBeNull();
    expect(body.rows.item(0)?.textContent).toContain("Blocked");
    table.update(null, new Set());
    const checkbox = element(body, "input", HTMLInputElement);
    expect(checkbox.disabled).toBe(true);
    table.update(parameters().prices, new Set([3]));
    checkbox.focus();
    table.update(parameters().prices, new Set());
    expect(document.activeElement).toBe(checkbox);
    expect(checkbox.checked).toBe(false);
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(change).toHaveBeenCalledWith(3, true);
    body.dispatchEvent(new Event("change"));
    expect(change).toHaveBeenCalledOnce();
    expect(body.textContent).toContain("200.00");
    expect(checkbox.getAttribute("aria-label")).toContain("vest period 2");
    table.setLots([]);
    expect(body.rows).toHaveLength(0);
  });
  it("shows highest estimated basis per share first without changing selection indices", (): void => {
    page();
    const body = element(document, "#lot-rows", HTMLTableSectionElement);
    const change = vi.fn();
    const table = new LotTableView(body, change);
    table.setLots([
      lot("AAA", "2026-01-01", "10"),
      lot("AAA", "2026-03-01", "30"),
      lot("AAA", "2026-02-01", "20"),
    ]);
    expect([...body.rows].map((row) => row.cells[6]?.textContent)).toEqual([
      "30.00",
      "20.00",
      "10.00",
    ]);
    const firstRow = body.rows.item(0);
    if (firstRow === null) throw new Error("Missing highest-basis row");
    const checkbox = element(firstRow, "input", HTMLInputElement);
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(change).toHaveBeenCalledWith(1, true);
  });
  it("renders the actual selection and clears stale summaries", (): void => {
    const root = document.createElement("section");
    const summary = new SummaryView(root);
    summary.update([lot()], parameters(), new Set());
    expect(root.textContent).toContain("Selection does not meet the target");
    summary.update([lot()], parameters(), new Set([0]));
    expect(root.textContent).toContain("Selection meets the target");
    expect(root.textContent).toContain("200.00");
    summary.clear();
    expect(root.textContent).toBe("");
  });
});

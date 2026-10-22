import { fireEvent, render, screen } from "@testing-library/preact";
import readXlsxFile from "read-excel-file/browser";
import { expect, it, vi } from "vite-plus/test";

import { rowOf } from "../tests/table.ts";
import { holding, workbook } from "../tests/workbook.ts";
import { Application } from "./application.tsx";

vi.mock("read-excel-file/browser", () => ({ default: vi.fn() }));

async function importWorkbook(rows = holding()): Promise<void> {
  vi.mocked(readXlsxFile).mockResolvedValue(workbook(rows));
  render(<Application />);
  fireEvent.change(screen.getByLabelText("Workbook (.xlsx)"), {
    target: { files: [new File([], "lots.xlsx")] },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Workbook import" }));
  await screen.findByLabelText("Wealth");
}

function configure({
  price = "40",
  wealth = "0",
  target = "50",
  saleDate = "2026-12-01",
} = {}): void {
  const input = screen.queryByLabelText(/^TEST/);
  if (input !== null) fireEvent.input(input, { target: { value: price } });
  fireEvent.input(screen.getByLabelText("Wealth"), { target: { value: wealth } });
  fireEvent.input(screen.getByLabelText("Concentration"), { target: { value: target } });
  fireEvent.input(screen.getByLabelText("Sale date"), { target: { value: saleDate } });
  fireEvent.click(screen.getByRole("button", { name: "Recommend" }));
}

/** Open state of each planner section, keyed by its summary text. */
function sections(): Record<string, boolean> {
  return Object.fromEntries(
    [...document.querySelectorAll("details")].map((details): [string, boolean] => [
      details.querySelector("summary")?.textContent ?? "",
      details.open,
    ]),
  );
}

function section(title: string): HTMLDetailsElement {
  const details = screen.getByText(title, { selector: "summary" }).closest("details");
  if (details === null) throw new Error(`Missing ${title} section`);
  return details;
}

function saleTotal(): Record<string, string | undefined> {
  return rowOf(screen.getByRole("region", { name: "Sale summary" }), "Total");
}

function lotCheckbox(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>("checkbox");
}

it("replaces the import form with an unconfigured planner", async (): Promise<void> => {
  await importWorkbook();
  expect(screen.queryByLabelText("Workbook (.xlsx)")).toBeNull();
  expect(sections()).toEqual({ Configuration: true, Lots: false });
  expect(lotCheckbox().disabled).toBe(true);
});

it("recommends a sale and opens the results", async (): Promise<void> => {
  await importWorkbook();
  configure();
  expect(sections()).toEqual({ Configuration: false, Portfolio: true, Sale: true, Lots: true });
  expect(lotCheckbox().checked).toBe(true);
  expect(saleTotal()).toMatchObject({ Proceeds: "$400.00", Basis: "$250.00", Gain: "$150.00" });
});

it("updates the sale when a lot is toggled without moving focus", async (): Promise<void> => {
  await importWorkbook();
  configure();
  const checkbox = lotCheckbox();
  checkbox.focus();
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(false);
  expect(document.activeElement).toBe(checkbox);
  expect(saleTotal()).toMatchObject({ Lots: "0", Proceeds: "$0.00" });
});

it("values manual selections at the submitted price", async (): Promise<void> => {
  await importWorkbook();
  configure();
  fireEvent.click(lotCheckbox());
  const price = screen.getByLabelText(/^TEST/);
  fireEvent.input(price, { target: { value: "80" } });
  fireEvent.click(lotCheckbox());
  expect(price).toHaveProperty("value", "80");
  expect(saleTotal()).toMatchObject({ Proceeds: "$400.00" });
});

it("keeps the selection when a resubmission is invalid", async (): Promise<void> => {
  await importWorkbook();
  configure();
  fireEvent.click(lotCheckbox());
  fireEvent.input(screen.getByLabelText(/^TEST/), { target: { value: "0" } });
  const form = screen.getByRole("button", { name: "Recommend" }).closest("form");
  if (form === null) throw new Error("Missing planner form");
  fireEvent.submit(form);
  expect(lotCheckbox().checked).toBe(false);
  expect(saleTotal()).toMatchObject({ Lots: "0" });
});

it("keeps manual disclosure until the next recommendation", async (): Promise<void> => {
  await importWorkbook();
  configure();
  fireEvent.click(lotCheckbox());
  section("Sale").open = false;
  section("Configuration").open = true;
  // Toggle events are dispatched as tasks, as in browsers.
  await new Promise((resolve) => setTimeout(resolve));
  fireEvent.click(lotCheckbox());
  expect(sections()).toEqual({ Configuration: true, Portfolio: true, Sale: false, Lots: true });
  fireEvent.click(lotCheckbox());
  configure();
  expect(sections()).toEqual({ Configuration: false, Portfolio: true, Sale: true, Lots: true });
  expect(lotCheckbox().checked).toBe(true);
});

it("only offers lots vested by the sale date", async (): Promise<void> => {
  await importWorkbook([
    ...holding(),
    ...holding({ grant: "grant-2", vestDate: "2027-03-01", basis: "0" }),
  ]);
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  configure({ target: "0" });
  expect(lotCheckbox().checked).toBe(true);
  expect(saleTotal()).toMatchObject({ Lots: "1", Proceeds: "$400.00" });
  configure({ target: "0", saleDate: "2027-03-01" });
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(saleTotal()).toMatchObject({ Lots: "2", Proceeds: "$800.00" });
});

it("only asks for prices for symbols with held lots", async (): Promise<void> => {
  await importWorkbook([
    ...holding(),
    ...holding({ symbol: "EMPTY", grant: "empty-grant", sellable: "0" }),
  ]);
  expect(screen.getByLabelText(/^TEST/)).toBeTruthy();
  expect(screen.queryByLabelText(/^EMPTY/)).toBeNull();
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
});

it.each([
  ["empty", []],
  ["zero-quantity", holding({ sellable: "0" })],
])("plans a %s workbook", async (_, rows): Promise<void> => {
  await importWorkbook(rows);
  expect(screen.queryByLabelText(/^TEST/)).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  configure({ target: "0" });
  expect(saleTotal()).toEqual({
    Symbol: "Total",
    Lots: "0",
    Shares: "0",
    Proceeds: "$0.00",
    Basis: "$0.00",
    Gain: "$0.00",
  });
});

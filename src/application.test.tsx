import { fireEvent, render, screen, within } from "@testing-library/preact";
import readXlsxFile from "read-excel-file/browser";
import { expect, it, vi } from "vite-plus/test";

import { holding, workbook } from "../tests/workbook.ts";
import { Application } from "./application.tsx";

vi.mock("read-excel-file/browser", () => ({ default: vi.fn() }));

it("imports, configures, selects manually, and replaces selections on submission", async (): Promise<void> => {
  vi.mocked(readXlsxFile).mockResolvedValue(workbook());
  render(<Application />);
  fireEvent.change(screen.getByLabelText("Workbook (.xlsx)"), {
    target: { files: [new File([], "lots.xlsx")] },
  });
  fireEvent.submit(screen.getByRole("form"));
  const price = await screen.findByLabelText(/^TEST/);
  expect(screen.queryByLabelText("Workbook (.xlsx)")).toBeNull();
  const details = (): HTMLDetailsElement[] => [...document.querySelectorAll("details")];
  const titles = (): (string | null | undefined)[] =>
    details().map((section) => section.querySelector("summary")?.textContent);
  expect(titles()).toEqual(["Configuration", "Lots"]);
  expect(details().map((section) => section.open)).toEqual([true, false]);
  const checkbox = screen.getByRole<HTMLInputElement>("checkbox");
  expect(checkbox.disabled).toBe(true);
  fireEvent.input(price, { target: { value: "40" } });
  fireEvent.input(screen.getByLabelText("Wealth"), { target: { value: "0" } });
  fireEvent.input(screen.getByLabelText("Concentration"), { target: { value: "50" } });
  const update = screen.getByRole("button", { name: "Recommend" });
  fireEvent.click(update);
  expect(titles()).toEqual(["Configuration", "Portfolio", "Sale", "Lots"]);
  expect(details().map((section) => section.open)).toEqual([false, true, true, true]);
  expect(checkbox.checked).toBe(true);
  const summary = screen.getByText("Sale").closest("details");
  if (summary === null) throw new Error("Missing summary details");
  expect(
    within(summary).getByRole("row", { name: "Total 1 10 $400.00 $250.00 $150.00" }),
  ).toBeTruthy();
  summary.open = false;
  const [configuration] = details();
  if (configuration === undefined) throw new Error("Missing configuration details");
  configuration.open = true;
  // Toggle events are dispatched as tasks, as in browsers.
  await new Promise((resolve) => setTimeout(resolve));
  checkbox.focus();
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(false);
  expect(document.activeElement).toBe(checkbox);
  expect(details().map((section) => section.open)).toEqual([true, true, false, true]);
  expect(within(summary).getByRole("row", { name: "Total 0 0 $0.00 $0.00 $0.00" })).toBeTruthy();
  fireEvent.input(price, { target: { value: "80" } });
  expect(within(summary).getByRole("row", { name: /^Total / }).children[3]?.textContent).toBe(
    "$0.00",
  );
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
  expect(price).toHaveProperty("value", "80");
  expect(within(summary).getByRole("row", { name: /^Total / }).children[3]?.textContent).toBe(
    "$400.00",
  );
  fireEvent.click(checkbox);
  fireEvent.input(price, { target: { value: "0" } });
  const form = update.closest("form");
  if (form === null) throw new Error("Missing planner form");
  fireEvent.submit(form);
  expect(checkbox.checked).toBe(false);
  fireEvent.input(price, { target: { value: "40" } });
  fireEvent.click(update);
  expect(details().map((section) => section.open)).toEqual([false, true, true, true]);
  expect(checkbox.checked).toBe(true);
});

it("only asks for prices for symbols with held lots", async (): Promise<void> => {
  vi.mocked(readXlsxFile).mockResolvedValue(
    workbook([...holding(), ...holding({ symbol: "EMPTY", grant: "empty-grant", sellable: "0" })]),
  );
  render(<Application />);
  fireEvent.change(screen.getByLabelText("Workbook (.xlsx)"), {
    target: { files: [new File([], "lots.xlsx")] },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Workbook import" }));
  await screen.findByLabelText(/^TEST/);
  expect(screen.queryByLabelText(/^EMPTY/)).toBeNull();
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
});

it.each([
  ["empty", []],
  ["zero-quantity", holding({ sellable: "0" })],
])("supports a %s workbook", async (_, rows): Promise<void> => {
  vi.mocked(readXlsxFile).mockResolvedValue(workbook(rows));
  render(<Application />);
  fireEvent.change(screen.getByLabelText("Workbook (.xlsx)"), {
    target: { files: [new File([], "empty.xlsx")] },
  });
  fireEvent.submit(screen.getByRole("form"));
  const wealth = await screen.findByLabelText("Wealth");
  expect(screen.queryByLabelText(/^TEST/)).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.input(wealth, { target: { value: "0" } });
  fireEvent.input(screen.getByLabelText("Concentration"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Recommend" }));
  expect(
    within(screen.getByRole("region", { name: "Sale summary" })).getByRole("row", {
      name: "Total 0 0 $0.00 $0.00 $0.00",
    }),
  ).toBeTruthy();
});

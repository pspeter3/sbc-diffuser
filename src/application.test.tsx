import { fireEvent, render, screen, within } from "@testing-library/preact";
import readXlsxFile from "read-excel-file/browser";
import { expect, it, vi } from "vite-plus/test";

import { workbook } from "../tests/workbook.ts";
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
  const details = [...document.querySelectorAll("details")];
  expect(details.map((section) => section.open)).toEqual([true, false, false, false]);
  expect(details.map((section) => section.querySelector("summary")?.textContent)).toEqual([
    "Configuration",
    "Portfolio",
    "Sale",
    "Lots",
  ]);
  const checkbox = screen.getByRole<HTMLInputElement>("checkbox");
  expect(checkbox.disabled).toBe(true);
  const summary = screen.getByText("Sale").closest("details");
  if (summary === null) throw new Error("Missing summary details");
  expect(summary.textContent).toBe("Sale");
  fireEvent.input(price, { target: { value: "40" } });
  fireEvent.input(screen.getByLabelText("Wealth"), { target: { value: "0" } });
  fireEvent.input(screen.getByLabelText("Concentration"), { target: { value: "50" } });
  const update = screen.getByRole("button", { name: "Recommend" });
  fireEvent.click(update);
  expect(details.map((section) => section.open)).toEqual([false, true, true, true]);
  expect(checkbox.checked).toBe(true);
  expect(within(summary).queryByText("Target")).toBeNull();
  summary.open = false;
  if (details[0] === undefined) throw new Error("Missing configuration details");
  details[0].open = true;
  checkbox.focus();
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(false);
  expect(document.activeElement).toBe(checkbox);
  expect(details.map((section) => section.open)).toEqual([true, true, false, true]);
  expect(within(summary).queryByText("Target")).toBeNull();
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
  expect(details.map((section) => section.open)).toEqual([false, true, true, true]);
  expect(checkbox.checked).toBe(true);
});

it("only asks for prices for symbols with held lots", async (): Promise<void> => {
  const data = workbook();
  const excluded = workbook().flatMap((sheet) =>
    sheet.data.slice(1).map((row) => {
      const next = [...row];
      next[1] = "EMPTY";
      next[11] = "empty-grant";
      next[32] = "0";
      return next;
    }),
  );
  for (const sheet of data) sheet.data.push(...excluded);
  vi.mocked(readXlsxFile).mockResolvedValue(data);
  render(<Application />);
  fireEvent.change(screen.getByLabelText("Workbook (.xlsx)"), {
    target: { files: [new File([], "lots.xlsx")] },
  });
  fireEvent.submit(screen.getByRole("form", { name: "Workbook import" }));
  await screen.findByLabelText(/^TEST/);
  expect(screen.queryByLabelText(/^EMPTY/)).toBeNull();
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
});

it.each(["empty", "zero-quantity"])("supports a %s workbook", async (kind): Promise<void> => {
  const data = workbook();
  for (const sheet of data) {
    if (kind === "empty") sheet.data.splice(1);
    else for (const row of sheet.data.slice(1)) row[32] = "0";
  }
  vi.mocked(readXlsxFile).mockResolvedValue(data);
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
  expect(screen.queryByText("Target")).toBeNull();
});

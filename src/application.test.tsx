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
  const price = await screen.findByLabelText("TEST stock price (USD per share)");
  expect(document.activeElement).toBe(price);
  expect(screen.queryByLabelText("Workbook (.xlsx)")).toBeNull();
  expect([...document.querySelectorAll("details")].every((section) => section.open)).toBe(true);
  const checkbox = screen.getByRole<HTMLInputElement>("checkbox");
  expect(checkbox.disabled).toBe(true);
  const summary = screen.getByRole("region", { name: "Sale plan summary" });
  expect(summary.textContent).toBe("");
  fireEvent.input(price, { target: { value: "40" } });
  fireEvent.input(screen.getByLabelText(/Investable wealth/), { target: { value: "0" } });
  fireEvent.input(screen.getByLabelText(/Desired wealth/), { target: { value: "50" } });
  const update = screen.getByRole("button", { name: "Update plan" });
  fireEvent.click(update);
  expect(checkbox.checked).toBe(true);
  expect(within(summary).getByText("Selection meets the target")).toBeTruthy();
  checkbox.focus();
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(false);
  expect(document.activeElement).toBe(checkbox);
  expect(within(summary).getByText("Selection does not meet the target")).toBeTruthy();
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
  fireEvent.click(checkbox);
  fireEvent.input(price, { target: { value: "0" } });
  fireEvent.submit(screen.getByRole("form"));
  expect(checkbox.checked).toBe(false);
  fireEvent.input(price, { target: { value: "40" } });
  fireEvent.click(update);
  expect(checkbox.checked).toBe(true);
});

it("supports an empty workbook", async (): Promise<void> => {
  const data = workbook();
  for (const sheet of data) sheet.data.splice(1);
  vi.mocked(readXlsxFile).mockResolvedValue(data);
  render(<Application />);
  fireEvent.change(screen.getByLabelText("Workbook (.xlsx)"), {
    target: { files: [new File([], "empty.xlsx")] },
  });
  fireEvent.submit(screen.getByRole("form"));
  const wealth = await screen.findByLabelText(/Investable wealth/);
  expect(document.activeElement).toBe(wealth);
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.input(wealth, { target: { value: "0" } });
  fireEvent.input(screen.getByLabelText(/Desired wealth/), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Update plan" }));
  expect(screen.getByText("Selection meets the target")).toBeTruthy();
});

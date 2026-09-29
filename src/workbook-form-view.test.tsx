import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import readXlsxFile from "read-excel-file/browser";
import { beforeEach, expect, it, vi } from "vite-plus/test";

import { workbook } from "../tests/workbook.ts";
import { WorkbookFormView } from "./workbook-form-view.tsx";

vi.mock("read-excel-file/browser", () => ({ default: vi.fn() }));
beforeEach((): void => {
  vi.resetAllMocks();
});

it("reports a missing workbook", (): void => {
  render(<WorkbookFormView onParseRsuLotList={vi.fn()} />);
  const input = screen.getByLabelText("Workbook (.xlsx)");
  fireEvent.submit(screen.getByRole("form"));
  expect(screen.getByText("Choose an .xlsx workbook to import.")).toBeTruthy();
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("aria-describedby")).toBe("workbook-help workbook-file-error");
});

it("prevents duplicate imports, reports parsed lots, and restores the button", async (): Promise<void> => {
  let finish!: (value: ReturnType<typeof workbook>) => void;
  vi.mocked(readXlsxFile).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onImport = vi.fn();
  render(<WorkbookFormView onParseRsuLotList={onImport} />);
  const file = new File(["xlsx"], "lots.xlsx");
  fireEvent.change(screen.getByLabelText("Workbook (.xlsx)"), { target: { files: [file] } });
  const button = screen.getByRole<HTMLButtonElement>("button");
  fireEvent.submit(screen.getByRole("form"));
  fireEvent.submit(screen.getByRole("form"));
  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
  await waitFor(() => expect(readXlsxFile).toHaveBeenCalledOnce());
  finish(workbook());
  await waitFor(() => expect(button.disabled).toBe(false));
  expect(button.hasAttribute("aria-busy")).toBe(false);
  expect(onImport.mock.lastCall?.[0]).toHaveLength(1);
});

it("shows parser errors and recovers on retry", async (): Promise<void> => {
  vi.mocked(readXlsxFile).mockResolvedValue([]);
  render(<WorkbookFormView onParseRsuLotList={vi.fn()} />);
  const input = screen.getByLabelText("Workbook (.xlsx)");
  fireEvent.change(input, { target: { files: [new File([], "bad.xlsx")] } });
  const button = screen.getByRole<HTMLButtonElement>("button");
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText(/Missing Restricted Stock worksheet/);
  for (const error of [new Error("Invalid archive"), new Error(""), "unknown"]) {
    vi.mocked(readXlsxFile).mockRejectedValueOnce(error);
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText(
      error instanceof Error && error.message.length > 0
        ? error.message
        : "Could not read this workbook. Choose another .xlsx file.",
    );
    await waitFor(() => expect(button.disabled).toBe(false));
  }
  vi.mocked(readXlsxFile).mockResolvedValue(workbook());
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(button.disabled).toBe(false));
  expect(input.hasAttribute("aria-invalid")).toBe(false);
  expect(input.getAttribute("aria-describedby")).toBe("workbook-help");
});

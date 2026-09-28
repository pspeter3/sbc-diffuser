import readXlsxFile from "read-excel-file/browser";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { WorkbookFormView } from "./workbook-form-view.ts";

vi.mock("read-excel-file/browser", () => ({ default: vi.fn() }));

function emptyWorkbook(): { sheet: string; data: string[][] }[] {
  const headers: string[] = Array.from({ length: 62 }, () => "");
  for (const [index, label] of [
    [0, "Record Type"],
    [1, "Symbol"],
    [11, "Grant Number"],
    [18, "Vest Period"],
    [19, "Vest Date"],
    [30, "Blocked Share Qty."],
    [32, "Sellable Qty."],
    [35, "Est. Cost Basis (per share):"],
    [61, "Release Date"],
  ] as const)
    headers[index] = label;
  return [{ sheet: "Restricted Stock", data: [headers] }];
}

function ignoreImport(): void {}

function formWithFile(): {
  form: HTMLFormElement;
  input: HTMLInputElement;
  button: HTMLButtonElement;
} {
  const form = document.createElement("form");
  form.innerHTML = `
    <input id="workbook-file" type="file" name="workbook" aria-describedby="workbook-help" required>
    <small id="workbook-help">Workbook help</small>
    <button type="submit">Import</button>
  `;
  const input = form.elements.namedItem("workbook");
  const button = form.querySelector("button");
  if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) {
    throw new Error("Test form is missing its controls");
  }
  return {
    form,
    input,
    button,
  };
}

function submit(form: HTMLFormElement): boolean {
  return form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

function chooseFile(input: HTMLInputElement): File {
  const file = new File(["xlsx"], "lots.xlsx");
  Object.defineProperty(input, "files", { configurable: true, value: { item: () => file } });
  return file;
}

beforeEach((): void => {
  vi.resetAllMocks();
});

describe("WorkbookFormView", (): void => {
  it("requires a workbook input and submit button", (): void => {
    const { form, input, button } = formWithFile();
    input.remove();
    expect(() => new WorkbookFormView(form, ignoreImport)).toThrow(
      "The workbook form needs a file input and submit button",
    );

    form.append(input);
    button.remove();
    expect(() => new WorkbookFormView(form, ignoreImport)).toThrow(
      "The workbook form needs a file input and submit button",
    );
  });

  it("prompts for a missing file", async (): Promise<void> => {
    const { form, input } = formWithFile();
    new WorkbookFormView(form, ignoreImport);
    submit(form);
    await vi.waitFor((): void => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(input.nextElementSibling?.textContent).toBe("Choose an .xlsx workbook to import.");
    expect(input.getAttribute("aria-describedby")).toBe("workbook-help workbook-file-error");
  });

  it("disables the submit button while importing and restores it afterward", async (): Promise<void> => {
    const { form, input, button } = formWithFile();
    chooseFile(input);
    let finishRead: ((sheets: ReturnType<typeof emptyWorkbook>) => void) | undefined;
    const pendingRead = new Promise<ReturnType<typeof emptyWorkbook>>((resolve) => {
      finishRead = resolve;
    });
    vi.mocked(readXlsxFile).mockReturnValue(pendingRead);
    const view = new WorkbookFormView(form, ignoreImport);

    submit(form);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    submit(form);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    finishRead?.(emptyWorkbook());
    await vi.waitFor((): void => expect(button.disabled).toBe(false));
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    const focus = vi.spyOn(input, "focus");
    view.focus();
    expect(focus).toHaveBeenCalledOnce();
  });

  it("shows a parse error beside the file and clears it on reset", async (): Promise<void> => {
    const { form, input, button } = formWithFile();
    chooseFile(input);
    vi.mocked(readXlsxFile).mockResolvedValue([]);
    const view = new WorkbookFormView(form, ignoreImport);

    submit(form);
    await vi.waitFor((): void =>
      expect(input.nextElementSibling?.textContent).toContain("Missing Restricted Stock worksheet"),
    );
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(button.disabled).toBe(false);

    view.reset();
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.getAttribute("aria-describedby")).toBe("workbook-help");
    expect(input.nextElementSibling?.id).toBe("workbook-help");
    expect(button.disabled).toBe(false);
  });

  it("handles reader failures and replaces old validation text", async (): Promise<void> => {
    const { form, input, button } = formWithFile();
    chooseFile(input);
    vi.mocked(readXlsxFile).mockRejectedValue(new Error("Invalid XLSX archive"));
    new WorkbookFormView(form, ignoreImport);

    submit(form);
    await vi.waitFor((): void =>
      expect(input.nextElementSibling?.textContent).toBe("Invalid XLSX archive"),
    );
    vi.mocked(readXlsxFile).mockRejectedValueOnce(new Error(""));
    submit(form);
    await vi.waitFor((): void =>
      expect(input.nextElementSibling?.textContent).toBe(
        "Could not read this workbook. Choose another .xlsx file.",
      ),
    );
    expect(form.querySelectorAll("#workbook-file-error")).toHaveLength(1);

    vi.mocked(readXlsxFile).mockResolvedValueOnce(emptyWorkbook());
    submit(form);
    await vi.waitFor((): void => expect(button.disabled).toBe(false));
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(form.querySelector("#workbook-file-error")).toBeNull();
  });

  it("restores an input without an existing description", async (): Promise<void> => {
    const { form, input } = formWithFile();
    input.removeAttribute("aria-describedby");
    chooseFile(input);
    vi.mocked(readXlsxFile).mockRejectedValue("unrecognized failure");
    const view = new WorkbookFormView(form, ignoreImport);
    submit(form);
    await vi.waitFor((): void => expect(input.hasAttribute("aria-invalid")).toBe(true));
    expect(input.getAttribute("aria-describedby")).toBe("workbook-file-error");
    view.reset();
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });

  it("reports an unexpected submit failure", async (): Promise<void> => {
    const { form, input } = formWithFile();
    Object.defineProperty(input, "files", {
      configurable: true,
      value: {
        item: (): never => {
          throw new Error("Unexpected submit failure");
        },
      },
    });
    new WorkbookFormView(form, ignoreImport);

    submit(form);
    await vi.waitFor((): void =>
      expect(input.nextElementSibling?.textContent).toBe("Unexpected submit failure"),
    );
  });
});

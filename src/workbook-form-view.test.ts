import readXlsxFile from "read-excel-file/browser";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { parseRsuLotList } from "./parser.ts";
import { type RsuLotList } from "./schema.ts";
import { WorkbookFormView } from "./workbook-form-view.ts";

vi.mock("read-excel-file/browser", () => ({ default: vi.fn() }));
vi.mock("./parser.ts", () => ({ parseRsuLotList: vi.fn() }));

const lots: RsuLotList = [];

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
  document.body.append(form);
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
  document.body.replaceChildren();
  vi.resetAllMocks();
});

describe("WorkbookFormView", (): void => {
  it("requires the form controls", (): void => {
    const form = document.createElement("form");
    expect(() => new WorkbookFormView(form, vi.fn())).toThrow("file input and submit button");
    form.innerHTML = '<input type="file" name="workbook">';
    expect(() => new WorkbookFormView(form, vi.fn())).toThrow("file input and submit button");
  });

  it("prompts for a missing file", async (): Promise<void> => {
    const { form, input } = formWithFile();
    new WorkbookFormView(form, vi.fn());
    expect(submit(form)).toBe(false);
    await vi.waitFor((): void => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(input.nextElementSibling?.textContent).toBe("Choose an .xlsx workbook to import.");
    expect(input.getAttribute("aria-describedby")).toBe("workbook-help workbook-file-error");
    expect(readXlsxFile).not.toHaveBeenCalled();
  });

  it("reads and parses once while loading, then reports the lots", async (): Promise<void> => {
    const { form, input, button } = formWithFile();
    const file = chooseFile(input);
    let finishRead: ((sheets: []) => void) | undefined;
    vi.mocked(readXlsxFile).mockImplementation(
      () => new Promise((resolve) => (finishRead = resolve)),
    );
    vi.mocked(parseRsuLotList).mockReturnValue(lots);
    const onParseRsuLotList = vi.fn();
    const view = new WorkbookFormView(form, onParseRsuLotList);

    submit(form);
    await vi.waitFor((): void => expect(readXlsxFile).toHaveBeenCalledWith(file));
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    submit(form);
    expect(readXlsxFile).toHaveBeenCalledTimes(1);

    finishRead?.([]);
    await vi.waitFor((): void => expect(onParseRsuLotList).toHaveBeenCalledWith(lots));
    expect(parseRsuLotList).toHaveBeenCalledWith([]);
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    view.focus();
    expect(document.activeElement).toBe(input);
  });

  it("shows a parse error beside the file and clears it on reset", async (): Promise<void> => {
    const { form, input, button } = formWithFile();
    chooseFile(input);
    vi.mocked(readXlsxFile).mockResolvedValue([]);
    vi.mocked(parseRsuLotList).mockImplementation(() => {
      throw new Error("Restricted Stock row 3: invalid quantity");
    });
    const onParseRsuLotList = vi.fn();
    const view = new WorkbookFormView(form, onParseRsuLotList);

    submit(form);
    await vi.waitFor((): void =>
      expect(input.nextElementSibling?.textContent).toBe(
        "Restricted Stock row 3: invalid quantity",
      ),
    );
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(button.disabled).toBe(false);
    expect(onParseRsuLotList).not.toHaveBeenCalled();

    view.reset();
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.getAttribute("aria-describedby")).toBe("workbook-help");
    expect(input.nextElementSibling?.id).toBe("workbook-help");
    expect(button.disabled).toBe(false);
  });

  it("handles reader failures and replaces old validation text", async (): Promise<void> => {
    const { form, input } = formWithFile();
    chooseFile(input);
    vi.mocked(readXlsxFile).mockRejectedValue(new Error("Invalid XLSX archive"));
    new WorkbookFormView(form, vi.fn());

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

    vi.mocked(readXlsxFile).mockResolvedValueOnce([]);
    vi.mocked(parseRsuLotList).mockReturnValue(lots);
    submit(form);
    await vi.waitFor((): void => expect(input.hasAttribute("aria-invalid")).toBe(false));
    expect(form.querySelector("#workbook-file-error")).toBeNull();
  });

  it("restores an input without an existing description", async (): Promise<void> => {
    const { form, input } = formWithFile();
    input.removeAttribute("aria-describedby");
    chooseFile(input);
    vi.mocked(readXlsxFile).mockRejectedValue("unrecognized failure");
    const view = new WorkbookFormView(form, vi.fn());
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
    new WorkbookFormView(form, vi.fn());

    submit(form);
    await vi.waitFor((): void =>
      expect(input.nextElementSibling?.textContent).toBe("Unexpected submit failure"),
    );
  });
});

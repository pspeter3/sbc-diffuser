import readXlsxFile from "read-excel-file/browser";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { Application } from "./application.ts";

vi.mock("read-excel-file/browser", () => ({ default: vi.fn() }));

beforeEach((): void => {
  document.body.replaceChildren();
  vi.resetAllMocks();
});

describe("Application", (): void => {
  it("focuses the workbook input on startup", (): void => {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.type = "file";
    input.name = "workbook";
    const button = document.createElement("button");
    button.type = "submit";
    form.append(input, button);
    document.body.append(form);

    new Application(form);

    expect(document.activeElement).toBe(input);
  });

  it("imports a workbook through the form without showing an error", async (): Promise<void> => {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.id = "workbook-file";
    input.type = "file";
    input.name = "workbook";
    const button = document.createElement("button");
    button.type = "submit";
    form.append(input, button);
    document.body.append(form);

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
    const grant: string[] = Array.from({ length: 62 }, () => "");
    grant[0] = "Grant";
    grant[1] = "TEST";
    grant[11] = "grant-1";
    const vest = [...grant];
    vest[0] = "Vest Schedule";
    vest[18] = "1";
    vest[19] = "2026-09-01";
    const lot = [...vest];
    lot[0] = "Sellable Shares";
    lot[32] = "10";
    lot[35] = "25";
    lot[61] = "2026-09-02";
    vi.mocked(readXlsxFile).mockResolvedValue([
      { sheet: "Restricted Stock", data: [headers, grant, vest, lot] },
    ]);
    const file = new File(["xlsx"], "lots.xlsx");
    Object.defineProperty(input, "files", { value: { item: () => file } });
    new Application(form);

    expect(form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))).toBe(
      false,
    );
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    await vi.waitFor((): void => expect(button.disabled).toBe(false));
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(form.querySelector("#workbook-file-error")).toBeNull();
  });
});

import readXlsxFile from "read-excel-file/browser";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { views, parameters } from "../tests/helpers.ts";
import { Application } from "./application.ts";

vi.mock("read-excel-file/browser", () => ({ default: vi.fn() }));

beforeEach((): void => {
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
    const focus = vi.spyOn(input, "focus");

    const v = views();
    new Application(form, v.screen, v.form, v.table, v.summary);

    expect(focus).toHaveBeenCalledOnce();
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
    const v = views();
    const app = new Application(form, v.screen, v.form, v.table, v.summary);

    expect(form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))).toBe(
      false,
    );
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    await vi.waitFor((): void => expect(button.disabled).toBe(false));
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(form.querySelector("#workbook-file-error")).toBeNull();
    expect(form.hidden).toBe(true);
    expect(v.screen.hidden).toBe(false);
    const update = vi.spyOn(v.summary, "update");
    const config = parameters();
    const price = config.prices.get("AAA");
    if (price === undefined) throw new Error("Missing fixture price");
    config.prices = new Map([["TEST", price]]);
    app.select(0, true);
    expect(update).not.toHaveBeenCalled();
    app.configure(config);
    expect(update.mock.lastCall?.[2]).toEqual(new Set([0]));
    app.select(0, false);
    expect(update.mock.lastCall?.[2]).toEqual(new Set());
    app.select(0, true);
    expect(update.mock.lastCall?.[2]).toEqual(new Set([0]));
    app.select(0, false);
    app.configure(config);
    expect(update.mock.lastCall?.[2]).toEqual(new Set([0]));
    const clear = vi.spyOn(v.summary, "clear");
    app.configure(null);
    expect(clear).toHaveBeenCalledOnce();
    app.configure(config);
  });
});

import { fireEvent, render, screen } from "@testing-library/preact";
import { expect, it, vi } from "vite-plus/test";

import { lot, parameters } from "../tests/helpers.ts";
import { column } from "../tests/table.ts";
import { LotTableView } from "./lot-table-view.tsx";
import { lotKey, type RsuLotList } from "./schema.ts";

function table(): HTMLElement {
  return screen.getByRole("region", { name: "Held RSU lots" });
}

function texts(heading: string): string[] {
  return column(table(), heading).map((cell) => cell.textContent);
}

function renderTable(lots: RsuLotList, configured = true): ReturnType<typeof render> {
  return render(
    <LotTableView
      lots={lots}
      prices={configured ? parameters().prices : null}
      selected={new Set()}
      onSelection={vi.fn()}
    />,
  );
}

it("sorts by basis, then vest date, grant, and numeric vest period", (): void => {
  renderTable([
    lot({ vestDate: "2026-02-01", period: "a" }),
    lot({ grant: "2", period: "b" }),
    lot({ period: "10" }),
    lot({ period: "2" }),
    lot({ basis: "30", period: "c" }),
  ]);
  expect(texts("Period")).toEqual(["c", "2", "10", "b", "a"]);
});

it("disables selection until prices are configured", (): void => {
  renderTable([lot()], false);
  expect(screen.getByRole<HTMLInputElement>("checkbox").disabled).toBe(true);
  expect(texts("Proceeds")).toEqual(["—"]);
  expect(texts("Result")).toEqual(["—"]);
});

it("reports selections by lot key and keeps focus across renders", (): void => {
  const target = lot({ period: "1" });
  const lots = [lot(), target];
  const onSelection = vi.fn();
  const { rerender } = render(
    <LotTableView
      lots={lots}
      prices={parameters().prices}
      selected={new Set([lotKey(target)])}
      onSelection={onSelection}
    />,
  );
  const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
    name: "Plan to sell AAA, grant 1, vest period 1, 2026-01-01",
  });
  expect(checkbox.checked).toBe(true);
  checkbox.focus();
  rerender(
    <LotTableView
      lots={lots}
      prices={parameters().prices}
      selected={new Set()}
      onSelection={onSelection}
    />,
  );
  expect(document.activeElement).toBe(checkbox);
  expect(checkbox.checked).toBe(false);
  fireEvent.click(checkbox);
  expect(onSelection).toHaveBeenCalledWith(lotKey(target), true);
});

it("values lots exactly at the configured price", (): void => {
  renderTable([lot({ basis: "1000", quantity: "100.125" })]);
  expect(texts("Vest")).toEqual(["2026-01-01"]);
  expect(texts("Shares")).toEqual(["100.125"]);
  expect(texts("Basis")).toEqual(["$1,000.00"]);
  expect(texts("Proceeds")).toEqual(["$2,002.50"]);
  expect(texts("Result")).toEqual(["-$98,122.50"]);
});

it("right-aligns numeric columns", (): void => {
  renderTable([lot()]);
  const numeric = new Set(["Vest", "Shares", "Basis", "Proceeds", "Result"]);
  for (const heading of ["Sell", "Symbol", "Grant", "Period", ...numeric]) {
    const header = screen.getByRole("columnheader", { name: heading });
    for (const cell of [header, ...column(table(), heading)])
      expect(cell.classList.contains("numeric-cell")).toBe(numeric.has(heading));
  }
});

it("renders no rows without lots", (): void => {
  renderTable([]);
  expect(screen.queryByRole("checkbox")).toBeNull();
});

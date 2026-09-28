import { BigNumber } from "bignumber.js";
import { vi } from "vite-plus/test";
import * as z from "zod/mini";

import html from "../index.html?raw";
import { element } from "../src/dom.ts";
import { LotTableView } from "../src/lot-table-view.ts";
import { PlannerFormView } from "../src/planner-form-view.ts";
import { type Parameters } from "../src/planner.ts";
import { type RsuLot } from "../src/schema.ts";
import { SummaryView } from "../src/summary-view.ts";
export function views(): {
  screen: HTMLElement;
  form: PlannerFormView;
  table: LotTableView;
  summary: SummaryView;
} {
  const screen = document.createElement("section");
  const form = new PlannerFormView(
    document.createElement("form"),
    document.createElement("div"),
    document.createElement("input"),
    document.createElement("input"),
    (): void => {},
  );
  return {
    screen,
    form,
    table: new LotTableView(document.createElement("tbody"), (): void => {}),
    summary: new SummaryView(document.createElement("section")),
  };
}

export function page(): void {
  document.body.innerHTML = html;
}

export function lot(
  symbol = "AAA",
  date = "2026-01-01",
  basis = "10",
  quantity = "10",
  grant = "1",
  period = "1",
): RsuLot {
  return {
    symbol,
    vestDate: z.custom<RsuLot["vestDate"]>((v) => z.iso.date().safeParse(v).success).parse(date),
    releaseDate: z
      .custom<RsuLot["releaseDate"]>((v) => z.iso.date().safeParse(v).success)
      .parse(date),
    grantNumber: z.custom<RsuLot["grantNumber"]>((v) => typeof v === "string").parse(grant),
    vestPeriod: z.custom<RsuLot["vestPeriod"]>((v) => typeof v === "string").parse(period),
    estimatedCostBasisPerShare: new BigNumber(basis),
    quantity: new BigNumber(quantity),
    blocked: false,
  };
}
export function parameters(target = "50", wealth = "0"): Parameters {
  return {
    prices: new Map([
      ["AAA", new BigNumber(20)],
      ["BBB", new BigNumber(40)],
    ]),
    wealth: new BigNumber(wealth),
    target: new BigNumber(target),
  };
}

export function plannerForm(onSubmit = vi.fn()): PlannerFormView {
  return new PlannerFormView(
    element(document, "#planner-form", HTMLFormElement),
    element(document, "#stock-prices", HTMLElement),
    element(document, "#wealth", HTMLInputElement),
    element(document, "#target", HTMLInputElement),
    onSubmit,
  );
}
export function enter(selector: string, value: string): void {
  const input = element(document, selector, HTMLInputElement);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

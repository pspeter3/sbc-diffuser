import { Application } from "./application.ts";
import { LotTableView } from "./lot-table-view.ts";
import { PlannerFormView } from "./planner-form-view.ts";
import { SummaryView } from "./summary-view.ts";

const workbookForm = document.querySelector<HTMLFormElement>("#workbook-form")!;
const plannerScreen = document.querySelector<HTMLElement>("#planner")!;
const plannerForm = new PlannerFormView(
  document.querySelector<HTMLFormElement>("#planner-form")!,
  document.querySelector<HTMLElement>("#stock-prices")!,
  document.querySelector<HTMLInputElement>("#wealth")!,
  document.querySelector<HTMLInputElement>("#target")!,
  (parameters): void => application.configure(parameters),
);
const table = new LotTableView(
  document.querySelector<HTMLTableSectionElement>("#lot-rows")!,
  (index, checked): void => application.select(index, checked),
);
const summary = new SummaryView(document.querySelector<HTMLElement>("#summary")!);
const application = new Application(workbookForm, plannerScreen, plannerForm, table, summary);

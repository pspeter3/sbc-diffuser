import { type LotTableView } from "./lot-table-view.ts";
import { type PlannerFormView } from "./planner-form-view.ts";
import { type Parameters, recommend } from "./planner.ts";
import { type RsuLotList } from "./schema.ts";
import { type SummaryView } from "./summary-view.ts";
import { WorkbookFormView } from "./workbook-form-view.ts";

export class Application {
  readonly #workbookFormView: WorkbookFormView;
  readonly #importScreen: HTMLFormElement;
  readonly #plannerScreen: HTMLElement;
  readonly #plannerForm: PlannerFormView;
  readonly #table: LotTableView;
  readonly #summary: SummaryView;
  #lots: RsuLotList = [];
  #parameters: Parameters | null = null;
  #selected = new Set<number>();

  constructor(
    workbookForm: HTMLFormElement,
    plannerScreen: HTMLElement,
    plannerForm: PlannerFormView,
    table: LotTableView,
    summary: SummaryView,
  ) {
    this.#importScreen = workbookForm;
    this.#plannerScreen = plannerScreen;
    this.#plannerForm = plannerForm;
    this.#table = table;
    this.#summary = summary;
    this.#workbookFormView = new WorkbookFormView(workbookForm, (lots): void => {
      this.#lots = lots.filter((lot) => lot.quantity.gt(0));
      this.#plannerForm.setSymbols([...new Set(lots.map((lot) => lot.symbol))].sort());
      this.#table.setLots(this.#lots);
      this.configure(null);
      this.#importScreen.hidden = true;
      this.#plannerScreen.hidden = false;
      this.#plannerForm.focus();
    });
    this.#workbookFormView.focus();
  }

  configure(parameters: Parameters | null): void {
    this.#parameters = parameters;
    this.#selected = parameters === null ? new Set() : recommend(this.#lots, parameters);
    this.#table.update(parameters?.prices ?? null, this.#selected);
    this.#renderSummary();
  }

  select(index: number, checked: boolean): void {
    if (this.#parameters === null) return;
    if (checked) this.#selected.add(index);
    else this.#selected.delete(index);
    this.#renderSummary();
  }

  #renderSummary(): void {
    if (this.#parameters === null) this.#summary.clear();
    else this.#summary.update(this.#lots, this.#parameters, this.#selected);
  }
}

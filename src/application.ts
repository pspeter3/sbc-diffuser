import { WorkbookFormView } from "./workbook-form-view.ts";

export class Application {
  readonly #workbookFormView: WorkbookFormView;

  constructor(workbookForm: HTMLFormElement) {
    this.#workbookFormView = new WorkbookFormView(workbookForm, (): void => {});
    this.#workbookFormView.focus();
  }
}

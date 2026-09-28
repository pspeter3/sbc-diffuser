import { type RsuLotList } from "./schema.ts";
import { WorkbookFormView } from "./workbook-form-view.ts";

export class Application {
  readonly #workbookFormView: WorkbookFormView;
  #rsuLotList: RsuLotList | null = null;

  constructor(workbookForm: HTMLFormElement) {
    this.#workbookFormView = new WorkbookFormView(workbookForm, (lots): void => {
      this.#rsuLotList = lots;
    });
    this.#workbookFormView.focus();
  }

  get rsuLotList(): RsuLotList | null {
    return this.#rsuLotList;
  }
}

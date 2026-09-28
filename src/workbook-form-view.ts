import { type RsuLotList } from "./schema.ts";

export type OnParseRsuLotList = (lots: RsuLotList, filename: string) => void;

export class WorkbookFormView {
  readonly #form: HTMLFormElement;
  readonly #onParseRsuLotList: OnParseRsuLotList;
  readonly #fileInput: HTMLInputElement;
  readonly #submitButton: HTMLButtonElement;
  readonly #originalDescription: string | null;
  #errorHelper: HTMLElement | null = null;
  #loading = false;

  constructor(form: HTMLFormElement, onParseRsuLotList: OnParseRsuLotList) {
    this.#form = form;
    this.#onParseRsuLotList = onParseRsuLotList;
    const fileInput = form.elements.namedItem("workbook");
    const submitButton = form.querySelector("button[type='submit']");
    if (!(fileInput instanceof HTMLInputElement) || !(submitButton instanceof HTMLButtonElement)) {
      throw new Error("The workbook form needs a file input and submit button");
    }
    this.#fileInput = fileInput;
    this.#submitButton = submitButton;
    this.#originalDescription = fileInput.getAttribute("aria-describedby");
    form.addEventListener("submit", (event): void => {
      event.preventDefault();
      this.#submit().catch((error: unknown): void => this.#setError(error));
    });
  }

  #setLoading(loading: boolean): void {
    this.#loading = loading;
    this.#submitButton.disabled = loading;
    if (loading) this.#submitButton.setAttribute("aria-busy", "true");
    else this.#submitButton.removeAttribute("aria-busy");
  }

  #setError(error: unknown): void {
    this.#errorHelper?.remove();
    this.#errorHelper = null;
    if (error === null) {
      this.#fileInput.removeAttribute("aria-invalid");
      if (this.#originalDescription === null) this.#fileInput.removeAttribute("aria-describedby");
      else this.#fileInput.setAttribute("aria-describedby", this.#originalDescription);
      return;
    }

    const helper = document.createElement("small");
    helper.id = `${this.#fileInput.id}-error`;
    helper.textContent =
      error instanceof Error && error.message.length > 0
        ? error.message
        : "Could not read this workbook. Choose another .xlsx file.";
    this.#fileInput.setAttribute("aria-invalid", "true");
    this.#fileInput.setAttribute(
      "aria-describedby",
      [this.#originalDescription, helper.id].filter((part) => part !== null).join(" "),
    );
    this.#fileInput.insertAdjacentElement("afterend", helper);
    this.#errorHelper = helper;
  }

  reset(): void {
    this.#form.reset();
    this.#setError(null);
    this.#setLoading(false);
  }

  focus(): void {
    this.#fileInput.focus();
  }

  async #submit(): Promise<void> {
    if (this.#loading) return;
    const file = this.#fileInput.files?.item(0);
    if (file === null || file === undefined) {
      this.#setError(new Error("Choose an .xlsx workbook to import."));
      return;
    }

    this.#setError(null);
    this.#setLoading(true);
    try {
      const [{ default: readXlsxFile }, { parseRsuLotList }] = await Promise.all([
        import("read-excel-file/browser"),
        import("./parser.ts"),
      ]);
      this.#onParseRsuLotList(parseRsuLotList(await readXlsxFile(file)), file.name);
    } catch (error) {
      this.#setError(error);
    } finally {
      this.#setLoading(false);
    }
  }
}

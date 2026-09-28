import { expect, it } from "vite-plus/test";

import { page } from "../tests/helpers.ts";
import { element } from "./dom.ts";

it("requires correctly typed DOM elements", (): void => {
  page();
  expect(element(document, "#workbook-form", HTMLFormElement)).toBeInstanceOf(HTMLFormElement);
  expect(() => element(document, "#missing", HTMLElement)).toThrow("Missing element");
  expect(() => element(document, "#workbook-form", HTMLInputElement)).toThrow("Missing element");
});

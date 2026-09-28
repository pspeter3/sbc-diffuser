import { beforeEach, describe, expect, it } from "vite-plus/test";

import { Application } from "./application.ts";

beforeEach((): void => {
  document.body.replaceChildren();
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
});

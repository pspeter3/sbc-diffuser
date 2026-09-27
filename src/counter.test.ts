import { describe, expect, it } from "vite-plus/test";

import { setupCounter } from "./counter.ts";

describe("setupCounter", (): void => {
  it("starts at zero and increments when clicked", (): void => {
    const button = document.createElement("button");

    setupCounter(button);

    expect(button.innerHTML).toBe("Count is 0");

    button.click();
    expect(button.innerHTML).toBe("Count is 1");

    button.click();
    expect(button.innerHTML).toBe("Count is 2");
  });
});

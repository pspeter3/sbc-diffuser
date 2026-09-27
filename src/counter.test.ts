import { describe, expect, it } from "vite-plus/test";

import { setupCounter } from "./counter.ts";

describe("setupCounter", () => {
  it("starts at zero and increments when clicked", () => {
    const button = Object.assign(new EventTarget(), { innerHTML: "" });

    setupCounter(button as HTMLButtonElement);

    expect(button.innerHTML).toBe("Count is 0");

    button.dispatchEvent(new Event("click"));
    expect(button.innerHTML).toBe("Count is 1");

    button.dispatchEvent(new Event("click"));
    expect(button.innerHTML).toBe("Count is 2");
  });
});

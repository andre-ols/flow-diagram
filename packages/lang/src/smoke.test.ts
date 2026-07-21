import { describe, expect, it } from "vitest";
import { LANG_VERSION } from "./index";

describe("test harness", () => {
  it("runs tests in @flow/lang", () => {
    expect(LANG_VERSION).toBe("0.1.0");
  });
});

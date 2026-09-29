import { describe, expect, it } from "vitest";
import { parseFeedbackInput } from "./feedback";

describe("feedback input", () => {
  it("trims valid input", () => {
    expect(
      parseFeedbackInput({
        category: "feature",
        description: "  Useful details  ",
        title: "  Better search  ",
      }),
    ).toEqual({
      category: "feature",
      description: "Useful details",
      title: "Better search",
    });
  });

  it("rejects invalid fields", () => {
    expect(() =>
      parseFeedbackInput({
        category: "other",
        description: "Useful details",
        title: "Better search",
      }),
    ).toThrow();
    expect(() =>
      parseFeedbackInput({ description: "Details", title: "" }),
    ).toThrow();
    expect(() =>
      parseFeedbackInput({
        description: "x".repeat(5001),
        title: "Too much detail",
      }),
    ).toThrow();
  });
});

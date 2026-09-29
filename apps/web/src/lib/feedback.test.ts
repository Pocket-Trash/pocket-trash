import { describe, expect, it } from "vitest";
import {
  parseFeedbackInput,
  parseFeedbackListInput,
  parseFeedbackTitleInput,
} from "./feedback";

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

describe("feedback discovery input", () => {
  it("normalizes search, pagination, and duplicate titles", () => {
    expect(parseFeedbackListInput(undefined)).toEqual({
      offset: 0,
      search: "",
    });
    expect(
      parseFeedbackListInput({ offset: 30, search: "  saved searches  " }),
    ).toEqual({ offset: 30, search: "saved searches" });
    expect(parseFeedbackTitleInput({ title: "  Saved searches  " })).toEqual({
      title: "Saved searches",
    });
  });

  it("rejects invalid search and pagination", () => {
    expect(() => parseFeedbackListInput({ offset: -1 })).toThrow();
    expect(() => parseFeedbackListInput({ search: "x".repeat(121) })).toThrow();
    expect(() => parseFeedbackTitleInput({ title: "" })).toThrow();
  });
});

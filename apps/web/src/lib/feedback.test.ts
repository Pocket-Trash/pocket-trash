import { describe, expect, it } from "vitest";
import {
  parseAdminFeedbackListInput,
  parseFeedbackInput,
  parseFeedbackListInput,
  parseFeedbackTitleInput,
  parsePlanFeedbackInput,
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

describe("admin feedback input", () => {
  it("accepts each view's supported filters and sort limits", () => {
    expect(
      parseAdminFeedbackListInput(
        {
          offset: 30,
          search: "  mobile app  ",
          sort: [
            { direction: "desc", field: "status" },
            { direction: "asc", field: "title" },
          ],
        },
        "active",
      ),
    ).toEqual({
      offset: 30,
      search: "mobile app",
      sort: [
        { direction: "desc", field: "status" },
        { direction: "asc", field: "title" },
      ],
    });
    expect(
      parseAdminFeedbackListInput({ statuses: ["completed"] }, "archive"),
    ).toEqual({ offset: 0, search: "", sort: [], statuses: ["completed"] });
  });

  it("rejects unsupported, duplicate, or excessive sorts", () => {
    expect(() =>
      parseAdminFeedbackListInput(
        { sort: [{ direction: "asc", field: "votes" }] },
        "pending",
      ),
    ).toThrow();
    expect(() =>
      parseAdminFeedbackListInput(
        {
          sort: [
            { direction: "asc", field: "title" },
            { direction: "desc", field: "title" },
          ],
        },
        "active",
      ),
    ).toThrow();
    expect(() =>
      parseAdminFeedbackListInput({ statuses: ["requested"] }, "archive"),
    ).toThrow();
  });

  it("validates Linear planning input", () => {
    expect(
      parsePlanFeedbackInput({
        assignToMe: false,
        clientUuid: "11111111-1111-4111-8111-111111111111",
        feedbackId: 42,
        kind: "issue",
        labelIds: ["22222222-2222-4222-8222-222222222222"],
        leadProject: false,
      }),
    ).toEqual({
      assignToMe: false,
      clientUuid: "11111111-1111-4111-8111-111111111111",
      feedbackId: 42,
      kind: "issue",
      labelIds: ["22222222-2222-4222-8222-222222222222"],
      leadProject: false,
    });
    expect(() =>
      parsePlanFeedbackInput({
        assignToMe: false,
        clientUuid: "not-a-uuid",
        feedbackId: 42,
        kind: "existing",
        labelIds: [],
        leadProject: false,
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

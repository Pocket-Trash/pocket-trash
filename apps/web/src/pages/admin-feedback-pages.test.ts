import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleAdminSearch } from "./admin-feedback-pages";

afterEach(() => vi.useRealTimers());

describe("admin feedback search", () => {
  it("runs only the latest search after 150 milliseconds", () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const first = scheduleAdminSearch(undefined, search);
    scheduleAdminSearch(first, search);

    vi.advanceTimersByTime(149);
    expect(search).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(search).toHaveBeenCalledOnce();
  });
});

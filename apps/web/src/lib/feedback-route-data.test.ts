import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadActiveFeedbackSnapshot,
  loadAdminFeedbackSnapshot,
  loadCompletedFeedbackSnapshot,
  loadFeedbackNotificationsSnapshot,
  loadMyFeedbackSnapshot,
} from "./feedback";

/** Authorized feedback readers and account boundaries. */
const service = vi.hoisted(() => ({
  viewer: vi.fn(),
  admin: vi.fn(),
  listActive: vi.fn(),
  listCompleted: vi.fn(),
  listMine: vi.fn(),
  listPending: vi.fn(),
  listAdminActive: vi.fn(),
  listArchive: vi.fn(),
  listMergeTargets: vi.fn(),
  listNotifications: vi.fn(),
}));
vi.mock("@/lib/resources", () => ({ requireResourceUploader: service.viewer }));
vi.mock("@/lib/authorization", () => ({ requirePermission: service.admin }));
vi.mock("@/lib/services", () => ({ s: { db: { feedback: service } } }));
vi.mock("@tanstack/react-start", () => ({
  /** Exposes server callbacks while retaining their trust-boundary validator.
   * @returns Existing server-function declaration chain. */
  createServerFn: () => {
    /** Retains an input until its declared validator is registered.
     * @param input - Existing request input.
     * @returns The original request input. */
    let validate = (input: unknown): unknown => input;

    /** Existing declaration chain. */
    const chain = {
      /** Registers the original trust-boundary validator.
       * @param validator - Existing input validator.
       * @returns Existing declaration chain. */
      validator: (validator: (input: unknown) => unknown) => {
        validate = validator;
        return chain;
      },

      /** Exposes the authorized handler without transport.
       * @param callback - Existing authorized server callback.
       * @returns Validated server request fixture. */
      handler:
        (
          callback: (input: {
            /** Validated request data. */
            data: unknown;
          }) => Promise<unknown>,
        ) =>
        (input?: {
          /** Existing request data. */
          data?: unknown;
        }) =>
          callback({ data: validate(input?.data) }),
    };
    return chain;
  },
}));

describe("account-bound feedback route data", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    service.viewer.mockResolvedValue({ clerkId: "user_a" });
    service.admin.mockResolvedValue({ clerkId: "admin_a" });
    service.listActive.mockResolvedValue([]);
    service.listCompleted.mockResolvedValue([]);
    service.listMine.mockResolvedValue({ hasNext: false, items: [] });
    service.listPending.mockResolvedValue({ hasNext: false, items: [] });
    service.listAdminActive.mockResolvedValue({ hasNext: false, items: [] });
    service.listArchive.mockResolvedValue({ hasNext: false, items: [] });
    service.listMergeTargets.mockResolvedValue([]);
    service.listNotifications.mockResolvedValue([]);
  });
  it("binds public vote snapshots and private history to the account authorizing the exact lookup", async () => {
    expect(await loadActiveFeedbackSnapshot()).toEqual({
      actorId: "user_a",
      initialItems: [],
    });
    expect(service.listActive).toHaveBeenCalledExactlyOnceWith("user_a", "");
    expect(await loadCompletedFeedbackSnapshot()).toEqual({
      actorId: "user_a",
      initialItems: [],
    });
    expect(service.listCompleted).toHaveBeenCalledExactlyOnceWith("user_a", "");
    expect(await loadMyFeedbackSnapshot()).toEqual({
      actorId: "user_a",
      initialPage: { hasNext: false, items: [] },
    });
    expect(service.listMine).toHaveBeenCalledExactlyOnceWith("user_a", {
      offset: 0,
      search: "",
    });
  });
  it("retains each admin scope, related merge choices, archive filters, and notification authorization", async () => {
    expect(await loadAdminFeedbackSnapshot({ data: "pending" })).toEqual(
      expect.objectContaining({
        actorId: "admin_a",
        mergeTargets: [],
        archiveStatuses: [],
      }),
    );
    expect(service.listPending).toHaveBeenCalledExactlyOnceWith({ offset: 0 });
    expect(service.listMergeTargets).toHaveBeenCalledOnce();
    await loadAdminFeedbackSnapshot({ data: "planned" });
    expect(service.listAdminActive).toHaveBeenLastCalledWith({
      offset: 0,
      statuses: ["requested", "planned", "in_progress"],
    });
    await loadAdminFeedbackSnapshot({ data: "allActive" });
    expect(service.listAdminActive).toHaveBeenLastCalledWith({ offset: 0 });
    expect(await loadAdminFeedbackSnapshot({ data: "archive" })).toEqual(
      expect.objectContaining({
        archiveStatuses: expect.arrayContaining(["completed", "canceled"]),
      }),
    );
    expect(service.listArchive).toHaveBeenCalledExactlyOnceWith({
      offset: 0,
      statuses: [],
    });
    expect(await loadFeedbackNotificationsSnapshot()).toEqual({
      actorId: "admin_a",
      initialNotifications: [],
    });
    expect(service.admin).toHaveBeenCalledWith("feedback.manage");
  });
  it("rejects invalid scopes and unauthorized requests before reading private feedback", async () => {
    expect(() => loadAdminFeedbackSnapshot({ data: "unknown" })).toThrow();
    expect(service.admin).not.toHaveBeenCalled();
    service.admin.mockRejectedValue(new Error("Denied"));
    service.viewer.mockRejectedValue(new Error("Signed out"));
    await expect(
      loadAdminFeedbackSnapshot({ data: "pending" }),
    ).rejects.toThrow("Denied");
    await expect(loadFeedbackNotificationsSnapshot()).rejects.toThrow("Denied");
    await expect(loadMyFeedbackSnapshot()).rejects.toThrow("Signed out");
    expect(service.listPending).not.toHaveBeenCalled();
    expect(service.listNotifications).not.toHaveBeenCalled();
    expect(service.listMine).not.toHaveBeenCalled();
  });
  it("propagates loader failures without returning another account's data", async () => {
    service.listMine.mockRejectedValue(new Error("History unavailable"));
    service.listMergeTargets.mockRejectedValue(
      new Error("Targets unavailable"),
    );
    await expect(loadMyFeedbackSnapshot()).rejects.toThrow(
      "History unavailable",
    );
    await expect(
      loadAdminFeedbackSnapshot({ data: "pending" }),
    ).rejects.toThrow("Targets unavailable");
  });
});

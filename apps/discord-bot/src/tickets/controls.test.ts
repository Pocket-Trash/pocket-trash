import { describe, expect, it, vi } from "vitest";
import {
  createTicketControls,
  renderTicketControls,
  renderTicketModal,
  type TicketInteraction,
} from "./controls.js";
import type { TicketOperation } from "./model.js";

/** Completed synthetic operation; no live Discord or Linear writes. */
const operation: TicketOperation = {
  version: 1,
  threadId: "223456789012345678",
  issueId: "test-issue",
  issueUrl: "https://linear.app/pocket-trash/issue/ENG-9999",
  kind: "bug",
  priority: 2,
  phase: "persisted",
  commentIds: [],
};
/**
 * Builds observable authorization, acknowledgement and persistence boundaries.
 * @returns A manually dispatched staff interaction and recoverable engine mocks.
 */
function fixture() {
  const persistence = {
    lookup: vi
      .fn<() => Promise<TicketOperation | undefined>>()
      .mockResolvedValue(operation),
    persist: vi.fn().mockResolvedValue(operation),
    finalize: vi.fn().mockResolvedValue(undefined),
  };
  const present = vi.fn().mockResolvedValue(undefined);
  const peek = vi.fn().mockReturnValue({ priority: 2 });
  const interaction: TicketInteraction = {
    customId: "ticket:v1:button:bug",
    type: "button",
    threadId: operation.threadId,
    inScope: true,
    memberRoleIds: ["owner"],
    priority: "4",
    staffNote: "private staff note",
    reply: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined),
    defer: vi.fn().mockResolvedValue(undefined),
    edit: vi.fn().mockResolvedValue(undefined),
  };
  return {
    persistence,
    present,
    peek,
    interaction,
    controls: createTicketControls({
      ownerRoleId: "owner",
      persistence,
      present,
      classifier: { peek },
    }),
  };
}

describe("staff ticket controls", () => {
  it("refuses moderators and foreign/archived threads without touching persistence or advice", async () => {
    const f = fixture();
    await f.controls.dispatch({
      ...f.interaction,
      memberRoleIds: ["moderator"],
    });
    expect(f.interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
    await f.controls.dispatch({ ...f.interaction, inScope: false });
    expect(f.interaction.showModal).not.toHaveBeenCalled();
    expect(f.persistence.persist).not.toHaveBeenCalled();
    expect(f.peek).not.toHaveBeenCalled();
  });
  it("opens the modal immediately using only cached priority, without persistence", async () => {
    const f = fixture();
    await f.controls.dispatch(f.interaction);
    const modal = vi
      .mocked(f.interaction.showModal)
      .mock.calls[0]?.[0].toJSON();
    expect(JSON.stringify(modal)).toContain('"value":"2","default":true');
    expect(f.persistence.lookup).not.toHaveBeenCalled();
    expect(f.persistence.persist).not.toHaveBeenCalled();
    expect(f.interaction.defer).not.toHaveBeenCalled();
    expect(renderTicketModal("feature", 2).toJSON().components).toHaveLength(1);
    expect(JSON.stringify(renderTicketModal("bug").toJSON())).toContain(
      '"value":"0","default":true',
    );
  });
  it("defers before persistence, preserves submitted values and compacts only after presentation", async () => {
    const f = fixture();
    await f.controls.dispatch({
      ...f.interaction,
      type: "submit",
      customId: "ticket:v1:submit:bug",
    });
    expect(f.persistence.persist).toHaveBeenCalledWith({
      threadId: operation.threadId,
      kind: "bug",
      priority: 4,
      staffNote: "private staff note",
    });
    expect(
      vi.mocked(f.interaction.defer).mock.invocationCallOrder[0],
    ).toBeLessThan(f.persistence.persist.mock.invocationCallOrder[0] ?? 0);
    expect(f.present.mock.invocationCallOrder[0]).toBeLessThan(
      f.persistence.finalize.mock.invocationCallOrder[0] ?? 0,
    );
    expect(f.peek).not.toHaveBeenCalled();
    expect(f.interaction.edit).toHaveBeenCalledWith(
      expect.stringContaining(operation.issueUrl ?? ""),
    );
  });
  it("keeps feature priority zero and rejects forged bug priority after acknowledgement", async () => {
    const f = fixture();
    await f.controls.dispatch({
      ...f.interaction,
      type: "submit",
      customId: "ticket:v1:submit:feature",
    });
    expect(f.persistence.persist).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "feature", priority: 0 }),
    );
    f.persistence.persist.mockClear();
    await f.controls.dispatch({
      ...f.interaction,
      type: "submit",
      customId: "ticket:v1:submit:bug",
      priority: "9",
    });
    expect(f.persistence.persist).not.toHaveBeenCalled();
    expect(f.interaction.edit).toHaveBeenLastCalledWith(
      expect.stringContaining("retry"),
    );
  });
  it("does not finalize partial Discord failure and repairs successfully on retry", async () => {
    const f = fixture();
    f.present.mockRejectedValueOnce(
      new Error("Private provider detail must not be displayed"),
    );
    await f.controls.dispatch({
      ...f.interaction,
      type: "submit",
      customId: "ticket:v1:submit:bug",
    });
    expect(f.persistence.finalize).not.toHaveBeenCalled();
    expect(f.interaction.edit).toHaveBeenCalledWith(
      expect.not.stringContaining("Private provider"),
    );
    await f.controls.reconcile(operation.threadId);
    expect(f.persistence.finalize).toHaveBeenCalledTimes(1);
  });
  it("does not finalize or create when startup finds processing or no work", async () => {
    const f = fixture();
    f.persistence.lookup
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ ...operation, phase: "processing" });
    await f.controls.reconcile(operation.threadId);
    await f.controls.reconcile(operation.threadId);
    expect(f.present).toHaveBeenCalledWith(operation.threadId, undefined);
    expect(f.persistence.finalize).not.toHaveBeenCalled();
    expect(f.persistence.persist).not.toHaveBeenCalled();
  });
  it("re-reads after a concurrent stale startup repair rather than skipping finalization", async () => {
    const f = fixture();
    /** Releases the synthetic pending presentation write. */
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    f.persistence.lookup
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(operation);
    f.present.mockImplementationOnce(() => pending);
    const first = f.controls.reconcile(operation.threadId);
    const second = f.controls.reconcile(operation.threadId);
    finish();
    await Promise.all([first, second]);
    expect(f.present).toHaveBeenNthCalledWith(2, operation.threadId, operation);
    expect(f.persistence.finalize).toHaveBeenCalledTimes(1);
  });
  it("always renders both actions and disables both only with a completed issue link", () => {
    const enabled = JSON.stringify(
      renderTicketControls().components[0]?.toJSON(),
    );
    expect(enabled).toContain("Bug ticket");
    expect(enabled).toContain("Feature ticket");
    expect(enabled.match(/"disabled":false/gu)).toHaveLength(2);
    const disabled = JSON.stringify(
      renderTicketControls(operation.issueUrl).components[0]?.toJSON(),
    );
    expect(disabled.match(/"disabled":true/gu)).toHaveLength(2);
    expect(disabled).toContain(operation.issueUrl);
  });
});

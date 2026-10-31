/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  type EffectEntity,
  type EffectReducer,
  useEffectReducer,
} from "use-effect-reducer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Explicit start and terminal events in the compatibility probe. */
type WorkEvent = { /** Workflow transition. */ type: "start" | "finish" };
/** Effect descriptor exercised through the dependency's public API. */
type WorkEffect = {
  /** Starts the probe's disposable operation. */
  type: "work";
};
/** Active effect retained until the terminal event stops it. */
type WorkState = {
  /** Pending committed work. */
  work: EffectEntity<WorkState, WorkEvent> | undefined;
};
/** Work started by a committed effect rather than render. */
const started = vi.fn<(label: string, signal: AbortSignal) => void>();
/** Resource disposal reported by the effect cleanup. */
const cleaned = vi.fn();

/**
 * Queues replacement work or explicitly stops a completed operation.
 *
 * @param state - Currently active work.
 * @param event - Start or terminal event.
 * @param exec - Committed effect queue.
 * @returns The active work after the transition.
 */
const reducer: EffectReducer<WorkState, WorkEvent, WorkEffect> = (
  state,
  event,
  exec,
) => {
  if (event.type === "start") {
    return { work: exec.replace(state.work, { type: "work" }) };
  }
  exec.stop(state.work);
  return { work: undefined };
};

/**
 * Exposes the dependency's public workflow and lifecycle contracts.
 *
 * @param props - Current committed effect input.
 * @param props.label - Prop read when work starts.
 * @returns Start/finish controls and observable terminal state.
 */
function Probe({ label }: { /** Current effect input. */ label: string }) {
  const [state, dispatch] = useEffectReducer(
    reducer,
    (exec) => ({ work: exec({ type: "work" }) }),
    {
      /**
       * Records committed work and supplies a disposable resource.
       *
       * @param _state - Committed probe state.
       * @param _effect - Queued effect descriptor.
       * @param _dispatch - Workflow event dispatcher.
       * @param context - Effect lifetime.
       * @param context.signal - Aborted when the effect stops.
       * @returns Resource disposal callback.
       */
      work: (_state, _effect, _dispatch, { signal }) => {
        started(label, signal);
        return cleaned;
      },
    },
  );
  return (
    <>
      <button onClick={() => dispatch("start")} type="button">
        Start
      </button>
      <button onClick={() => dispatch("finish")} type="button">
        Finish
      </button>
      <output>{state.work ? "pending" : "done"}</output>
    </>
  );
}

describe("use-effect-reducer compatibility", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    started.mockClear();
    cleaned.mockClear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("runs only after commit, replacing and disposing work through StrictMode and unmount", async () => {
    expect(renderToString(<Probe label="server" />)).toContain("pending");
    expect(started).not.toHaveBeenCalled();
    await act(async () =>
      root.render(
        <StrictMode>
          <Probe label="first" />
        </StrictMode>,
      ),
    );
    expect(started).toHaveBeenCalledTimes(2);
    expect(started.mock.calls[0]?.[1].aborted).toBe(true);
    expect(started.mock.calls[1]?.[1].aborted).toBe(false);
    expect(cleaned).toHaveBeenCalledTimes(1);
    await act(async () =>
      root.render(
        <StrictMode>
          <Probe label="latest" />
        </StrictMode>,
      ),
    );
    expect(started).toHaveBeenCalledTimes(2);
    await act(async () => container.querySelector("button")?.click());
    expect(started.mock.calls[1]?.[1].aborted).toBe(true);
    expect(started.mock.lastCall?.[0]).toBe("latest");
    expect(started.mock.lastCall?.[1].aborted).toBe(false);
    await act(async () => root.render(null));
    expect(started.mock.lastCall?.[1].aborted).toBe(true);
    expect(cleaned).toHaveBeenCalledTimes(3);
  });

  it("resumes pending Activity work but never repeats a completed operation", async () => {
    await renderActivity("hidden");
    expect(started).not.toHaveBeenCalled();
    await renderActivity("visible");
    expect(started).toHaveBeenCalledTimes(1);
    await renderActivity("hidden");
    expect(started.mock.calls[0]?.[1].aborted).toBe(true);
    await renderActivity("visible");
    expect(started).toHaveBeenCalledTimes(2);
    expect(started.mock.lastCall?.[1].aborted).toBe(false);
    await act(async () => container.querySelectorAll("button")[1]?.click());
    expect(container.querySelector("output")?.textContent).toBe("done");
    expect(started.mock.lastCall?.[1].aborted).toBe(true);
    expect(cleaned).toHaveBeenCalledTimes(2);
    await renderActivity("hidden");
    await renderActivity("visible");
    expect(started).toHaveBeenCalledTimes(2);
    expect(container.querySelector("output")?.textContent).toBe("done");
  });

  /**
   * Changes visibility while preserving the mounted probe's state.
   *
   * @param mode - Activity visibility.
   * @returns Completion of the committed visibility transition.
   */
  async function renderActivity(mode: "visible" | "hidden") {
    await act(async () =>
      root.render(
        <Activity mode={mode}>
          <Probe label="activity" />
        </Activity>,
      ),
    );
  }
});

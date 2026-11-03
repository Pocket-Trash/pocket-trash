/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewportWidth } from "./use-browser-layout";
import { useKeyboardInset } from "./use-keyboard-inset";
import { useIsMobile } from "./use-mobile";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Exposes the public browser hooks through stable content and an editable control.
 * @param props - Keyboard observation status.
 * @returns Current layout measurements.
 */
function Probe({
  enabled = true,
}: {
  /** Whether keyboard tracking is active. */ enabled?: boolean;
}) {
  const mobile = useIsMobile();
  const width = useViewportWidth();
  const inset = useKeyboardInset(enabled);
  return (
    <>
      <output>{`${mobile}:${width}:${inset}`}</output>
      <input aria-label="Search" />
    </>
  );
}

describe("browser layout subscriptions", () => {
  let root: Root;
  let container: HTMLDivElement;
  let media: EventTarget & { /** Current query match. */ matches: boolean };
  let viewport: EventTarget & {
    /** Visual height in CSS pixels. */
    height: number;
    /** Visual top offset in CSS pixels. */
    offsetTop: number;
  };

  beforeEach(() => {
    media = Object.assign(new EventTarget(), { matches: true });
    viewport = Object.assign(new EventTarget(), { height: 500, offsetTop: 8 });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerWidth", 400);
    vi.stubGlobal("innerHeight", 844);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("hydrates stable server snapshots before measuring the browser", async () => {
    const html = renderToString(<Probe />);
    expect(html).toContain("false:null:0");
    expect(window.matchMedia).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.innerHTML = html;
    const recover = vi.fn();
    await act(async () => {
      root = hydrateRoot(container, <Probe />, { onRecoverableError: recover });
    });
    expect(recover).not.toHaveBeenCalled();
    expect(container.querySelector("output")?.textContent).toBe("true:400:336");
  });

  it("updates resize, media, and visual viewport measurements without remounting inputs", async () => {
    await act(async () => root.render(<Probe />));
    const input = container.querySelector("input");
    input?.focus();
    media.matches = false;
    viewport.height = 600;
    vi.stubGlobal("innerWidth", 1440);
    await act(async () => {
      media.dispatchEvent(new Event("change"));
      viewport.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("resize"));
    });
    expect(container.querySelector("output")?.textContent).toBe(
      "false:1440:236",
    );
    expect(container.querySelector("input")).toBe(input);
    expect(document.activeElement).toBe(input);
    await act(async () => root.render(<Probe enabled={false} />));
    expect(container.querySelector("output")?.textContent).toBe("false:1440:0");
  });

  it("disposes listeners while hidden and refreshes them on Activity resumption", async () => {
    const removeMedia = vi.spyOn(media, "removeEventListener");
    const removeViewport = vi.spyOn(viewport, "removeEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    await act(async () =>
      root.render(
        <StrictMode>
          <Activity mode="visible">
            <Probe />
          </Activity>
        </StrictMode>,
      ),
    );
    removeMedia.mockClear();
    removeViewport.mockClear();
    removeWindow.mockClear();
    await act(async () =>
      root.render(
        <StrictMode>
          <Activity mode="hidden">
            <Probe />
          </Activity>
        </StrictMode>,
      ),
    );
    expect(removeMedia).toHaveBeenCalledWith("change", expect.any(Function));
    expect(removeViewport).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(removeViewport).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith("resize", expect.any(Function));
    viewport.height = 844;
    viewport.offsetTop = 0;
    await act(async () =>
      root.render(
        <StrictMode>
          <Activity mode="visible">
            <Probe />
          </Activity>
        </StrictMode>,
      ),
    );
    expect(container.querySelector("output")?.textContent).toBe("true:400:0");
  });
});

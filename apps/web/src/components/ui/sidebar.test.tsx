/** @vitest-environment jsdom */

import { Activity, act, createRef, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider, useSidebar } from "./sidebar";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Exposes the public sidebar context and editable shortcut exclusions.
 * @returns Current desktop/mobile visibility and toggle control.
 */
function Probe() {
  const sidebar = useSidebar();
  return (
    <>
      <output>{`${sidebar.open}:${sidebar.openMobile}:${sidebar.isMobile}`}</output>
      <button type="button" onClick={sidebar.toggleSidebar}>
        Toggle
      </button>
      <input />
      <textarea />
      <select />
      <div contentEditable suppressContentEditableWarning>
        Editable
      </div>
    </>
  );
}

describe("sidebar visibility and shortcuts", () => {
  let root: Root;
  let container: HTMLDivElement;
  let media: EventTarget & {
    /** Current compact viewport status. */ matches: boolean;
  };
  beforeEach(() => {
    media = Object.assign(new EventTarget(), { matches: false });
    vi.stubGlobal("matchMedia", () => media);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("keeps desktop and mobile visibility independent across viewport changes", async () => {
    await act(async () =>
      root.render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      ),
    );
    await act(async () => container.querySelector("button")?.click());
    expect(container.querySelector("output")?.textContent).toBe(
      "false:false:false",
    );
    media.matches = true;
    await act(async () => media.dispatchEvent(new Event("change")));
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true }),
      ),
    );
    expect(container.querySelector("output")?.textContent).toBe(
      "false:true:true",
    );
    media.matches = false;
    await act(async () => media.dispatchEvent(new Event("change")));
    expect(container.querySelector("output")?.textContent).toBe(
      "false:true:false",
    );
  });

  it("preserves forwarded wrapper refs alongside the shortcut subscription", async () => {
    const ref = createRef<HTMLDivElement>();
    await act(async () =>
      root.render(
        <SidebarProvider ref={ref}>
          <Probe />
        </SidebarProvider>,
      ),
    );
    expect(ref.current).toBe(
      container.querySelector('[data-slot="sidebar-wrapper"]'),
    );
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true }),
      ),
    );
    expect(container.querySelector("output")?.textContent).toBe(
      "false:false:false",
    );
    await act(async () => root.render(null));
    expect(ref.current).toBeNull();
  });

  it("reports controlled changes and excludes editable shortcut targets", async () => {
    const onOpenChange = vi.fn();
    await act(async () =>
      root.render(
        <SidebarProvider open onOpenChange={onOpenChange}>
          <Probe />
        </SidebarProvider>,
      ),
    );
    for (const target of container.querySelectorAll(
      "input,textarea,select,[contenteditable]",
    )) {
      await act(async () =>
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            key: "b",
            metaKey: true,
          }),
        ),
      );
    }
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => container.querySelector("button")?.click());
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(container.querySelector("output")?.textContent).toBe(
      "true:false:false",
    );
    await act(async () =>
      root.render(
        <SidebarProvider open={false} onOpenChange={onOpenChange}>
          <Probe />
        </SidebarProvider>,
      ),
    );
    expect(container.querySelector("output")?.textContent).toBe(
      "false:false:false",
    );
  });

  it("removes shortcut listeners while hidden and installs one on resumption", async () => {
    const onOpenChange = vi.fn();
    /**
     * Renders the controlled sidebar through Activity visibility changes.
     * @param mode - Activity visibility.
     * @returns StrictMode sidebar fixture.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <SidebarProvider open onOpenChange={onOpenChange}>
            <Probe />
          </SidebarProvider>
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await act(async () => root.render(tree("hidden")));
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true }),
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true }),
      ),
    );
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
});

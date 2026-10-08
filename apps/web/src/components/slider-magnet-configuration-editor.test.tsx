/** @vitest-environment jsdom */

import type { SliderMagnetConfiguration } from "@package/services";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SliderMagnetConfigurationEditor,
  uniformMagnetConfiguration,
} from "./slider-magnet-configuration-editor";

(
  globalThis as {
    /** Tells React that this test environment supports act(). */
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("slider magnet configuration editor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it("creates complete uniform snapshots for every fixed layout", () => {
    expect(uniformMagnetConfiguration("2x2", "N52")).toEqual({
      sideA: ["N52", "N52", "N52", "N52"],
      sideB: null,
    });
    expect(uniformMagnetConfiguration("2x3", null).sideA).toHaveLength(6);
    expect(uniformMagnetConfiguration("2x4", "N35").sideA).toHaveLength(8);
  });

  it("keeps custom configuration controls behind an explicit opt-in", async () => {
    /**
     * Renders the empty controlled editor matching the default form state.
     *
     * @returns Controlled editor fixture.
     */
    function EditorFixture() {
      const [value, setValue] =
        React.useState<SliderMagnetConfiguration | null>(null);

      return (
        <SliderMagnetConfigurationEditor
          layout="2x2"
          onChange={setValue}
          presets={[
            {
              configuration: uniformMagnetConfiguration("2x2", "N52"),
              id: 1,
              magnetLayout: "2x2",
              name: "Hybrid",
            },
          ]}
          t={(key) => key}
          value={value}
        />
      );
    }

    await act(() => root.render(<EditorFixture />));

    expect(container.textContent).toContain("web.slider.magnet.grade");
    expect(container.textContent).not.toContain("web.slider.magnet.preset");
    expect(
      container.querySelector(
        'button[aria-label="web.slider.magnet.position"]',
      ),
    ).toBeNull();

    const custom = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(custom?.disabled).toBe(true);

    const grade = container.querySelector<HTMLSelectElement>("select");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set;
      setter?.call(grade, "N42");
      grade?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(custom?.disabled).toBe(false);

    act(() => custom?.click());
    expect(container.textContent).toContain("web.slider.magnet.preset");
    const positions = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="web.slider.magnet.position"]',
    );
    expect(positions).toHaveLength(4);
    expect(
      [...positions].every(({ textContent }) => textContent === "N42"),
    ).toBe(true);
  });

  it("edits the selected position when its grade changes", async () => {
    /**
     * Renders the controlled editor matching the user-facing interaction.
     *
     * @returns Controlled editor fixture.
     */
    function EditorFixture() {
      const [value, setValue] = React.useState<SliderMagnetConfiguration>({
        sideA: ["N52", "N52", "N52", "N52"],
        sideB: ["N52", "N52", "N52", "N52"],
      });

      return (
        <SliderMagnetConfigurationEditor
          layout="2x2"
          onChange={(next) => {
            if (next) setValue(next);
          }}
          t={(key) => key}
          value={value}
        />
      );
    }

    await act(() => root.render(<EditorFixture />));
    const firstPosition = container.querySelector<HTMLButtonElement>(
      'button[aria-label="web.slider.magnet.position"]',
    );
    expect(container.querySelector("select")).toBeNull();

    act(() => firstPosition?.click());
    const grade = container.querySelector<HTMLSelectElement>("select");
    expect(firstPosition?.getAttribute("aria-pressed")).toBe("true");
    expect(grade?.value).toBe("N52");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set;
      setter?.call(grade, "N48");
      grade?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(firstPosition?.textContent).toBe("N48");
  });
});

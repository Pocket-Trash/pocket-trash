import type {
  SliderMagnetConfiguration,
  SliderMagnetLayout,
  SliderMagnetPreset,
} from "@package/services";
import {
  type SliderMagnetGrade,
  sliderMagnetGrades,
  sliderMagnetLayoutDetails,
} from "@package/services/constants";
import type { TranslationKey } from "@pocket-trash/localizations";
import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Formats localized editor copy.
 *
 * @param key - Localization key.
 * @param values - Optional interpolation values.
 * @returns Localized message.
 */
type Translate = (
  key: TranslationKey,
  values?: Readonly<Record<string, unknown>>,
) => string;

/**
 * Creates a complete uniform snapshot for one physical layout.
 *
 * @param layout - Physical magnet layout.
 * @param grade - Grade copied into every position, or empty.
 * @returns Complete single-side snapshot.
 */
export function uniformMagnetConfiguration(
  layout: SliderMagnetLayout,
  grade: SliderMagnetGrade | null,
): SliderMagnetConfiguration {
  return {
    sideA: Array.from(
      { length: sliderMagnetLayoutDetails[layout].slotsPerSide },
      () => grade,
    ),
    sideB: null,
  };
}

/**
 * Returns one slot label in row-major order.
 *
 * @param index - Zero-based row-major position.
 * @param side - Physical side label.
 * @param t - Localization formatter.
 * @returns Accessible localized slot label.
 */
function slotLabel(index: number, side: "A" | "B", t: Translate) {
  return t("web.slider.magnet.position" as TranslationKey, {
    position: index + 1,
    side,
  });
}

/**
 * Compact accessible editor for catalog and owned-slider magnet snapshots.
 *
 * @param root0 - Editor state, layout, presets, and callbacks.
 * @returns Controlled magnet configuration editor.
 */
export function SliderMagnetConfigurationEditor({
  layout,
  onChange,
  presets = [],
  t,
  value,
}: {
  /** Physical layout that determines the grid size. */
  layout: SliderMagnetLayout;
  /**
   * Replaces or clears the controlled snapshot.
   *
   * @param value - Replacement snapshot.
   */
  onChange(value: SliderMagnetConfiguration | null): void;
  /** Reusable snapshots matching any supported layout. */
  presets?: SliderMagnetPreset[];
  /** Localization formatter. */
  t: Translate;
  /** Current optional snapshot. */
  value: SliderMagnetConfiguration | null;
}) {
  const [advanced, setAdvanced] = React.useState(() =>
    Boolean(
      value &&
        (value.sideB !== null ||
          !value.sideA.every((grade) => grade === value.sideA[0])),
    ),
  );
  const [selectedGrade, setSelectedGrade] =
    React.useState<SliderMagnetGrade | null>("N52");
  const [selectedPosition, setSelectedPosition] = React.useState<{
    /** Zero-based row-major position. */
    index: number;
    /** Layout in which the position was selected. */
    layout: SliderMagnetLayout;
    /** Physical side containing the position. */
    side: "sideA" | "sideB";
  } | null>(null);
  const details = sliderMagnetLayoutDetails[layout];
  const configuration = value ?? uniformMagnetConfiguration(layout, "N52");
  const activePosition =
    selectedPosition?.layout === layout ? selectedPosition : null;
  const matchingPresets = presets.filter(
    (preset) => preset.magnetLayout === layout,
  );
  const isUniform = configuration.sideA.every(
    (grade) => grade === configuration.sideA[0],
  );
  const uniformGrade = isUniform ? (configuration.sideA[0] ?? null) : null;

  /**
   * Replaces one slot with the active grade.
   *
   * @param side - Snapshot side to edit.
   * @param index - Zero-based slot position.
   * @param grade - Replacement magnet grade, or an intentionally empty slot.
   */
  const setSlot = (
    side: "sideA" | "sideB",
    index: number,
    grade: SliderMagnetGrade | null,
  ) => {
    const current =
      side === "sideA"
        ? configuration.sideA
        : (configuration.sideB ?? configuration.sideA);
    const next = [...current];
    next[index] = grade;
    onChange({
      ...configuration,
      [side]: next,
    });
  };

  /**
   * Renders one side as accessible circular position buttons.
   *
   * @param side - Snapshot side to render.
   * @param label - Localized fieldset legend.
   * @returns Side position controls.
   */
  const renderSide = (side: "sideA" | "sideB", label: string) => {
    const slots =
      side === "sideA"
        ? configuration.sideA
        : (configuration.sideB ?? configuration.sideA);
    return (
      <fieldset className="grid gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{label}</legend>
        <div
          className="grid w-fit gap-2"
          style={{
            gridTemplateColumns: `repeat(${details.columnCount}, minmax(0, 2.75rem))`,
          }}
        >
          {slots
            .map((grade, index) => ({
              grade,
              id: `${side}-${index + 1}`,
              index,
            }))
            .map(({ grade, id, index }) => {
              const selected =
                activePosition?.side === side && activePosition.index === index;
              return (
                <button
                  aria-label={slotLabel(index, side === "sideA" ? "A" : "B", t)}
                  aria-pressed={selected}
                  className={`flex size-11 items-center justify-center rounded-full border bg-background text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-ring ring-2 ring-ring" : "border-input"}`}
                  key={id}
                  onClick={() => {
                    setSelectedPosition({ index, layout, side });
                    setSelectedGrade(grade);
                  }}
                  title={grade ?? t("web.slider.magnet.state.empty")}
                  type="button"
                >
                  {grade ?? "—"}
                </button>
              );
            })}
        </div>
      </fieldset>
    );
  };

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">
        {t("web.slider.magnet.configuration")}
      </legend>
      {matchingPresets.length ? (
        <label className="grid gap-1 text-sm font-medium">
          {t("web.slider.magnet.preset" as TranslationKey)}
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            defaultValue=""
            onChange={(event) => {
              const preset = matchingPresets.find(
                ({ id }) => id === Number(event.target.value),
              );
              if (preset) {
                setSelectedPosition(null);
                onChange({
                  sideA: [...preset.configuration.sideA],
                  sideB: preset.configuration.sideB
                    ? [...preset.configuration.sideB]
                    : null,
                });
              }
            }}
          >
            <option value="">
              {t("web.slider.magnet.selectPreset" as TranslationKey)}
            </option>
            {matchingPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          checked={advanced}
          onChange={(event) => {
            const next = event.target.checked;
            setAdvanced(next);
            setSelectedPosition(null);
            if (value === null || (!next && !isUniform))
              onChange(uniformMagnetConfiguration(layout, selectedGrade));
          }}
          type="checkbox"
        />
        {t("web.slider.magnet.advanced" as TranslationKey)}
      </label>
      {!advanced || activePosition ? (
        <label className="grid gap-1 text-sm font-medium">
          {t("web.slider.magnet.grade")}
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => {
              if (event.target.value === "not-recorded") {
                onChange(null);
                return;
              }
              const grade =
                sliderMagnetGrades.find(
                  (candidate) => candidate === event.target.value,
                ) ?? null;
              setSelectedGrade(grade);
              if (advanced && activePosition)
                setSlot(activePosition.side, activePosition.index, grade);
              else if (!advanced)
                onChange(uniformMagnetConfiguration(layout, grade));
            }}
            value={
              advanced
                ? (selectedGrade ?? "empty")
                : value === null || !isUniform
                  ? "not-recorded"
                  : (uniformGrade ?? "empty")
            }
          >
            {!advanced ? (
              <option value="not-recorded">
                {t("web.slider.setup.notRecorded")}
              </option>
            ) : null}
            <option value="empty">{t("web.slider.magnet.state.empty")}</option>
            {sliderMagnetGrades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {advanced ? (
        <>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={configuration.sideB !== null}
              onChange={(event) => {
                setSelectedPosition(null);
                onChange({
                  ...configuration,
                  sideB: event.target.checked ? [...configuration.sideA] : null,
                });
              }}
              type="checkbox"
            />
            {t("web.slider.magnet.differentSides" as TranslationKey)}
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            {renderSide("sideA", t("web.slider.magnet.halfA"))}
            {configuration.sideB
              ? renderSide("sideB", t("web.slider.magnet.halfB"))
              : null}
          </div>
        </>
      ) : null}
      <Button
        className="w-fit"
        onClick={() => {
          setSelectedPosition(null);
          onChange(null);
        }}
        type="button"
        variant="outline"
      >
        {t("web.slider.magnet.clear" as TranslationKey)}
      </Button>
    </fieldset>
  );
}

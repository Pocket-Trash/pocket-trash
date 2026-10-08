export * from "@package/storage/constants";

/** Supported immutable physical layouts for slider magnet hosts. */
export const sliderMagnetLayouts = ["2x2", "2x3", "2x4"] as const;

/** Immutable physical layout stored by a slider or insert host. */
export type SliderMagnetLayout = (typeof sliderMagnetLayouts)[number];

/** Physical facts and derived click count for each supported layout. */
export const sliderMagnetLayoutDetails = {
  "2x2": {
    clickCount: 1,
    columnCount: 2,
    label: "2×2",
    rowCount: 2,
    slotsPerSide: 4,
  },
  "2x3": {
    clickCount: 2,
    columnCount: 3,
    label: "2×3",
    rowCount: 2,
    slotsPerSide: 6,
  },
  "2x4": {
    clickCount: 3,
    columnCount: 4,
    label: "2×4",
    rowCount: 2,
    slotsPerSide: 8,
  },
} as const satisfies Record<
  SliderMagnetLayout,
  {
    /** Number of tactile clicks produced by the layout. */
    clickCount: number;
    /** Number of lengthwise magnet positions. */
    columnCount: number;
    /** Display label for the layout. */
    label: string;
    /** Number of magnet rows. */
    rowCount: number;
    /** Number of magnet slots on one side. */
    slotsPerSide: number;
  }
>;

/**
 * Derives a slider's click count from its immutable physical layout.
 *
 * @param layout - Physical magnet layout.
 * @returns Derived click count.
 */
export function sliderClickCount(layout: SliderMagnetLayout) {
  return sliderMagnetLayoutDetails[layout].clickCount;
}

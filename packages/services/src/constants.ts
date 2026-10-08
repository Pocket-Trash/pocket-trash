export * from "@package/storage/constants";

/** Supported immutable physical layouts for slider magnet hosts. */
export const sliderMagnetLayouts = ["2x2", "2x3", "2x4"] as const;

/** Immutable physical layout stored by a slider or insert host. */
export type SliderMagnetLayout = (typeof sliderMagnetLayouts)[number];

/** Supported grades for slider magnet configuration snapshots. */
export const sliderMagnetGrades = [
  "N52",
  "N48",
  "N45",
  "N42",
  "N40",
  "N38",
  "N35",
  "N30",
] as const;

/** Grade stored in one slider magnet position. */
export type SliderMagnetGrade = (typeof sliderMagnetGrades)[number];

/** Compact row-major slider magnet snapshot; `null` side B reuses side A. */
export type SliderMagnetConfiguration = {
  /** First side, and both sides when `sideB` is `null`. */
  sideA: Array<SliderMagnetGrade | null>;
  /** Optional distinct second side. */
  sideB: Array<SliderMagnetGrade | null> | null;
};

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

/**
 * Checks a persisted magnet snapshot against its physical layout.
 *
 * @param value - Untrusted snapshot value.
 * @param layout - Physical host layout.
 * @returns Whether both sides contain exactly the supported positions and grades.
 */
export function sliderMagnetConfigurationIsValid(
  value: unknown,
  layout: SliderMagnetLayout,
): value is SliderMagnetConfiguration {
  if (!value || typeof value !== "object") return false;
  const { sideA, sideB } = value as Partial<SliderMagnetConfiguration>;
  const length = sliderMagnetLayoutDetails[layout].slotsPerSide;
  /**
   * Checks one side against the layout's slot count and grade vocabulary.
   *
   * @param side - Candidate row-major side value.
   * @returns Whether the side is complete and supported.
   */
  const sideIsValid = (side: unknown) =>
    Array.isArray(side) &&
    side.length === length &&
    side.every(
      (grade) =>
        grade === null ||
        sliderMagnetGrades.some((candidate) => candidate === grade),
    );
  return sideIsValid(sideA) && (sideB === null || sideIsValid(sideB));
}

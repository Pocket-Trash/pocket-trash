import {
  type FigjamOperation,
  type FigjamPayload,
  payloadSchemaVersion,
} from "./types.js";

/** Reports an invalid FigJam configuration value or bridge payload field. */
export class FigjamValidationError extends Error {
  /** Stable error name used by callers and diagnostics. */
  override name = "FigjamValidationError";
}

/**
 * Parses the comma-separated Figma file-key allowlist.
 *
 * @param value - Raw allowlist environment value.
 * @returns Trimmed non-empty file keys in source order.
 */
export function parseAllowedFileKeys(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

/**
 * Asserts that a Figma file key is present in the configured allowlist.
 *
 * @param fileKey - Figma file key to authorize.
 * @param allowedFileKeys - File keys permitted for local tooling.
 * @throws When the file key is absent from the allowlist.
 */
export function assertAllowedFileKey(
  fileKey: string,
  allowedFileKeys: readonly string[],
): void {
  if (!allowedFileKeys.includes(fileKey)) {
    throw new FigjamValidationError(
      `File key ${fileKey} is not in FIGMA_FIGJAM_ALLOWED_FILE_KEYS.`,
    );
  }
}

/**
 * Validates and normalizes an unknown FigJam bridge payload.
 *
 * @param input - Candidate payload value.
 * @param options - Optional validation constraints.
 * @returns A versioned payload containing normalized supported operations.
 * @throws When the payload shape, values, operation IDs, or file key are invalid.
 */
export function validatePayload(
  input: unknown,
  options: {
    /** Optional file-key allowlist enforced during validation. */
    allowedFileKeys?: readonly string[];
  } = {},
): FigjamPayload {
  const payload = expectObject(input, "payload");

  expectString(payload.schemaVersion, "schemaVersion");
  if (payload.schemaVersion !== payloadSchemaVersion) {
    throw new FigjamValidationError(
      `schemaVersion must be ${payloadSchemaVersion}.`,
    );
  }

  const payloadId = expectString(payload.payloadId, "payloadId");
  const fileKey = expectString(payload.fileKey, "fileKey");
  const source = expectObject(payload.source, "source");
  const agent = expectString(source.agent, "source.agent");
  const createdAt = expectString(source.createdAt, "source.createdAt");
  const operations = expectArray(payload.operations, "operations");

  if (!["claude", "codex", "system", "user"].includes(agent)) {
    throw new FigjamValidationError(
      "source.agent must be codex, claude, user, or system.",
    );
  }

  if (Number.isNaN(Date.parse(createdAt))) {
    throw new FigjamValidationError("source.createdAt must be an ISO date.");
  }

  if (operations.length === 0) {
    throw new FigjamValidationError("operations must not be empty.");
  }

  if (operations.length > 500) {
    throw new FigjamValidationError(
      "operations must contain at most 500 items.",
    );
  }

  if (options.allowedFileKeys) {
    assertAllowedFileKey(fileKey, options.allowedFileKeys);
  }

  const operationIds = new Set<string>();
  const validatedOperations = operations.map((operation, index) => {
    const validated = validateOperation(operation, index);
    if (operationIds.has(validated.id)) {
      throw new FigjamValidationError(
        `operations[${index}].id duplicates ${validated.id}.`,
      );
    }
    operationIds.add(validated.id);
    return validated;
  });

  return {
    fileKey,
    operations: validatedOperations,
    payloadId,
    schemaVersion: payloadSchemaVersion,
    source: {
      agent: agent as FigjamPayload["source"]["agent"],
      branch: optionalString(source.branch, "source.branch"),
      commit: optionalString(source.commit, "source.commit"),
      createdAt,
      task: optionalString(source.task, "source.task"),
    },
  };
}

/**
 * Validates and normalizes one operation from a bridge payload.
 *
 * @param input - Candidate operation value.
 * @param index - Operation index used in validation paths.
 * @returns A supported normalized FigJam operation.
 * @throws When the operation type or any operation field is invalid.
 */
function validateOperation(input: unknown, index: number): FigjamOperation {
  const operation = expectObject(input, `operations[${index}]`);
  const type = expectString(operation.type, `operations[${index}].type`);
  const id = expectString(operation.id, `operations[${index}].id`);

  switch (type) {
    case "section":
      return {
        height: expectFiniteNumber(
          operation.height,
          `operations[${index}].height`,
        ),
        id,
        title: expectString(operation.title, `operations[${index}].title`),
        type,
        width: expectFiniteNumber(
          operation.width,
          `operations[${index}].width`,
        ),
        x: expectFiniteNumber(operation.x, `operations[${index}].x`),
        y: expectFiniteNumber(operation.y, `operations[${index}].y`),
      };
    case "sticky":
      return {
        color: optionalStickyColor(
          operation.color,
          `operations[${index}].color`,
        ),
        id,
        text: expectString(operation.text, `operations[${index}].text`),
        type,
        x: expectFiniteNumber(operation.x, `operations[${index}].x`),
        y: expectFiniteNumber(operation.y, `operations[${index}].y`),
      };
    case "shape":
      return {
        fill: optionalColor(operation.fill, `operations[${index}].fill`),
        fontSize: optionalPositiveNumber(
          operation.fontSize,
          `operations[${index}].fontSize`,
        ),
        height: expectFiniteNumber(
          operation.height,
          `operations[${index}].height`,
        ),
        id,
        radius: optionalNonNegativeNumber(
          operation.radius,
          `operations[${index}].radius`,
        ),
        stroke: optionalColor(operation.stroke, `operations[${index}].stroke`),
        text: optionalString(operation.text, `operations[${index}].text`),
        textAlign: optionalShapeTextAlign(
          operation.textAlign,
          `operations[${index}].textAlign`,
        ),
        textColor: optionalColor(
          operation.textColor,
          `operations[${index}].textColor`,
        ),
        textPadding: optionalNonNegativeNumber(
          operation.textPadding,
          `operations[${index}].textPadding`,
        ),
        textPosition: optionalShapeTextPosition(
          operation.textPosition,
          `operations[${index}].textPosition`,
        ),
        type,
        width: expectFiniteNumber(
          operation.width,
          `operations[${index}].width`,
        ),
        x: expectFiniteNumber(operation.x, `operations[${index}].x`),
        y: expectFiniteNumber(operation.y, `operations[${index}].y`),
      };
    case "connector":
      return {
        from: expectString(operation.from, `operations[${index}].from`),
        id,
        text: optionalString(operation.text, `operations[${index}].text`),
        to: expectString(operation.to, `operations[${index}].to`),
        type,
      };
    case "stamp":
      return {
        id,
        text: expectString(operation.text, `operations[${index}].text`),
        type,
        x: expectFiniteNumber(operation.x, `operations[${index}].x`),
        y: expectFiniteNumber(operation.y, `operations[${index}].y`),
      };
    default:
      throw new FigjamValidationError(
        `operations[${index}].type is not supported: ${type}.`,
      );
  }
}

/**
 * Requires an array at a payload field path.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns The validated array.
 * @throws When the value is not an array.
 */
function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new FigjamValidationError(`${path} must be an array.`);
  }

  return value;
}

/**
 * Requires a non-array object at a payload field path.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns The validated object record.
 * @throws When the value is null, an array, or not an object.
 */
function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FigjamValidationError(`${path} must be an object.`);
  }

  return value as Record<string, unknown>;
}

/**
 * Requires a finite number at a payload field path.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns The validated finite number.
 * @throws When the value is not a finite number.
 */
function expectFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new FigjamValidationError(`${path} must be a finite number.`);
  }

  return value;
}

/**
 * Requires a non-blank string at a payload field path.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns The validated string without altering its whitespace.
 * @throws When the value is not a non-blank string.
 */
function expectString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FigjamValidationError(`${path} must be a non-empty string.`);
  }

  return value;
}

/**
 * Validates an optional non-blank string field.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns The validated string, or `undefined` when omitted.
 * @throws When a present value is not a non-blank string.
 */
function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectString(value, path);
}

/**
 * Validates an optional bridge color value.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns `none`, a six-digit hex color, or `undefined` when omitted.
 * @throws When a present value is not a supported color.
 */
function optionalColor(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const color = expectString(value, path);
  if (color === "none" || /^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  throw new FigjamValidationError(
    `${path} must be "none" or a six-digit hex color.`,
  );
}

/**
 * Validates an optional number greater than zero.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns The validated number, or `undefined` when omitted.
 * @throws Unless a present value is finite and greater than zero.
 */
function optionalPositiveNumber(
  value: unknown,
  path: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const number = expectFiniteNumber(value, path);
  if (number > 0) {
    return number;
  }

  throw new FigjamValidationError(`${path} must be greater than 0.`);
}

/**
 * Validates an optional number greater than or equal to zero.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns The validated number, or `undefined` when omitted.
 * @throws Unless a present value is finite and non-negative.
 */
function optionalNonNegativeNumber(
  value: unknown,
  path: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const number = expectFiniteNumber(value, path);
  if (number >= 0) {
    return number;
  }

  throw new FigjamValidationError(
    `${path} must be greater than or equal to 0.`,
  );
}

/**
 * Validates optional horizontal shape-text alignment.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns A supported alignment, or `undefined` when omitted.
 * @throws When a present value is neither `center` nor `left`.
 */
function optionalShapeTextAlign(
  value: unknown,
  path: string,
): "center" | "left" | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "center" || value === "left") {
    return value;
  }

  throw new FigjamValidationError(`${path} must be center or left.`);
}

/**
 * Validates optional shape-text placement.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns A supported placement, or `undefined` when omitted.
 * @throws When a present value is neither `center` nor `top-left`.
 */
function optionalShapeTextPosition(
  value: unknown,
  path: string,
): "center" | "top-left" | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "center" || value === "top-left") {
    return value;
  }

  throw new FigjamValidationError(`${path} must be center or top-left.`);
}

/**
 * Validates an optional FigJam sticky-note color.
 *
 * @param value - Candidate field value.
 * @param path - Payload path used in validation errors.
 * @returns A supported sticky-note color, or `undefined` when omitted.
 * @throws When a present value is not a supported sticky-note color.
 */
function optionalStickyColor(
  value: unknown,
  path: string,
): FigjamOperation extends infer Operation
  ? Operation extends {
      /** Optional sticky-note color inferred from the operation union. */
      color?: infer Color;
    }
    ? Color
    : never
  : never {
  if (value === undefined) {
    return undefined as never;
  }

  if (
    value === "blue" ||
    value === "green" ||
    value === "pink" ||
    value === "yellow"
  ) {
    return value as never;
  }

  throw new FigjamValidationError(
    `${path} must be blue, green, pink, or yellow.`,
  );
}

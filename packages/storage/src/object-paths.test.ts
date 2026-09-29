import { describe, expect, it } from "vitest";
import {
  buildImageObjectPath,
  buildResourceFileObjectPath,
} from "./object-paths.js";

const hash = "a".repeat(64);
describe("object paths", () => {
  it.each([
    ["images", "products", "1149", "43088626188475"],
    ["images", "products", "1141-285459", "43088626188475"],
    ["images/dev", "products", "1000", hash],
    ["images/preview/pr-52", "collections", "42", hash],
    ["images", "collection-items", "77", hash],
    ["images", "resources", "1203", hash],
  ] as const)("builds %s/%s/%s/%s", (prefix, entity, entityId, name) => {
    expect(
      buildImageObjectPath({
        prefix,
        entity,
        entityId,
        name,
        extension: "webp",
      }),
    ).toBe(`${prefix}/${entity}/${entityId}/${name}.webp`);
  });
  it.each([1, 2])("isolates resource version %i", (version) => {
    expect(
      buildResourceFileObjectPath({
        prefix: "resources/files",
        resourceId: 1203,
        version,
        sha256: hash,
        extension: "pdf",
      }),
    ).toBe(`resources/files/1203/v${version}/${hash}.pdf`);
  });
  it.each([
    "../images",
    "images/preview/pr-0",
    "resources/files",
    "images/dev/../products",
  ])("rejects invalid image prefix %s", (prefix) => {
    expect(() =>
      buildImageObjectPath({
        prefix,
        entity: "products",
        entityId: 1,
        name: hash,
        extension: "png",
      }),
    ).toThrow();
  });
  it("rejects unsafe identifiers, hashes and versions", () => {
    expect(() =>
      buildImageObjectPath({
        prefix: "images",
        entity: "products",
        entityId: "../1",
        name: hash,
        extension: "png",
      }),
    ).toThrow();
    expect(() =>
      buildResourceFileObjectPath({
        prefix: "resources/dev",
        resourceId: 1,
        version: 0,
        sha256: hash,
        extension: "pdf",
      }),
    ).toThrow();
    expect(() =>
      buildResourceFileObjectPath({
        prefix: "resources/dev",
        resourceId: 1,
        version: 1,
        sha256: "../file",
        extension: "pdf",
      }),
    ).toThrow();
  });
});

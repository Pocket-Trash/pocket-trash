import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  resourceCategories,
  resourceDownloads,
  resourceNotifications,
  resources,
  resourcesToCategories,
  resourceVersions,
} from "../src/schema/resources.js";

describe("resource schema", () => {
  it("stores numeric resources with immutable versions and event-based downloads", () => {
    expect(getTableName(resources)).toBe("resources");
    expect(resources.id.dataType).toBe("number");
    expect(resources.uploaderClerkId.notNull).toBe(true);
    expect("downloadCount" in resources).toBe(false);

    const versionConfig = getTableConfig(resourceVersions);
    expect(getTableName(resourceVersions)).toBe("resource_versions");
    expect(versionConfig.uniqueConstraints.map(({ name }) => name)).toContain(
      "resource_versions_resource_version_unique",
    );
    expect(resourceVersions.resourceId.notNull).toBe(true);
    expect(resourceVersions.objectPath.notNull).toBe(true);

    expect(getTableName(resourceDownloads)).toBe("resource_downloads");
    expect(resourceDownloads.versionId.notNull).toBe(true);
    expect("resourceId" in resourceDownloads).toBe(false);
  });

  it("normalizes categories through a unique assignment table", () => {
    expect(getTableName(resourceCategories)).toBe("resource_categories");
    expect(resourceCategories.slug.isUnique).toBe(true);

    const assignmentConfig = getTableConfig(resourcesToCategories);
    expect(getTableName(resourcesToCategories)).toBe("resources_to_categories");
    expect(assignmentConfig.primaryKeys).toHaveLength(1);
    expect(
      assignmentConfig.primaryKeys[0]?.columns.map(({ name }) => name),
    ).toEqual(["resource_id", "category_id"]);
  });

  it("stores typed resource notifications with global read metadata", () => {
    expect(getTableName(resourceNotifications)).toBe("resource_notifications");
    expect(resourceNotifications.resourceId.notNull).toBe(true);
    expect(resourceNotifications.uploaderClerkId.notNull).toBe(true);
    expect(resourceNotifications.readAt.notNull).toBe(false);
    expect(resourceNotifications.readByClerkId.notNull).toBe(false);
  });
});

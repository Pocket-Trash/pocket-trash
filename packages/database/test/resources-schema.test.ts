import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  resourceCategories,
  resourceDownloads,
  resourceFiles,
  resourceImages,
  resourceNotifications,
  resources,
  resourcesToCategories,
  resourceVersions,
} from "../src/schema/resources.js";
import { uploadFile, uploadSession } from "../src/schema/uploads.js";

describe("resource schema", () => {
  it("stores numeric resources with immutable versions and event-based downloads", () => {
    expect(getTableName(resources)).toBe("resources");
    expect(resources.id.dataType).toBe("number");
    expect(resources.uploaderClerkId.notNull).toBe(true);
    expect(resources.isPrivate.notNull).toBe(true);
    expect(resources.isPrivate.default).toBe(false);
    expect(resources.deletedAt.notNull).toBe(false);
    expect(resources.deletedByClerkId.notNull).toBe(false);
    expect(resources.deletedByRole.notNull).toBe(false);
    expect("downloadCount" in resources).toBe(false);

    const resourceConfig = getTableConfig(resources);
    expect(resourceConfig.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "resources_deletion_metadata_consistent",
        "resources_deleted_by_role_valid",
      ]),
    );

    const versionConfig = getTableConfig(resourceVersions);
    expect(getTableName(resourceVersions)).toBe("resource_versions");
    expect(versionConfig.uniqueConstraints.map(({ name }) => name)).toContain(
      "resource_versions_resource_version_unique",
    );
    expect(resourceVersions.resourceId.notNull).toBe(true);
    expect(getTableName(resourceFiles)).toBe("resource_files");
    expect(resourceFiles.versionId.notNull).toBe(true);
    expect(resourceFiles.objectPath.notNull).toBe(true);

    expect(getTableName(resourceImages)).toBe("resource_images");
    expect(resourceImages.resourceId.notNull).toBe(true);
    expect(resourceImages.position.notNull).toBe(true);
    expect(resourceImages.objectPath.notNull).toBe(true);

    expect(getTableName(resourceDownloads)).toBe("resource_downloads");
    expect(resourceDownloads.fileId.notNull).toBe(false);
    expect("resourceId" in resourceDownloads).toBe(false);
    expect(
      getTableConfig(resourceDownloads).foreignKeys.map(
        ({ onDelete }) => onDelete,
      ),
    ).toEqual(["cascade", "cascade"]);
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
    expect(
      assignmentConfig.foreignKeys.map(({ onDelete }) => onDelete),
    ).toEqual(["cascade", "restrict"]);
  });

  it("stores typed resource notifications with global read metadata", () => {
    expect(getTableName(resourceNotifications)).toBe("resource_notifications");
    expect(resourceNotifications.resourceId.notNull).toBe(true);
    expect(resourceNotifications.uploaderClerkId.notNull).toBe(true);
    expect(resourceNotifications.readAt.notNull).toBe(false);
    expect(resourceNotifications.readByClerkId.notNull).toBe(false);
  });

  it("tracks expiring upload sessions and their declared files", () => {
    expect(getTableName(uploadSession)).toBe("upload_session");
    expect(uploadSession.uploaderClerkId.notNull).toBe(true);
    expect(uploadSession.targetType.notNull).toBe(true);
    expect(uploadSession.payload.notNull).toBe(false);
    expect(uploadSession.expiresAt.notNull).toBe(true);
    expect(uploadSession.completedAt.notNull).toBe(false);
    expect(uploadSession.reservedResourceId.notNull).toBe(false);

    expect(getTableName(uploadFile)).toBe("upload_file");
    expect(uploadFile.sessionId.notNull).toBe(true);
    expect(uploadFile.position.notNull).toBe(true);
    expect(uploadFile.uploadedAt.notNull).toBe(false);
  });
});

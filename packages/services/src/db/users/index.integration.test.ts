import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it, vi } from "vitest";
import { createUsersService, UserBanStateError } from "./index.js";

describe("user ban management", () => {
  it("authorizes transitions, preserves pending work, and edits ban reasons", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const service = createUsersService(
      db,
      createLogger({
        app: "test",
        environment: "test",
        level: "error",
        transports: [],
      }),
    );
    const actor = { clerkId: "admin_123", role: "admin" as const };
    const provider =
      vi.fn<(clerkId: string, banned: boolean) => Promise<void>>();

    try {
      await expect(
        service.setBanState(
          {
            actor: { clerkId: "user_123", role: "user" },
            banned: true,
            reason: "Abuse",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).rejects.toBeInstanceOf(UserBanStateError);

      provider.mockRejectedValueOnce(new Error("raw provider secret"));
      await expect(
        service.setBanState(
          {
            actor,
            banned: true,
            reason: " Abuse reports ",
            targetClerkId: " user_target ",
          },
          provider,
        ),
      ).rejects.toThrow("raw provider secret");
      await expect(service.getBanState("user_target")).resolves.toMatchObject({
        reason: "Abuse reports",
        status: "pending_ban",
      });

      provider.mockResolvedValue(undefined);
      await expect(
        service.setBanState(
          {
            actor,
            banned: true,
            reason: "Abuse reports",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).resolves.toMatchObject({ status: "banned" });

      await expect(
        service.setBanState(
          {
            actor,
            banned: true,
            reason: "Updated evidence",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).resolves.toMatchObject({
        reason: "Updated evidence",
        status: "banned",
      });
      expect(provider).toHaveBeenCalledTimes(3);

      provider.mockRejectedValueOnce(new Error("timeout"));
      await expect(
        service.setBanState(
          {
            actor,
            banned: false,
            reason: "Appeal accepted",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).rejects.toThrow("timeout");
      await expect(
        service.setBanState(
          {
            actor,
            banned: true,
            reason: "Conflicting decision",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).rejects.toBeInstanceOf(UserBanStateError);
      await expect(
        service.setBanState(
          {
            actor,
            banned: false,
            reason: "Appeal accepted",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).resolves.toMatchObject({ status: "unbanned" });
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Applies repository SQL migrations to an isolated PGlite database.
 *
 * @param client - Isolated database client.
 * @returns Completion after every migration is applied.
 */
async function migrate(client: PGlite): Promise<void> {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  for (const file of readdirSync(migrationsFolder)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await client.exec(
      readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
  }
}

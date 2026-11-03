import { writeFileSync } from "node:fs";
import { createDb, schema } from "@package/database";
import { z } from "zod";
import { seedCatalog } from "../../../packages/database/scripts/seed";
import { assertMutationIsolation } from "./mutation-guard";

assertMutationIsolation(process.env);
/** Disposable database populated before local browser tests start. */
const database = createDb({
  databaseUrl: z.string().min(1).parse(process.env.DATABASE_URL),
});
try {
  await seedCatalog(database);
  for (const role of ["REGULAR", "ADMIN", "EDITOR", "DISPOSABLE"]) {
    const email = process.env[`E2E_CLERK_${role}_USER_EMAIL`];
    if (!email) throw new Error(`Missing E2E Clerk ${role} email.`);
    const response = await fetch(
      `https://api.clerk.com/v1/users?${new URLSearchParams({ email_address: email })}`,
      {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok)
      throw new Error(`Clerk ${role} lookup failed: ${response.status}`);
    const users = z
      .array(
        z.object({ id: z.string().min(1), username: z.string().nullable() }),
      )
      .parse(await response.json());
    const user = users[0];
    if (users.length !== 1 || !user)
      throw new Error(`Expected one Clerk ${role} user.`);
    if (role === "REGULAR" && user.id !== process.env.E2E_CLERK_REGULAR_USER_ID)
      throw new Error("Regular Clerk user ID does not match its email.");
    await database
      .insert(schema.user)
      .values({ clerkId: user.id, username: user.username })
      .onConflictDoNothing();
  }
  const keys = [
    "DATABASE_URL",
    "CLERK_SECRET_KEY",
    "BUNNY_CDN_BASE_URL",
    "BUNNY_CDN_TOKEN_KEY",
    "BUNNY_IMAGE_FOLDER_PREFIX",
    "BUNNY_RESOURCE_FOLDER_PREFIX",
    "BUNNY_STORAGE_ACCESS_KEY",
    "BUNNY_STORAGE_ENDPOINT",
    "BUNNY_STORAGE_ZONE_NAME",
    "ERASURE_HMAC_SECRET",
    "LOG_PROXY_CLIENT_KEY",
  ];
  writeFileSync(
    z.string().min(1).parse(process.env.E2E_API_ENV_FILE),
    keys
      .map((key) => `${key}=${JSON.stringify(process.env[key] ?? "")}`)
      .join("\n"),
    { mode: 0o600 },
  );
} finally {
  await database.$client.end();
}

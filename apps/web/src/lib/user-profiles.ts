import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Loads a public user profile by exact username. */
export const getPublicUserProfile = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ username: z.string().trim().min(1).max(256) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    const user = await s.db.users.getPublicByUsername(data.username);
    return user?.username ? { username: user.username } : null;
  });

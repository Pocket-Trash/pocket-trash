import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SEARCH_QUERY_MAX_LENGTH } from "./search-constants";

/** Runs a validated public search through the shared database service. */
export const searchPublic = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        group: z
          .enum([
            "all",
            "products",
            "collections",
            "makers",
            "people",
            "materials",
            "resources",
          ])
          .optional(),
        page: z.number().int().positive().optional(),
        query: z.string().max(SEARCH_QUERY_MAX_LENGTH),
        surface: z.enum(["modal", "page"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    return s.db.search.search(data);
  });

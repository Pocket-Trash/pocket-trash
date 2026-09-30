import { z } from "zod";
import { UploadSessionError } from "./types.js";
export const resourcePayloadSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create"),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(5000),
    categories: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
    isPrivate: z.boolean().default(false),
  }),
  z.object({ operation: z.literal("version") }),
]);
export function resourcePayload(value: unknown) {
  const result = resourcePayloadSchema.safeParse(value);
  if (!result.success) throw new UploadSessionError("invalid_request", 400);
  if (
    result.data.operation === "create" &&
    result.data.categories.some((name) => !slugify(name))
  )
    throw new UploadSessionError("invalid_request", 400);
  return result.data;
}
export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

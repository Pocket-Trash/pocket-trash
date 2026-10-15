import type {
  OwnershipEntryReason,
  OwnershipExitReason,
} from "@package/services";

/** Browser-safe entry reason choices for ownership forms. */
export const collectionOwnershipEntryReasons = [
  "purchase",
  "gift",
  "trade",
  "made",
  "other",
  "unknown",
] as const satisfies readonly OwnershipEntryReason[];

/** Browser-safe exit reason choices for ownership forms. */
export const collectionOwnershipExitReasons = [
  "sale",
  "gift",
  "trade",
  "lost",
  "disposed",
  "other",
] as const satisfies readonly OwnershipExitReason[];

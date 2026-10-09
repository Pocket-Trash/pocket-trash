import type { CatalogLookup } from "@package/services";
import { Link } from "@tanstack/react-router";

/**
 * Links a canonical material assignment to its general or exact-specific page.
 *
 * @param props - Canonical general material with optional specific context.
 * @param props.material - Stored assignment; general name is retained for generic pairs.
 * @returns A typed material link using the most specific display name.
 */
export function MaterialLink({
  material,
}: {
  /** General material and optional canonical alloy or grade. */
  material: CatalogLookup & {
    /** Exact alloy or grade, or null for generic. */ specific?: CatalogLookup | null;
  };
}) {
  const className =
    "relative z-20 underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return material.specific ? (
    <Link
      className={className}
      params={{
        materialSlug: material.slug,
        materialSpecificSlug: material.specific.slug,
      }}
      search={{ productsPage: 1, collectionItemsPage: 1 }}
      to="/materials/$materialSlug/$materialSpecificSlug"
    >
      {material.specific.name}
    </Link>
  ) : (
    <Link
      className={className}
      params={{ materialSlug: material.slug }}
      search={{ productsPage: 1, collectionItemsPage: 1 }}
      to="/materials/$materialSlug"
    >
      {material.name}
    </Link>
  );
}

import type { CatalogProduct } from "@package/services";
import { Link } from "@tanstack/react-router";
import { PenPartRoleBadges } from "@/components/pen-part-role-badges";
import { useCatalogCopy } from "@/lib/catalog-copy";

/**
 * Shows physical product associations independently of Pen compatibility.
 * @param props - Visible forward and reverse associations.
 * @returns Named product links and functional roles, or nothing without associations.
 */
export function PenActuationLinks({
  actuatedMechanisms = [],
  actuatingParts = [],
}: {
  /** Physical mechanisms operated by the current part. */
  actuatedMechanisms?: CatalogProduct["actuatedMechanisms"];
  /** Physical parts operating the current mechanism. */
  actuatingParts?: CatalogProduct["actuatingParts"];
}) {
  const t = useCatalogCopy();
  if (!actuatedMechanisms.length && !actuatingParts.length) return null;
  return (
    <div className="grid gap-2 text-sm">
      {[
        { label: t("web.pens.actuation.operates"), parts: actuatedMechanisms },
        { label: t("web.pens.actuation.operatedBy"), parts: actuatingParts },
      ]
        .filter(({ parts }) => parts.length)
        .map(({ label, parts }) => (
          <div key={label}>
            <span className="font-medium">{label}</span>
            <ul className="grid gap-1">
              {parts.map((part) => (
                <li key={part.id}>
                  <Link
                    to="/products/$productTypeSlug/$productSlug"
                    params={{
                      productTypeSlug: part.productTypeSlug,
                      productSlug: part.slug,
                    }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {part.name}
                  </Link>
                  <PenPartRoleBadges part={part} />
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

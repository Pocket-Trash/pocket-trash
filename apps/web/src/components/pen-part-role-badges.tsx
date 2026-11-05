import {
  getPenPartRoles,
  type PenPartProductType,
  penPartInterchangeabilityKeys,
} from "@package/services/catalog-terminology";
import { Badge } from "@/components/ui/badge";
import { useCatalogCopy } from "@/lib/catalog-copy";

/**
 * Summarizes the functional roles of one physical Pen part.
 * @param props - Stable part identity and reviewed roles.
 * @returns Role badges with a shared-identity hint, or nothing for another product type.
 */
export function PenPartRoleBadges({
  part,
}: {
  /** Catalog or owned part whose roles are being summarized. */
  part: Parameters<typeof getPenPartRoles>[0];
}) {
  const t = useCatalogCopy();
  const roles = getPenPartRoles(part);
  if (!roles.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs">
      {roles.map((role) => {
        const type: PenPartProductType = `pen-${role}`;
        return (
          <Badge variant="outline" key={role}>
            {t(`catalog.penPartRoles.${penPartInterchangeabilityKeys[type]}`)}
          </Badge>
        );
      })}
      {roles.length > 1 ? (
        <span className="text-muted-foreground">
          {t("web.pens.partRoles.samePart")}
        </span>
      ) : null}
    </span>
  );
}

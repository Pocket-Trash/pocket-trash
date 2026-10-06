import type { PublicMakerSummary } from "@package/services";
import { Factory } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { cardImageUrl } from "@/lib/card-image";
import { useCatalogCopy } from "@/lib/catalog-copy";
import { cn } from "@/lib/utils";

/** Ordered table-of-contents labels for maker directory sections. */
const directoryLabels = [
  "0-9",
  ...Array.from({ length: 26 }, (_value, index) =>
    String.fromCharCode(65 + index),
  ),
] as const;

/** Maker directory section and its sorted entries. */
type MakerSection = {
  /** Stable section anchor. */
  id: string;
  /** Visible section label. */
  label: string;
  /** Makers assigned to this section. */
  makers: PublicMakerSummary[];
};

/**
 * Groups makers into the numeric, A–Z, and optional Other directory sections.
 *
 * @param makers - Public makers to organize.
 * @returns Ordered populated and empty directory sections.
 */
export function makerDirectorySections(
  makers: PublicMakerSummary[],
): MakerSection[] {
  const sorted = [...makers].sort((a, b) =>
    a.name.localeCompare(b.name, "en-US", { sensitivity: "base" }),
  );
  const sections = directoryLabels.map((label) => ({
    id: `makers-${label.toLowerCase()}`,
    label,
    makers: sorted.filter((maker) => makerSectionLabel(maker.name) === label),
  }));
  const other = sorted.filter(
    (maker) => makerSectionLabel(maker.name) === null,
  );
  return other.length
    ? [...sections, { id: "makers-other", label: "Other", makers: other }]
    : sections;
}

/**
 * Renders the public maker directory and Popular Makers ranking.
 *
 * @param props - Maker directory properties.
 * @returns The public Makers page.
 */
export function MakersDirectoryPage({
  makers,
}: {
  /** Every public maker directory entry. */
  makers: PublicMakerSummary[];
}) {
  const t = useCatalogCopy();
  const sections = makerDirectorySections(makers);
  const popular = [...makers]
    .sort(
      (a, b) =>
        b.collectionItemCount - a.collectionItemCount ||
        a.name.localeCompare(b.name, "en-US", { sensitivity: "base" }),
    )
    .slice(0, 8);

  return (
    <AppShell title={t("web.navigation.makers")}>
      <main className="mx-auto grid w-full max-w-7xl gap-8 p-4 md:p-6">
        <header className="grid gap-2">
          <h1 className="m-0 text-3xl font-semibold">
            {t("web.navigation.makers")}
          </h1>
          <p className="m-0 text-muted-foreground">
            {t("web.makers.directoryDescription")}
          </p>
        </header>

        {popular.length ? (
          <section aria-labelledby="popular-makers" className="grid gap-4">
            <h2 className="m-0 text-2xl font-semibold" id="popular-makers">
              {t("web.makers.popular")}
            </h2>
            <ul className="grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 lg:grid-cols-4">
              {popular.map((maker, index) => (
                <li
                  className={cn(
                    index >= 4 && index < 6 && "hidden md:block",
                    index >= 6 && "hidden lg:block",
                  )}
                  key={maker.id}
                >
                  <MakerCard maker={maker} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav
          aria-label={t("web.makers.tableOfContents")}
          className="flex flex-wrap gap-2"
        >
          {sections.slice(0, directoryLabels.length).map((section) =>
            section.makers.length ? (
              <a
                className="grid min-h-10 min-w-10 place-items-center rounded-md border border-border px-2 text-sm font-medium hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={`#${section.id}`}
                key={section.id}
              >
                {section.label}
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="grid min-h-10 min-w-10 place-items-center rounded-md border border-transparent px-2 text-sm text-muted-foreground/45"
                key={section.id}
              >
                {section.label}
              </span>
            ),
          )}
        </nav>

        {makers.length ? (
          sections
            .filter(({ makers: entries }) => entries.length)
            .map((section) => (
              <section
                aria-labelledby={`${section.id}-heading`}
                className="grid scroll-mt-20 gap-4"
                id={section.id}
                key={section.id}
              >
                <h2
                  className="m-0 border-b border-border pb-2 text-2xl font-semibold"
                  id={`${section.id}-heading`}
                >
                  {section.label === "Other"
                    ? t("web.makers.other")
                    : section.label}
                </h2>
                <ul className="grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 lg:grid-cols-4">
                  {section.makers.map((maker) => (
                    <li key={maker.id}>
                      <MakerCard maker={maker} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
            {t("web.makers.empty")}
          </p>
        )}
      </main>
    </AppShell>
  );
}

/** Properties for a maker directory card. */
interface MakerCardProps {
  /** Maker summarized by the card. */
  maker: PublicMakerSummary;
}

/**
 * Renders one compact maker directory card.
 *
 * @param props - Maker card properties.
 * @returns A linked maker summary card.
 */
function MakerCard({ maker }: MakerCardProps) {
  const t = useCatalogCopy();
  const image = maker.images[0];
  return (
    <a
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href={`/makers/${maker.slug}`}
    >
      <div className="grid aspect-4/3 place-items-center overflow-hidden bg-muted">
        {image ? (
          <img
            alt={t("web.makers.imageAlt", { name: maker.name })}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            loading="lazy"
            src={cardImageUrl(image.url)}
          />
        ) : (
          <Factory
            aria-hidden="true"
            className="size-8 text-muted-foreground"
          />
        )}
      </div>
      <div className="grid gap-2 p-3.5">
        <h3 className="m-0 line-clamp-2 text-[15px] leading-[1.3] font-semibold">
          {maker.name}
        </h3>
        <div className="grid gap-1 text-xs text-muted-foreground">
          <span>
            {t("web.makers.productCount", { count: maker.productCount })}
          </span>
          <span>
            {t("web.makers.collectionItemCount", {
              count: maker.collectionItemCount,
            })}
          </span>
        </div>
      </div>
    </a>
  );
}

/**
 * Resolves one maker name to its ASCII directory label.
 *
 * @param name - Maker display name.
 * @returns `0-9`, an uppercase ASCII letter, or `null` for Other.
 */
function makerSectionLabel(
  name: string,
): (typeof directoryLabels)[number] | null {
  const first = name.trim().charAt(0).toUpperCase();
  if (/^[0-9]$/u.test(first)) return "0-9";
  return /^[A-Z]$/u.test(first)
    ? (first as (typeof directoryLabels)[number])
    : null;
}

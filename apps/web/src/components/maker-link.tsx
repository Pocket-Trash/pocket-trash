import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders a maker name as an internal profile link when a slug is available.
 *
 * @param props - Maker link properties.
 * @param props.className - Additional CSS classes.
 * @param props.name - Maker name displayed to the user.
 * @param props.slug - Stable internal maker slug.
 * @param props.url - External maker URL, or `null` or an empty string to render plain text.
 * @returns The linked or plain-text maker name.
 */
export function MakerLink({
  className,
  name,
  slug,
  url,
}: {
  /**
   * Additional CSS classes.
   */
  className?: string;
  /** Maker name displayed to the user. */
  name: string;
  /** Stable internal maker slug. */
  slug?: string | null;
  /** External maker URL, or `null` or an empty string when unavailable. */
  url?: string | null;
}) {
  if (slug) {
    return (
      <Link
        className={cn(
          "underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        params={{ slug }}
        to="/makers/$slug"
      >
        {name}
      </Link>
    );
  }
  if (!url) return <span className={className}>{name}</span>;

  return (
    <a
      className={cn(
        "inline-flex items-center gap-1 underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {name}
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
    </a>
  );
}

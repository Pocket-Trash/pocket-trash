import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export function MakerLink({
  className,
  name,
  url,
}: {
  className?: string;
  name: string;
  url: string | null;
}) {
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

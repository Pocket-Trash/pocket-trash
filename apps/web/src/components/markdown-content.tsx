import { markdownToHtml } from "@package/markdown";
import { cn } from "@/lib/utils";

export function MarkdownContent({
  className,
  markdown,
}: {
  className?: string;
  markdown: string;
}) {
  return (
    <article
      className={cn(
        "grid gap-4 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:bg-accent/30 [&_blockquote]:p-4 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-2",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) ?? "" }}
    />
  );
}

import { markdownToHtml } from "@package/markdown";
import { cn } from "@/lib/utils";

/**
 * Renders Markdown through the shared sanitized read pipeline.
 *
 * @param props - Markdown source, styling, and trusted fenced-code capability.
 * @returns Sanitized Markdown content.
 */
export function MarkdownContent({
  className,
  markdown,
  trustedCodeBlocks = false,
}: {
  className?: string;
  markdown: string;
  /** Enables fenced code for trusted repository content. */
  trustedCodeBlocks?: boolean;
}) {
  return (
    <article
      className={cn(
        "markdown-content grid min-w-0 gap-4 [&_a]:break-words [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:bg-accent/30 [&_blockquote]:p-4 [&_h1]:mt-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li>ol]:mt-2 [&_li>ul]:mt-2 [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-2 [&_pre]:max-w-full [&_pre]:border [&_pre]:border-border [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2",
        className,
      )}
      dangerouslySetInnerHTML={{
        __html: markdownToHtml(markdown, { trustedCodeBlocks }) ?? "",
      }}
    />
  );
}

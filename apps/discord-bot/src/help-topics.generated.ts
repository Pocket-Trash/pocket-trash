/** Generated from packaged English help MDX; run pnpm generate:help. */
export const helpTopics = [
  {
    slug: "how-to-use-markdown",
    title: "How to Use Markdown",
  },
  {
    slug: "image-size-and-resolution-guide",
    title: "Image size and resolution guide",
  },
] as const;

/** Slugs offered by the installed English help documents. */
export type HelpTopicSlug = (typeof helpTopics)[number]["slug"];

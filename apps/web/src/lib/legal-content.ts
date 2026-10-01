import privacyPolicySource from "@pocket-trash/localizations/legal/en-US/privacy-policy.mdx?raw";
import termsOfServiceSource from "@pocket-trash/localizations/legal/en-US/terms-of-service.mdx?raw";
import { type HelpDocument, parseHelpDocument } from "./help-content";

/** Published legal documents keyed by their route slug. */
const documents = new Map([
  ["privacy-policy", parseLegalDocument(privacyPolicySource, "privacy-policy")],
  [
    "terms-of-service",
    parseLegalDocument(termsOfServiceSource, "terms-of-service"),
  ],
]);

/** Parsed legal Markdown and its required publication metadata. */
export type LegalDocument = HelpDocument;

/**
 * Resolves a published legal document by route slug.
 *
 * @param slug - Stable legal document slug.
 * @returns The parsed legal document.
 * @throws When the slug is not registered.
 */
export function getLegalDocument(slug: string): LegalDocument {
  const document = documents.get(slug);
  if (!document) throw new Error(`Unknown legal document: ${slug}.`);
  return document;
}

/**
 * Parses legal Markdown and verifies its publication metadata.
 *
 * @param source - Raw Markdown with frontmatter.
 * @param slug - Stable legal document slug used in errors.
 * @returns The parsed legal document.
 * @throws When required frontmatter is missing.
 */
function parseLegalDocument(source: string, slug: string): LegalDocument {
  const document = parseHelpDocument(source, slug);
  for (const key of ["effectiveDate", "version"]) {
    if (!document.metadata[key]) {
      throw new Error(`Legal document ${slug} is missing ${key}.`);
    }
  }
  return document;
}

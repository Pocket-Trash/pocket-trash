import privacyPolicySource from "@pocket-trash/localizations/legal/en-US/privacy-policy.mdx?raw";
import { type HelpDocument, parseHelpDocument } from "./help-content";

const documents = new Map([
  ["privacy-policy", parseLegalDocument(privacyPolicySource, "privacy-policy")],
]);

export type LegalDocument = HelpDocument;

export function getLegalDocument(slug: string): LegalDocument {
  const document = documents.get(slug);
  if (!document) throw new Error(`Unknown legal document: ${slug}.`);
  return document;
}

function parseLegalDocument(source: string, slug: string): LegalDocument {
  const document = parseHelpDocument(source, slug);
  for (const key of ["effectiveDate", "version"]) {
    if (!document.metadata[key]) {
      throw new Error(`Legal document ${slug} is missing ${key}.`);
    }
  }
  return document;
}

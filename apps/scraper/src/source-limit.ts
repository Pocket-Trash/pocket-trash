/**
 * Maximum records scraped per source outside production.
 */
export const nonProductionSourceScrapeLimit = 30;

/**
 * Resolves the per-source scrape cap for an application environment.
 *
 * @param appEnv - Application environment name.
 * @returns No limit in production; otherwise the non-production cap.
 */
export function getSourceScrapeLimit(appEnv: string | undefined) {
  return appEnv === "production" ? undefined : nonProductionSourceScrapeLimit;
}

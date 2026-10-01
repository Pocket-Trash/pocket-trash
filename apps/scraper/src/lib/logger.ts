import {
  createAxiomTransport,
  createConsoleTransport,
  createLogger,
  type Logger,
  loggerValues,
  normalizeConsoleTransportMode,
  normalizeLogLevel,
} from "@package/logger";

/**
 * Optional deployment and transport settings for the scraper logger.
 */
export type ScraperLoggerConfig = {
  /**
   * Application environment fallback used for log metadata.
   */
  appEnv?: string;
  /**
   * Axiom dataset and preferred log environment label.
   */
  axiomDataset?: string;
  /**
   * Optional Axiom edge-ingestion domain.
   */
  axiomEdgeDomain?: string;
  /**
   * Axiom ingestion token; requires `axiomDataset` to enable the transport.
   */
  axiomToken?: string;
  /**
   * Deployment identifier included in every log record.
   */
  deploymentId?: string;
  /**
   * Runtime platform included in every log record.
   */
  deploymentTarget?: string;
  /**
   * Console transport mode accepted by the shared logger normalizer.
   */
  loggerMode?: string;
  /**
   * Minimum log level accepted by the shared logger normalizer.
   */
  logLevel?: string;
  /**
   * Railway environment fallback for deployment metadata.
   */
  railwayEnvironmentName?: string;
};

/**
 * Creates the scraper logger with console output and optional Axiom ingestion.
 *
 * @param config - Deployment metadata and transport settings.
 * @returns The configured scraper logger.
 */
export function createScraperLogger(config: ScraperLoggerConfig): Logger {
  const hasAxiomConfig = Boolean(config.axiomToken && config.axiomDataset);
  const environment = config.axiomDataset ?? config.appEnv ?? "development";
  const deploymentTarget =
    config.deploymentTarget ??
    (config.railwayEnvironmentName ? "railway" : "local");
  const deploymentId =
    config.deploymentId ?? config.railwayEnvironmentName ?? environment;
  const consoleTransport = createConsoleTransport({
    mode: normalizeConsoleTransportMode(config.loggerMode),
  });
  const transports = [
    ...(hasAxiomConfig
      ? [
          createAxiomTransport({
            dataset: config.axiomDataset ?? "",
            edgeDomain: config.axiomEdgeDomain,
            token: config.axiomToken ?? "",
          }),
        ]
      : []),
    consoleTransport,
  ];

  return createLogger({
    app: loggerValues.apps.scraper,
    deploymentId,
    deploymentTarget,
    environment,
    level: normalizeLogLevel(config.logLevel),
    transports,
  });
}

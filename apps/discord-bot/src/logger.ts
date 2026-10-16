import {
  createAxiomTransport,
  createConsoleTransport,
  createLogger,
  loggerValues,
  normalizeConsoleTransportMode,
  normalizeLogLevel,
} from "@package/logger";

/**
 * Creates the centralized Discord bot logger.
 *
 * @param config - Runtime logging and deployment metadata.
 * @returns The configured structured logger.
 */
export function createDiscordBotLogger(config: {
  /** Application environment label. */
  appEnv: string;
  /** Optional Axiom dataset. */
  axiomDataset?: string;
  /** Optional Axiom edge-ingestion domain. */
  axiomEdgeDomain?: string;
  /** Optional Axiom ingestion token. */
  axiomToken?: string;
  /** Deployment identifier. */
  deploymentId?: string;
  /** Deployment platform. */
  deploymentTarget?: string;
  /** Console logger mode. */
  loggerMode?: string;
  /** Minimum emitted level. */
  logLevel?: string;
  /** Railway environment name. */
  railwayEnvironmentName?: string;
}) {
  const transports = [
    ...(config.axiomDataset && config.axiomToken
      ? [
          createAxiomTransport({
            dataset: config.axiomDataset,
            edgeDomain: config.axiomEdgeDomain,
            token: config.axiomToken,
          }),
        ]
      : []),
    createConsoleTransport({
      mode: normalizeConsoleTransportMode(config.loggerMode),
    }),
  ];

  return createLogger({
    app: loggerValues.apps.discordBot,
    deploymentId:
      config.deploymentId ?? config.railwayEnvironmentName ?? config.appEnv,
    deploymentTarget:
      config.deploymentTarget ??
      (config.railwayEnvironmentName ? "railway" : "local"),
    environment: config.axiomDataset ?? config.appEnv,
    level: normalizeLogLevel(config.logLevel),
    transports,
  });
}

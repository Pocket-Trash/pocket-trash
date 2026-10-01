/** The Infisical environment used unless a command selects another one. */
export const defaultEnvironmentSlug = "dev";

/** The Infisical path for API application secrets. */
const apiSecretPath = "/apps/api";
/** The Infisical path for local Bunny credentials. */
const bunnyLocalSecretPath = "/local/bunny";
/** The Infisical path for local Clerk credentials. */
const clerkLocalSecretPath = "/local/clerk";
/** The Infisical path for Cloudflare tooling credentials. */
const cloudflareToolsSecretPath = "/tools/cloudflare";
/** The Infisical path for personal database URLs. */
const databaseLocalSecretPath = "/local/database";
/** The Infisical path for scraper application secrets. */
const scraperSecretPath = "/apps/scraper";
/** The Infisical path for web application secrets. */
const webSecretPath = "/apps/web";
/** The Infisical path for GitHub workflow secrets. */
const githubSecretsPath = "tools/github/secrets";
/** The Infisical path for Axiom logger test credentials. */
const loggerAxiomTestSecretPath = "/tools/logger-axiom-test";

/** Secret-injection policy for one application command. */
export type CommandSecretConfig = {
  /** Whether server-only paths may be injected into the command. */
  allowServerSecrets: boolean;
  /** Whether to select a user-specific database URL from local files. */
  databaseUrlUserOverride?: boolean;
  /** Environment variables copied under alternate names before execution. */
  envAliases?: readonly EnvironmentAlias[];
  /** The Infisical environment override for this command. */
  environmentSlug?: string;
  /** The ordered, non-empty Infisical paths injected into the command. */
  paths: readonly [string, ...string[]];
};

/** A source and destination pair for an environment variable alias. */
export type EnvironmentAlias = {
  /** The existing environment variable name. */
  from: string;
  /** The destination environment variable name. */
  to: string;
};

/** Shared secret policy for scraper commands. */
const scraperCommandSecretConfig = {
  allowServerSecrets: true,
  databaseUrlUserOverride: true,
  paths: [scraperSecretPath, databaseLocalSecretPath],
} as const satisfies CommandSecretConfig;

/** Shared secret policy for local API commands. */
const apiCommandSecretConfig = {
  allowServerSecrets: true,
  databaseUrlUserOverride: true,
  paths: [apiSecretPath, databaseLocalSecretPath],
} as const satisfies CommandSecretConfig;

/** Maps application commands to the Infisical secret paths they require. */
export const commandSecrets = {
  api: {
    dev: apiCommandSecretConfig,
    deploy: {
      allowServerSecrets: true,
      environmentSlug: "prod",
      paths: [cloudflareToolsSecretPath],
    },
    "deploy:development": {
      allowServerSecrets: true,
      environmentSlug: "dev",
      paths: [cloudflareToolsSecretPath],
    },
    "deploy:preview": {
      allowServerSecrets: true,
      environmentSlug: "preview",
      paths: [cloudflareToolsSecretPath],
    },
    "users:reconcile": apiCommandSecretConfig,
  },
  bunny: {
    audit: {
      allowServerSecrets: true,
      paths: [bunnyLocalSecretPath],
    },
  },
  database: {
    "db:migrate": {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath, databaseLocalSecretPath],
    },
    "db:seed": {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath, databaseLocalSecretPath],
    },
    "db:studio": {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath, databaseLocalSecretPath],
    },
    "resources:reconcile-storage": {
      allowServerSecrets: true,
      environmentSlug: "preview",
      paths: [webSecretPath, githubSecretsPath],
    },
  },
  github: {
    "discord-notify": {
      allowServerSecrets: true,
      paths: [githubSecretsPath],
    },
  },
  logger: {
    "test:axiom": {
      allowServerSecrets: true,
      paths: [loggerAxiomTestSecretPath],
    },
  },
  scraper: {
    "cron:run": scraperCommandSecretConfig,
    dev: scraperCommandSecretConfig,
    "process:dead-letter": scraperCommandSecretConfig,
    "process:queue": scraperCommandSecretConfig,
    scrape: scraperCommandSecretConfig,
    "scrape:autmog": scraperCommandSecretConfig,
    "scrape:grimsmo-fjell": scraperCommandSecretConfig,
    "scrape:grimsmo-norseman": scraperCommandSecretConfig,
    "scrape:grimsmo-rask": scraperCommandSecretConfig,
    "scrape:grimsmo-saga": scraperCommandSecretConfig,
  },
  web: {
    build: {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath, databaseLocalSecretPath],
    },
    dev: {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath, databaseLocalSecretPath],
    },
    test: {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath, databaseLocalSecretPath],
    },
    "test:watch": {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath, databaseLocalSecretPath],
    },
  },
  webhooks: {
    listen: {
      allowServerSecrets: true,
      paths: [clerkLocalSecretPath],
    },
  },
} as const satisfies Record<string, Record<string, CommandSecretConfig>>;

export const defaultEnvironmentSlug = "dev";

const bunnyLocalSecretPath = "/local/bunny";
const scraperSecretPath = "/apps/scraper";
const webSecretPath = "/apps/web";
const githubSecretsPath = "tools/github/secrets";
const loggerAxiomTestSecretPath = "/tools/logger-axiom-test";
export const databaseUrlUserOverrideSecretPath = "/local/database";

export type CommandSecretConfig = {
  allowServerSecrets: boolean;
  databaseUrlUserOverride?: boolean;
  envAliases?: readonly EnvironmentAlias[];
  environmentSlug?: string;
  paths: readonly [string, ...string[]];
};

export type EnvironmentAlias = {
  from: string;
  to: string;
};

const scraperCommandSecretConfig = {
  allowServerSecrets: true,
  databaseUrlUserOverride: true,
  paths: [scraperSecretPath],
} as const satisfies CommandSecretConfig;

export const commandSecrets = {
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
      paths: [webSecretPath],
    },
    "db:studio": {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath],
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
      paths: [webSecretPath],
    },
    dev: {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath],
    },
    test: {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath],
    },
    "test:watch": {
      allowServerSecrets: true,
      databaseUrlUserOverride: true,
      paths: [webSecretPath],
    },
  },
} as const satisfies Record<string, Record<string, CommandSecretConfig>>;

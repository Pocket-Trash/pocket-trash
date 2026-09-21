export const defaultEnvironmentSlug = "dev";

const apiSecretPath = "/apps/api";
const bunnyLocalSecretPath = "/local/bunny";
const cloudflareToolsSecretPath = "/tools/cloudflare";
const databaseLocalSecretPath = "/local/database";
const scraperSecretPath = "/apps/scraper";
const webSecretPath = "/apps/web";
const githubSecretsPath = "tools/github/secrets";
const loggerAxiomTestSecretPath = "/tools/logger-axiom-test";

export type CommandSecretConfig = {
  allowServerSecrets: boolean;
  databaseUrlUserOverride?: boolean;
  envAliases?: readonly EnvironmentAlias[];
  environmentSlug?: string;
  paths: readonly string[];
};

export type EnvironmentAlias = {
  from: string;
  to: string;
};

const scraperCommandSecretConfig = {
  allowServerSecrets: true,
  databaseUrlUserOverride: true,
  paths: [scraperSecretPath, databaseLocalSecretPath],
} as const satisfies CommandSecretConfig;

const apiCommandSecretConfig = {
  allowServerSecrets: true,
  databaseUrlUserOverride: true,
  paths: [apiSecretPath, databaseLocalSecretPath],
} as const satisfies CommandSecretConfig;

export const commandSecrets = {
  api: {
    dev: apiCommandSecretConfig,
    deploy: {
      allowServerSecrets: true,
      environmentSlug: "prod",
      paths: [cloudflareToolsSecretPath],
    },
    "deploy:preview": {
      allowServerSecrets: true,
      environmentSlug: "preview",
      paths: [cloudflareToolsSecretPath],
    },
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
      paths: [webSecretPath],
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
} as const satisfies Record<string, Record<string, CommandSecretConfig>>;

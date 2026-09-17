import process from "node:process";
import {
  createAxiomTransport,
  createConsoleTransport,
  loggerValues,
  normalizeConsoleTransportMode,
  normalizeLogLevel,
} from "@package/logger";
import services from "@package/services";
import { serverEnv } from "@/env/server";

const environment = process.env.NODE_ENV ?? "development";
const isDevelopment = environment === "development";
const consoleTransport = createConsoleTransport({
  mode: normalizeConsoleTransportMode(serverEnv.LOGGER),
});

const transports = [
  ...(serverEnv.AXIOM_TOKEN && serverEnv.AXIOM_DATASET
    ? [
        createAxiomTransport({
          dataset: serverEnv.AXIOM_DATASET,
          edgeDomain: serverEnv.AXIOM_EDGE_DOMAIN,
          token: serverEnv.AXIOM_TOKEN,
        }),
      ]
    : []),
  ...(isDevelopment || !(serverEnv.AXIOM_TOKEN && serverEnv.AXIOM_DATASET)
    ? [consoleTransport]
    : []),
];

const logger = {
  app: loggerValues.apps.web,
  deploymentId: serverEnv.LOG_DEPLOYMENT_ID ?? environment,
  deploymentTarget: serverEnv.LOG_DEPLOYMENT_TARGET ?? "web-server",
  environment,
  level: normalizeLogLevel(serverEnv.LOG_LEVEL),
  transports,
};

services.configure({
  db: {
    databaseUrl: serverEnv.DATABASE_URL,
  },
  logger,
  resources:
    serverEnv.RESOURCE_STORAGE_ACCESS_KEY &&
    serverEnv.RESOURCE_CDN_BASE_URL &&
    serverEnv.RESOURCE_STORAGE_ENDPOINT &&
    serverEnv.RESOURCE_STORAGE_ZONE_NAME
      ? {
          accessKey: serverEnv.RESOURCE_STORAGE_ACCESS_KEY,
          cdnBaseUrl: serverEnv.RESOURCE_CDN_BASE_URL,
          endpoint: serverEnv.RESOURCE_STORAGE_ENDPOINT,
          folderPrefix: serverEnv.RESOURCE_FOLDER_PREFIX,
          zoneName: serverEnv.RESOURCE_STORAGE_ZONE_NAME,
        }
      : undefined,
});

export { services as s };

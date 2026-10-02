import {
  createLogger,
  createProxyTransport,
  loggerValues,
} from "@package/logger";
import { clientEnv } from "@/env/client";

/** Browser logger configured to forward events through the web log proxy. */
export const logger = createLogger({
  app: loggerValues.apps.web,
  deploymentId: clientEnv.VITE_LOG_DEPLOYMENT_ID ?? import.meta.env.MODE,
  deploymentTarget: clientEnv.VITE_LOG_DEPLOYMENT_TARGET ?? "web-client",
  environment: import.meta.env.MODE,
  transports: [
    createProxyTransport({
      clientKey: clientEnv.VITE_LOG_PROXY_CLIENT_KEY,
      url: "/api/v0/logs",
    }),
  ],
});

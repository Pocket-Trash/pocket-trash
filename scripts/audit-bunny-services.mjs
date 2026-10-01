import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Bunny management API base URL. */
const apiBaseUrl = "https://api.bunny.net";
/** Default directory for raw audit responses and the report. */
const defaultOutputDirectory = "bunny-audit";

/** Bunny endpoints and resource-specific summarizers included in the audit. */
const endpoints = [
  {
    name: "CDN Pull Zones",
    path: "/pullzone?page=1&perPage=1000",
    summarize: summarizePullZones,
  },
  {
    name: "Storage Zones",
    path: "/storagezone?includeDeleted=true",
    summarize: summarizeStorageZones,
  },
  {
    name: "Stream Libraries",
    path: "/videolibrary?page=1&perPage=1000",
    summarize: summarizeStreamLibraries,
  },
  {
    name: "DNS Zones",
    path: "/dnszone?page=1&perPage=1000",
    summarize: summarizeDnsZones,
  },
  {
    name: "Edge Scripts",
    path: "/compute/script?page=1&perPage=1000&includeLinkedPullzones=true",
    summarize: summarizeEdgeScripts,
  },
  {
    name: "Databases",
    path: "/database/v2/databases?page=1&perPage=1000",
    summarize: summarizeDatabases,
  },
  {
    name: "Magic Containers",
    path: "/mc/apps?limit=100",
    summarize: summarizeMagicContainers,
  },
  {
    name: "Shield Zones",
    path: "/shield/shield-zones?page=1&perPage=1000",
    summarize: summarizeShieldZones,
  },
  {
    name: "Billing Payment Requests",
    path: "/billing/payment-requests",
    summarize: summarizePaymentRequests,
  },
  {
    name: "Account CDN Statistics",
    path: "/statistics?loadBandwidthUsed=true&loadOriginTraffic=true&loadRequestsServed=true&loadOriginShieldBandwidth=true&loadUserBalanceHistory=true",
    summarize: summarizeAccountStatistics,
  },
];

/** Bunny API credential injected by the local runner. */
const apiKey = process.env.BUNNY_API_KEY?.trim();

if (!apiKey) {
  throw new Error(
    "BUNNY_API_KEY is required. Run with `pnpm bunny:audit` or set it locally.",
  );
}

/** Output directory selected by the CLI or default. */
const outputDirectory = getOutputDirectory();
await mkdir(outputDirectory, { recursive: true });

/** Endpoint audit results used to build the report. */
const results = [];

/** Audits each configured Bunny endpoint and saves its raw response. */
for (const endpoint of endpoints) {
  const result = await fetchEndpoint(endpoint);
  results.push(result);

  await writeFile(
    join(outputDirectory, `${slugify(endpoint.name)}.json`),
    `${JSON.stringify(result.raw, null, 2)}\n`,
  );
}

/** Complete human-readable Bunny services audit report. */
const report = buildMarkdownReport(results);
await writeFile(join(outputDirectory, "report.md"), report);

console.log(report);
console.log(`\nReport written to ${join(outputDirectory, "report.md")}`);

/**
 * Resolves the audit output directory from `--out=`.
 *
 * @returns The requested or default output directory.
 */
function getOutputDirectory() {
  const outputArg = process.argv.find((arg) => arg.startsWith("--out="));

  return outputArg?.slice("--out=".length) || defaultOutputDirectory;
}

/**
 * Fetches and summarizes one Bunny API endpoint without failing the audit.
 *
 * @param endpoint - Endpoint path, display name, and summarizer.
 * @returns The raw response, summary, and optional error message.
 */
async function fetchEndpoint(endpoint) {
  try {
    const response = await fetch(`${apiBaseUrl}${endpoint.path}`, {
      headers: {
        AccessKey: apiKey,
        "Content-Type": "application/json",
      },
    });
    const raw = await readJsonResponse(response);

    if (!response.ok) {
      return {
        endpoint,
        error: `${response.status} ${response.statusText}`,
        raw,
        summary: [],
      };
    }

    return {
      endpoint,
      raw,
      summary: endpoint.summarize(raw),
    };
  } catch (error) {
    return {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
      raw: null,
      summary: [],
    };
  }
}

/**
 * Reads a response body as JSON when possible.
 *
 * @param response - Fetch response to consume.
 * @returns Parsed JSON, raw text, or `null` for an empty body.
 * @rejects When the response body cannot be read.
 */
async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Builds the human-readable audit report.
 *
 * @param results - Endpoint audit results.
 * @returns Markdown summarizing usage, details, and attention items.
 */
function buildMarkdownReport(results) {
  const lines = [
    "# Bunny Services Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
  ];

  for (const result of results) {
    if (result.error) {
      lines.push(`- ${result.endpoint.name}: check failed (${result.error})`);
      continue;
    }

    const activeCount = result.summary.filter((item) => item.inUse).length;
    const totalCount = result.summary.length;
    lines.push(
      `- ${result.endpoint.name}: ${activeCount} in use / ${totalCount} found`,
    );
  }

  for (const result of results) {
    lines.push("", `## ${result.endpoint.name}`, "");

    if (result.error) {
      lines.push(`Check failed: ${result.error}`);
      continue;
    }

    if (result.summary.length === 0) {
      lines.push("No resources found.");
      continue;
    }

    for (const item of result.summary) {
      lines.push(`### ${item.name}`, "");
      lines.push(`- Status: ${item.inUse ? "in use" : "not in use"}`);

      for (const detail of item.details) {
        lines.push(`- ${detail}`);
      }

      if (item.attention.length > 0) {
        lines.push(`- Check: ${item.attention.join("; ")}`);
      }

      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

/**
 * Summarizes Bunny CDN pull zones.
 *
 * @param raw - Pull zone API response.
 * @returns Normalized audit items.
 */
function summarizePullZones(raw) {
  return getItems(raw).map((zone) => {
    const monthlyCharges = numberValue(zone.MonthlyCharges);
    const monthlyBandwidthUsed = numberValue(zone.MonthlyBandwidthUsed);
    const hostnames = getArray(zone.Hostnames)
      .map((hostname) => hostname.Value)
      .filter(Boolean);
    const activeFeatures = [
      zone.EnableOptimizer ? "optimizer" : null,
      zone.EnableBunnyImageAi ? "Bunny Image AI" : null,
      zone.EnableOriginShield ? "origin shield" : null,
      zone.ShieldDDosProtectionEnabled ? "Shield DDoS" : null,
      zone.EnableExtendedLogging ? "extended logging" : null,
      zone.EdgeScriptId ? "edge script" : null,
      zone.MiddlewareScriptId ? "middleware script" : null,
      zone.MagicContainersAppId ? "Magic Containers origin" : null,
    ].filter(Boolean);

    return {
      attention: activeFeatures,
      details: [
        `ID: ${zone.Id}`,
        `Enabled: ${formatBoolean(zone.Enabled)}`,
        `Suspended: ${formatBoolean(zone.Suspended)}`,
        `Monthly charges: ${formatMoney(monthlyCharges)}`,
        `Monthly bandwidth: ${formatBytes(monthlyBandwidthUsed)}`,
        `Origin: ${zone.OriginUrl ?? zone.OriginLinkValue ?? "unknown"}`,
        `Hostnames: ${hostnames.join(", ") || "none"}`,
      ],
      inUse:
        zone.Enabled === true ||
        monthlyCharges > 0 ||
        monthlyBandwidthUsed > 0 ||
        activeFeatures.length > 0,
      name: zone.Name ?? `Pull Zone ${zone.Id}`,
    };
  });
}

/**
 * Summarizes Bunny storage zones.
 *
 * @param raw - Storage zone API response.
 * @returns Normalized audit items.
 */
function summarizeStorageZones(raw) {
  return getItems(raw).map((zone) => {
    const storageUsed = numberValue(zone.StorageUsed);
    const filesStored = numberValue(zone.FilesStored);
    const replicationRegions = getArray(zone.ReplicationRegions).filter(
      Boolean,
    );
    const linkedPullZones = getArray(zone.PullZones)
      .map((pullZone) => pullZone.Name)
      .filter(Boolean);

    return {
      attention: [
        replicationRegions.length > 0 ? "replication regions enabled" : null,
        linkedPullZones.length > 0 ? "linked pull zones" : null,
      ].filter(Boolean),
      details: [
        `ID: ${zone.Id}`,
        `Deleted: ${formatBoolean(zone.Deleted)}`,
        `Storage used: ${formatBytes(storageUsed)}`,
        `Files stored: ${filesStored}`,
        `Primary region: ${zone.Region ?? "unknown"}`,
        `Replication regions: ${replicationRegions.join(", ") || "none"}`,
        `Linked pull zones: ${linkedPullZones.join(", ") || "none"}`,
      ],
      inUse: zone.Deleted !== true && (storageUsed > 0 || filesStored > 0),
      name: zone.Name ?? `Storage Zone ${zone.Id}`,
    };
  });
}

/**
 * Summarizes Bunny Stream libraries.
 *
 * @param raw - Stream library API response.
 * @returns Normalized audit items.
 */
function summarizeStreamLibraries(raw) {
  return getItems(raw).map((library) => {
    const videoCount = numberValue(library.VideoCount);
    const trafficUsage = numberValue(library.TrafficUsage);
    const storageUsage = numberValue(library.StorageUsage);
    const charges = [
      numberValue(library.MonthlyChargesTranscribing),
      numberValue(library.MonthlyChargesPremiumEncoding),
      numberValue(library.MonthlyChargesEnterpriseDrm),
    ];

    return {
      attention: [
        charges[0] > 0 ? "transcribing charges" : null,
        charges[1] > 0 ? "premium encoding charges" : null,
        charges[2] > 0 ? "enterprise DRM charges" : null,
      ].filter(Boolean),
      details: [
        `ID: ${library.Id}`,
        `Videos: ${videoCount}`,
        `Traffic usage: ${formatBytes(trafficUsage)}`,
        `Storage usage: ${formatBytes(storageUsage)}`,
        `Transcribing charges: ${formatMoney(charges[0])}`,
        `Premium encoding charges: ${formatMoney(charges[1])}`,
        `Enterprise DRM charges: ${formatMoney(charges[2])}`,
      ],
      inUse:
        videoCount > 0 ||
        trafficUsage > 0 ||
        storageUsage > 0 ||
        charges.some((charge) => charge > 0),
      name: library.Name ?? `Stream Library ${library.Id}`,
    };
  });
}

/**
 * Summarizes Bunny DNS zones.
 *
 * @param raw - DNS zone API response.
 * @returns Normalized audit items.
 */
function summarizeDnsZones(raw) {
  return getItems(raw).map((zone) => {
    const recordCount = numberValue(zone.Records?.length ?? zone.RecordCount);

    return {
      attention: [],
      details: [
        `ID: ${zone.Id}`,
        `Domain: ${zone.Domain ?? zone.Name ?? "unknown"}`,
        `Records: ${recordCount}`,
        `Logging enabled: ${formatBoolean(zone.LoggingEnabled)}`,
      ],
      inUse: recordCount > 0 || zone.Disabled === false,
      name: zone.Domain ?? zone.Name ?? `DNS Zone ${zone.Id}`,
    };
  });
}

/**
 * Summarizes Bunny Edge Scripts.
 *
 * @param raw - Edge Script API response.
 * @returns Normalized audit items.
 */
function summarizeEdgeScripts(raw) {
  return getItems(raw).map((script) => {
    const monthlyCost = numberValue(script.MonthlyCost);
    const monthlyRequestCount = numberValue(script.MonthlyRequestCount);
    const monthlyCpuTime = numberValue(script.MonthlyCpuTime);
    const linkedPullZones = getArray(script.LinkedPullZones)
      .map((zone) => zone.PullZoneName)
      .filter(Boolean);

    return {
      attention: linkedPullZones.length > 0 ? ["linked to pull zones"] : [],
      details: [
        `ID: ${script.Id}`,
        `Deleted: ${formatBoolean(script.Deleted)}`,
        `Current release: ${script.CurrentReleaseId ?? "none"}`,
        `Monthly cost: ${formatMoney(monthlyCost)}`,
        `Monthly requests: ${monthlyRequestCount}`,
        `Monthly CPU time: ${monthlyCpuTime}`,
        `Linked pull zones: ${linkedPullZones.join(", ") || "none"}`,
      ],
      inUse:
        script.Deleted !== true &&
        (script.CurrentReleaseId ||
          monthlyCost > 0 ||
          monthlyRequestCount > 0 ||
          monthlyCpuTime > 0 ||
          linkedPullZones.length > 0),
      name: script.Name ?? `Edge Script ${script.Id}`,
    };
  });
}

/**
 * Summarizes Bunny database resources across API naming variants.
 *
 * @param raw - Database API response.
 * @returns Normalized audit items.
 */
function summarizeDatabases(raw) {
  return getItems(raw).map((database) => {
    const sizeBytes = numberValue(
      database.sizeBytes ?? database.size_bytes ?? database.SizeBytes,
    );
    const status = database.status ?? database.Status ?? "unknown";
    const regions = getArray(
      database.primaryRegions ??
        database.primary_regions ??
        database.PrimaryRegions ??
        database.regions ??
        database.Regions,
    ).filter(Boolean);

    return {
      attention: regions.length > 1 ? ["multiple regions"] : [],
      details: [
        `ID: ${database.id ?? database.Id ?? "unknown"}`,
        `Status: ${status}`,
        `Size: ${formatBytes(sizeBytes)}`,
        `Regions: ${regions.join(", ") || "unknown"}`,
      ],
      inUse: status !== "deleted" && status !== "Deleted",
      name:
        database.name ??
        database.Name ??
        `Database ${database.id ?? database.Id ?? "unknown"}`,
    };
  });
}

/**
 * Summarizes Bunny Magic Containers applications.
 *
 * @param raw - Magic Containers API response.
 * @returns Normalized audit items.
 */
function summarizeMagicContainers(raw) {
  return getItems(raw).map((app) => {
    const id = app.id ?? app.Id ?? app.appId ?? app.AppId ?? "unknown";
    const status =
      app.status ?? app.Status ?? app.state ?? app.State ?? "unknown";
    const endpoints = getArray(app.endpoints ?? app.Endpoints);
    const regions = getArray(app.regions ?? app.Regions).filter(Boolean);

    return {
      attention: endpoints.length > 0 ? ["public endpoints"] : [],
      details: [
        `ID: ${id}`,
        `Status: ${status}`,
        `Regions: ${regions.join(", ") || "unknown"}`,
        `Endpoints: ${endpoints.length}`,
      ],
      inUse: status !== "deleted" && status !== "Deleted",
      name:
        app.name ??
        app.Name ??
        app.displayName ??
        app.DisplayName ??
        `App ${id}`,
    };
  });
}

/**
 * Summarizes Bunny Shield zones.
 *
 * @param raw - Shield zone API response.
 * @returns Normalized audit items.
 */
function summarizeShieldZones(raw) {
  return getItems(raw).map((zone) => {
    const id = zone.shieldZoneId ?? zone.Id ?? "unknown";
    const wafEnabled = zone.wafEnabled ?? zone.WafEnabled;
    const shieldEnabled =
      wafEnabled === true ||
      zone.dDoSExecutionMode !== undefined ||
      zone.dDoSShieldSensitivity !== undefined ||
      zone.blockVpn === true ||
      zone.blockTor === true ||
      zone.blockDatacentre === true;

    return {
      attention: [
        wafEnabled ? "WAF enabled" : null,
        zone.blockVpn ? "VPN blocking" : null,
        zone.blockTor ? "Tor blocking" : null,
        zone.blockDatacentre ? "datacenter blocking" : null,
      ].filter(Boolean),
      details: [
        `Shield zone ID: ${id}`,
        `Pull zone ID: ${zone.pullZoneId ?? zone.PullZoneId ?? "unknown"}`,
        `Plan type: ${zone.planType ?? zone.PlanType ?? "unknown"}`,
        `WAF enabled: ${formatBoolean(wafEnabled)}`,
        `Learning mode: ${formatBoolean(zone.learningMode)}`,
      ],
      inUse: shieldEnabled,
      name: `Shield Zone ${id}`,
    };
  });
}

/**
 * Summarizes Bunny billing payment requests.
 *
 * @param raw - Payment request API response.
 * @returns Normalized audit items.
 */
function summarizePaymentRequests(raw) {
  return getItems(raw).map((request) => {
    const amount = numberValue(request.Amount);

    return {
      attention: request.Paid === false ? ["unpaid"] : [],
      details: [
        `ID: ${request.Id}`,
        `Amount: ${formatMoney(amount)}`,
        `Description: ${request.Description ?? "none"}`,
        `Due: ${request.DateDue ?? "unknown"}`,
        `Paid: ${formatBoolean(request.Paid)}`,
      ],
      inUse: amount > 0 && request.Paid === false,
      name: request.Description ?? `Payment request ${request.Id}`,
    };
  });
}

/**
 * Summarizes account-wide CDN usage statistics.
 *
 * @param raw - Account statistics API response.
 * @returns A single normalized usage audit item.
 */
function summarizeAccountStatistics(raw) {
  const bandwidthUsed = numberValue(raw?.TotalBandwidthUsed);
  const originTraffic = numberValue(raw?.TotalOriginTraffic);
  const requestsServed = numberValue(raw?.TotalRequestsServed);

  return [
    {
      attention: [],
      details: [
        `Total bandwidth used: ${formatBytes(bandwidthUsed)}`,
        `Total origin traffic: ${formatBytes(originTraffic)}`,
        `Total requests served: ${requestsServed}`,
        `Cache hit rate: ${raw?.CacheHitRate ?? "unknown"}`,
      ],
      inUse: bandwidthUsed > 0 || originTraffic > 0 || requestsServed > 0,
      name: "Account CDN usage",
    },
  ];
}

/**
 * Normalizes common Bunny collection response shapes.
 *
 * @param raw - Candidate collection response.
 * @returns The contained items or an empty array.
 */
function getItems(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (Array.isArray(raw?.Items)) {
    return raw.Items;
  }

  if (Array.isArray(raw?.items)) {
    return raw.items;
  }

  if (Array.isArray(raw?.data)) {
    return raw.data;
  }

  return [];
}

/**
 * Narrows a value to an array.
 *
 * @param value - Candidate array value.
 * @returns The array or an empty array.
 */
function getArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Formats a boolean for the audit report.
 *
 * @param value - Candidate boolean value.
 * @returns `yes`, `no`, or `unknown`.
 */
function formatBoolean(value) {
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  return "unknown";
}

/**
 * Formats a byte count with a compact binary unit.
 *
 * @param value - Byte count.
 * @returns The formatted size, using zero for invalid or non-positive values.
 */
function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = value;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Formats a numeric dollar amount with four decimal places.
 *
 * @param value - Candidate monetary value.
 * @returns The formatted amount or `unknown`.
 */
function formatMoney(value) {
  if (!Number.isFinite(value)) {
    return "unknown";
  }

  return `$${value.toFixed(4)}`;
}

/**
 * Coerces a value to a finite number.
 *
 * @param value - Candidate numeric value.
 * @returns The finite number or zero.
 */
function numberValue(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

/**
 * Converts a display name into a lowercase filename slug.
 *
 * @param value - Display name.
 * @returns The slug.
 */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createAxiomTransport } from "@package/logger";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { parseAxiomMessage } from "../dist/axiom-fallback.js";

/** Unique marker shared by this run's synthetic events. */
const marker = `eng502-calibration-${randomUUID()}`;
/** Exact private intake source authorized for this calibration. */
const channelId = process.env.DISCORD_AXIOM_INTAKE_CHANNEL_ID;
/** Trusted webhook identity derived from its canonical secret URL. */
const webhookId = new URL(process.env.AXIOM_INTAKE_WEBHOOK_URL).pathname.split(
  "/",
)[3];
/** Read-only gateway observer; never dispatches commands or notifications. */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
/** Matching raw Discord gateway packets observed during this run. */
const captured = [];
/** Synthetic event envelopes submitted through Axiom ingestion. */
const events = ["error", "fatal"].map((level) => ({
  eventId: `${marker}-${level}`,
  timestamp: new Date().toISOString(),
  app: "api",
  environment: "production",
  deploymentTarget: "calibration",
  deploymentId: marker,
  level,
  message: `${marker}.${level}`,
  error: {
    name: "CalibrationError",
    message: `Synthetic ${level} for ENG-502; no production failure`,
  },
  attributes: { calibration: marker, count: 42 },
  context: { source: "axiom-fallback-calibration", runId: marker },
}));
/** Overall deadline prevents leaving a second gateway observer running. */
const timeout = setTimeout(() => {
  process.stderr.write(
    `Calibration timed out: ${captured.length}/2 matching gateway messages\n`,
  );
  client.destroy();
  process.exitCode = 1;
}, 180_000);
client.on(Events.Raw, (packet) => {
  if (
    packet.t !== "MESSAGE_CREATE" ||
    packet.d.channel_id !== channelId ||
    packet.d.webhook_id !== webhookId
  )
    return;
  if (!JSON.stringify(packet.d).includes(marker)) return;
  try {
    const actual = parseAxiomMessage(packet.d);
    const expected = events.find((event) => event.eventId === actual.eventId);
    assert.ok(expected, "Captured event must belong to this run");
    assert.deepEqual(actual, { ...expected, version: 1 });
    captured.push(packet.d);
    process.stdout.write(
      `${JSON.stringify({ marker, parsedEventId: actual.eventId, verified: true })}\n`,
    );
  } catch (error) {
    clearTimeout(timeout);
    client.destroy();
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  if (captured.length >= 2) {
    clearTimeout(timeout);
    client.destroy();
  }
});
try {
  await client.login(process.env.DISCORD_TOKEN);
  const transport = createAxiomTransport({
    dataset: "production",
    token: process.env.AXIOM_TOKEN,
  });
  for (const event of events) await transport.log(event);
  process.stdout.write(
    `${JSON.stringify({ marker, ingested: events.length })}\n`,
  );
  const direct = await fetch(
    "https://discord.pocket-trash.app/webhooks/logger",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LOGGER_NOTIFICATION_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...events[0], version: 1 }),
    },
  );
  assert.equal(
    direct.status,
    202,
    "Direct intake must durably accept the synthetic event",
  );
  let delivered = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${process.env.DISCORD_LOGGER_CHANNEL_ID}/messages?limit=10`,
      {
        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
      },
    );
    assert.equal(
      response.ok,
      true,
      "Final notification channel must be readable",
    );
    const messages = await response.json();
    delivered = messages.some((message) =>
      JSON.stringify(message.components).includes(marker),
    );
    if (delivered) break;
    await delay(2_000);
  }
  assert.equal(
    delivered,
    true,
    "Direct queue worker must deliver the synthetic event to Discord",
  );
  process.stdout.write(
    `${JSON.stringify({ marker, directDeliveryVerified: true })}\n`,
  );
} catch (error) {
  clearTimeout(timeout);
  client.destroy();
  throw error;
}

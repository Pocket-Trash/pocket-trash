import sharp from "sharp";
import { expect, it, vi } from "vitest";
import type { TicketFile, TicketSnapshot } from "./model.js";
import { createTicketSummarizer, prepareTicketEvidence } from "./summary.js";

/** Minimal inline source, not a bulk evaluation corpus or real Discord message. */
const snapshot: TicketSnapshot = {
  threadId: "223456789012345678",
  threadUrl:
    "https://discord.com/channels/123456789012345678/223456789012345678",
  messages: [],
};
/** Minimal schema-valid mock output; no inference is performed. */
const summary = {
  title: "Missing export row",
  summary: "Export omits one item",
  reproductionSteps: [],
  expectedBehavior: "",
  actualBehavior: "",
  environment: [],
  userImpact: "",
  openQuestions: [],
};
/** Minimal bounded attachment metadata reused for generated evidence. */
const file: TicketFile = {
  id: "523456789012345678",
  messageId: "323456789012345678",
  name: "image.png",
  contentType: "image/png",
  size: 1,
  status: "pending",
};

/**
 * Generates a tiny valid one-page PDF in memory rather than checking in binary fixtures.
 * @returns PDF bytes containing one known line of text.
 */
function smallPdf(): Buffer {
  const stream = "BT /F1 12 Tf 10 100 Td (Ticket PDF evidence) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

it("extracts and renders a generated PDF, representing invalid PDFs explicitly", async () => {
  const pdfFile = { ...file, name: "a.pdf", contentType: "application/pdf" };
  const parts = await prepareTicketEvidence({
    file: pdfFile,
    bytes: smallPdf(),
  });
  expect(parts[0]).toMatchObject({
    type: "text",
    text: expect.stringContaining("Ticket PDF evidence"),
  });
  expect(parts[1]).toMatchObject({ type: "image_url" });
  expect(
    await prepareTicketEvidence({
      file: pdfFile,
      bytes: Buffer.from("broken PDF"),
    }),
  ).toEqual([{ type: "text", text: expect.stringContaining("unavailable") }]);
});

it("requests the selected model with strict schema and ZDR without using signed URLs", async () => {
  const http = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      billing: { status: "settled", zero_data_retention: true },
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(summary), refusal: null },
        },
      ],
    }),
  );
  expect(
    await createTicketSummarizer({ apiKey: "test-key", fetch: http })(
      snapshot,
      [],
    ),
  ).toEqual(summary);
  const body = JSON.parse(String(http.mock.calls[0]?.[1]?.body));
  expect(body).toMatchObject({
    model: "gpt-6-luna",
    zdr: true,
    max_completion_tokens: 8000,
    response_format: { type: "json_schema", json_schema: { strict: true } },
  });
  expect(http).toHaveBeenCalledTimes(1);
});

it.each([
  "non-zdr",
  "refusal",
  "truncated",
  "invalid-json",
])("fails closed for %s output without retries", async (mode) => {
  const http = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      billing: { status: "settled", zero_data_retention: mode !== "non-zdr" },
      choices: [
        {
          finish_reason: mode === "truncated" ? "length" : "stop",
          message: {
            content: mode === "invalid-json" ? "no" : JSON.stringify(summary),
            refusal: mode === "refusal" ? "denied" : null,
          },
        },
      ],
    }),
  );
  await expect(
    createTicketSummarizer({ apiKey: "test-key", fetch: http })(snapshot, []),
  ).rejects.toThrow();
  expect(http).toHaveBeenCalledTimes(1);
});

it("normalizes generated image bytes and explicitly represents invalid evidence", async () => {
  const bytes = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const parts = await prepareTicketEvidence({ file, bytes });
  expect(parts[1]).toMatchObject({
    type: "image_url",
    image_url: { url: expect.stringMatching(/^data:image\/jpeg;base64,/u) },
  });
  expect(
    await prepareTicketEvidence({ file, bytes: Buffer.from("invalid") }),
  ).toEqual([{ type: "text", text: expect.stringContaining("unavailable") }]);
  expect(
    await prepareTicketEvidence({
      file: { ...file, name: "a.txt", contentType: "text/plain" },
      bytes: Buffer.from([0xff]),
    }),
  ).toEqual([{ type: "text", text: expect.stringContaining("invalid UTF-8") }]);
});

it("rejects an unreviewed provider, missing credential and oversized transcript before inference", async () => {
  const http = vi.fn<typeof fetch>();
  expect(() =>
    createTicketSummarizer({
      apiKey: "test-key",
      baseUrl: "https://example.com",
    }),
  ).toThrow("Unreviewed");
  await expect(
    createTicketSummarizer({ apiKey: "", fetch: http })(snapshot, []),
  ).rejects.toThrow("credential");
  const large = {
    ...snapshot,
    messages: [
      {
        id: "323456789012345678",
        userId: "423456789012345678",
        username: "Reporter",
        timestamp: "2026-10-18T01:00:00Z",
        content: "x".repeat(4_500_000),
        files: [],
      },
    ],
  };
  await expect(
    createTicketSummarizer({ apiKey: "test-key", fetch: http })(large, []),
  ).rejects.toThrow("context limit");
  expect(http).not.toHaveBeenCalled();
});

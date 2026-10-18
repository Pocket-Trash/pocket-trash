/** Permanent size-policy failure, distinct from interrupted or unavailable transport. */
export class ResponseLimitError extends Error {}

/**
 * Reads an HTTP body without trusting its advertised size or buffering unbounded data.
 * @param response - Successful response with a readable body.
 * @param limit - Maximum bytes accepted before cancelling the stream.
 * @returns Bounded bytes.
 * @rejects When the body is unavailable, interrupted, or too large.
 */
export async function readBounded(
  response: Response,
  limit: number,
): Promise<Uint8Array> {
  if (!response.body) throw new Error("Response body is unavailable.");
  if (Number(response.headers.get("content-length") ?? 0) > limit) {
    await response.body.cancel();
    throw new ResponseLimitError("Response exceeds the allowed size.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit)
        throw new ResponseLimitError("Response exceeds the allowed size.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}

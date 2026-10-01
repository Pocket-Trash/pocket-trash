/**
 * Buffers a response body while enforcing a byte limit and optional abort signal.
 *
 * @param response - Fetch response whose body will be consumed.
 * @param maxBytes - Maximum buffered byte count.
 * @param signal - Optional cancellation signal.
 * @returns The complete response body.
 * @rejects When the body is missing, exceeds the limit, aborts, or streaming fails.
 */
export async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  if (!response.body) {
    throw new Error("Response body is missing.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await readStreamChunk(reader, signal);

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("Response body exceeds the size limit.");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

/**
 * Reads one stream chunk with optional cancellation support.
 *
 * @param reader - Locked response-body reader.
 * @param signal - Optional cancellation signal.
 * @returns The next stream read result.
 * @rejects When reading fails or the signal aborts.
 */
async function readStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (!signal) {
    return await reader.read();
  }

  if (signal.aborted) {
    throw createAbortError();
  }

  return await new Promise<ReadableStreamReadResult<Uint8Array>>(
    (resolve, reject) => {
      /** Cancels the reader and rejects the surrounding read promise. */
      const onAbort = () => {
        void reader.cancel().catch(() => undefined);
        reject.call(undefined, createAbortError());
      };

      signal.addEventListener("abort", onAbort, { once: true });
      reader
        .read()
        .then(resolve, reject)
        .finally(() => {
          signal.removeEventListener("abort", onAbort);
        });
    },
  );
}

/**
 * Creates the standard DOM abort exception used by bounded reads.
 *
 * @returns An `AbortError` DOM exception.
 */
function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

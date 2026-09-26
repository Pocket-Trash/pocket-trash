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
      const onAbort = () => {
        void reader.cancel().catch(() => undefined);
        reject(createAbortError());
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

function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

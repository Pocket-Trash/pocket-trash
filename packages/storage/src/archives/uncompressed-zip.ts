/** Source file streamed into an uncompressed ZIP archive. */
export type ZipFile = {
  /** Flat archive entry name without path separators. */
  fileName: string;
  /**
   * Opens a fresh byte stream for the file.
   *
   * @returns The file contents.
   * @rejects When the source cannot be opened.
   */
  open(): Promise<ReadableStream<Uint8Array>>;
  /** Declared file size in bytes. */
  size: number;
};

/** Lookup table used for incremental CRC-32 checksums. */
const crc32Table = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return crc >>> 0;
});

/**
 * Creates a streaming ZIP archive without compressing file bodies.
 *
 * @param files - Flat files with stable byte sizes and fresh stream factories.
 * @returns The archive stream and exact content length in bytes.
 * @throws When file count, metadata, or total archive size exceeds ZIP limits.
 */
export function createUncompressedZip(files: ZipFile[]): {
  /** Stream containing the complete ZIP archive. It errors if a source fails or changes size. */
  body: ReadableStream<Uint8Array>;
  /** Exact archive size in bytes. */
  contentLength: number;
} {
  if (files.length === 0 || files.length > 0xffff) {
    throw new Error("A ZIP archive requires files.");
  }

  const encoder = new TextEncoder();
  const prepared = files.map((file) => {
    const fileName = encoder.encode(file.fileName);
    if (
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      file.size > 0xffffffff ||
      fileName.byteLength === 0 ||
      fileName.byteLength > 0xffff ||
      file.fileName.includes("/") ||
      file.fileName.includes("\\")
    ) {
      throw new Error("ZIP file metadata is invalid.");
    }
    return { ...file, encodedFileName: fileName };
  });
  const contentLength =
    prepared.reduce(
      (total, file) =>
        total + 30 + file.encodedFileName.byteLength + file.size + 16,
      0,
    ) +
    prepared.reduce(
      (total, file) => total + 46 + file.encodedFileName.byteLength,
      0,
    ) +
    22;
  if (contentLength > 0xffffffff) {
    throw new Error("ZIP archive exceeds the supported size.");
  }

  const iterator = zipChunks(prepared);
  return {
    body: new ReadableStream<Uint8Array>({
      /**
       * Closes the archive iterator when the consumer cancels.
       *
       * @returns Completion after the iterator closes.
       */
      async cancel() {
        await iterator.return(undefined);
      },
      /**
       * Enqueues the next archive chunk or closes the stream.
       *
       * @param controller - Archive byte-stream controller.
       * @returns Completion after one iterator step.
       */
      async pull(controller) {
        try {
          const chunk = await iterator.next();
          if (chunk.done) controller.close();
          else controller.enqueue(chunk.value);
        } catch (error) {
          controller.error(error);
        }
      },
    }),
    contentLength,
  };
}

/**
 * Generates local entries, file bodies, descriptors, and the central directory.
 *
 * @param files - Prepared files with encoded names.
 * @yields ZIP archive chunks in wire order.
 * @rejects When a source cannot be opened or read, or its length differs from its declared size.
 */
async function* zipChunks(
  files: Array<
    ZipFile & {
      /** UTF-8 encoded archive entry name. */
      encodedFileName: Uint8Array;
    }
  >,
): AsyncGenerator<Uint8Array> {
  const centralEntries: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const localHeader = zipLocalHeader(file.encodedFileName);
    const localOffset = offset;
    offset += localHeader.byteLength + file.size + 16;
    yield localHeader;

    const reader = (await file.open()).getReader();
    let crc = 0xffffffff;
    let bytesRead = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytesRead += chunk.value.byteLength;
        if (bytesRead > file.size) {
          throw new Error("ZIP source size changed while streaming.");
        }
        crc = updateCrc32(crc, chunk.value);
        yield chunk.value;
      }
    } finally {
      reader.releaseLock();
    }
    if (bytesRead !== file.size) {
      throw new Error("ZIP source size changed while streaming.");
    }

    const checksum = (crc ^ 0xffffffff) >>> 0;
    yield zipDataDescriptor(checksum, file.size);
    centralEntries.push(
      zipCentralHeader(file.encodedFileName, checksum, file.size, localOffset),
    );
  }

  const centralOffset = offset;
  for (const entry of centralEntries) {
    offset += entry.byteLength;
    yield entry;
  }
  yield zipEnd(centralEntries.length, offset - centralOffset, centralOffset);
}

/**
 * Encodes a ZIP local-file header.
 *
 * @param fileName - UTF-8 archive entry name.
 * @returns Local-file header bytes.
 */
function zipLocalHeader(fileName: Uint8Array): Uint8Array {
  const header = new Uint8Array(30 + fileName.byteLength);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0808, true);
  view.setUint16(8, 0, true);
  view.setUint16(12, 0x0021, true);
  view.setUint16(26, fileName.byteLength, true);
  header.set(fileName, 30);
  return header;
}

/**
 * Encodes a ZIP data descriptor.
 *
 * @param crc - Final CRC-32 checksum.
 * @param size - File size in bytes.
 * @returns Data descriptor bytes.
 */
function zipDataDescriptor(crc: number, size: number): Uint8Array {
  const descriptor = new Uint8Array(16);
  const view = new DataView(descriptor.buffer);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc, true);
  view.setUint32(8, size, true);
  view.setUint32(12, size, true);
  return descriptor;
}

/**
 * Encodes a ZIP central-directory entry.
 *
 * @param fileName - UTF-8 archive entry name.
 * @param crc - Final CRC-32 checksum.
 * @param size - File size in bytes.
 * @param offset - Byte offset of the local-file header.
 * @returns Central-directory entry bytes.
 */
function zipCentralHeader(
  fileName: Uint8Array,
  crc: number,
  size: number,
  offset: number,
): Uint8Array {
  const header = new Uint8Array(46 + fileName.byteLength);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0808, true);
  view.setUint16(10, 0, true);
  view.setUint16(14, 0x0021, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, fileName.byteLength, true);
  view.setUint32(42, offset, true);
  header.set(fileName, 46);
  return header;
}

/**
 * Encodes the ZIP end-of-central-directory record.
 *
 * @param count - Number of archived files.
 * @param size - Central-directory size in bytes.
 * @param offset - Central-directory byte offset.
 * @returns End record bytes.
 */
function zipEnd(count: number, size: number, offset: number): Uint8Array {
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  return end;
}

/**
 * Updates an incremental CRC-32 checksum.
 *
 * @param crc - Current checksum state.
 * @param bytes - Next file bytes.
 * @returns Updated unsigned checksum state.
 */
function updateCrc32(crc: number, bytes: Uint8Array): number {
  let value = crc;
  for (const byte of bytes) {
    value = (value >>> 8) ^ (crc32Table[(value ^ byte) & 0xff] ?? 0);
  }
  return value >>> 0;
}

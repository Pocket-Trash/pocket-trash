export type ZipFile = {
  fileName: string;
  open(): Promise<ReadableStream<Uint8Array>>;
  size: number;
};

const crc32Table = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return crc >>> 0;
});

export function createUncompressedZip(files: ZipFile[]): {
  body: ReadableStream<Uint8Array>;
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
      async cancel() {
        await iterator.return(undefined);
      },
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

async function* zipChunks(
  files: Array<ZipFile & { encodedFileName: Uint8Array }>,
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

function zipDataDescriptor(crc: number, size: number): Uint8Array {
  const descriptor = new Uint8Array(16);
  const view = new DataView(descriptor.buffer);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc, true);
  view.setUint32(8, size, true);
  view.setUint32(12, size, true);
  return descriptor;
}

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

function updateCrc32(crc: number, bytes: Uint8Array): number {
  let value = crc;
  for (const byte of bytes) {
    value = (value >>> 8) ^ (crc32Table[(value ^ byte) & 0xff] ?? 0);
  }
  return value >>> 0;
}

import { loggerMessages } from "@package/logger";
import { describe, expect, it } from "vitest";
import {
  buildImageFolder,
  createProcessorErrorCounter,
  getTmpImageFolderKey,
} from "./processor.js";

describe("createProcessorErrorCounter", () => {
  it("counts processor errors by message and total", () => {
    const counter = createProcessorErrorCounter();

    counter.record(loggerMessages.scraper.image.uploadFailed);
    counter.record(loggerMessages.scraper.image.uploadFailed);
    counter.record(loggerMessages.scraper.image.deleteFailed);

    expect(counter.summary()).toEqual({
      errorsByMessage: {
        [loggerMessages.scraper.image.deleteFailed]: 1,
        [loggerMessages.scraper.image.uploadFailed]: 2,
      },
      sampleErrors: [],
      totalErrors: 3,
    });
  });

  it("keeps bounded sample error details for summaries", () => {
    const counter = createProcessorErrorCounter();

    counter.record(loggerMessages.scraper.database.mutationFailed, {
      error: new Error("insert failed", {
        cause: new TypeError("bad column"),
      }),
      jobId: "job-1",
      source: "autmog",
      type: "autmog.item",
    });

    expect(counter.summary()).toEqual({
      errorsByMessage: {
        [loggerMessages.scraper.database.mutationFailed]: 1,
      },
      sampleErrors: [
        {
          error: {
            cause: {
              message: "bad column",
              name: "TypeError",
            },
            message: "insert failed",
            name: "Error",
          },
          jobId: "job-1",
          message: loggerMessages.scraper.database.mutationFailed,
          source: "autmog",
          type: "autmog.item",
        },
      ],
      totalErrors: 1,
    });
  });
});

describe("buildImageFolder", () => {
  it("builds production product folders in the images namespace", () => {
    expect(
      buildImageFolder({
        entityId: "1000",
        prefix: "images",
      }),
    ).toBe("/images/products/1000");
  });

  it("builds isolated preview product folders with the PR prefix", () => {
    expect(
      buildImageFolder({
        entityId: "1000-1001",
        prefix: "images/preview/pr-52",
      }),
    ).toBe("/images/preview/pr-52/products/1000-1001");
  });

  it("normalizes surrounding slashes in the folder prefix", () => {
    expect(
      buildImageFolder({
        entityId: "1000",
        prefix: "/images/preview/",
      }),
    ).toBe("/images/preview/products/1000");
  });
});

describe("getTmpImageFolderKey", () => {
  it("uses the product id for product images", () => {
    expect(
      getTmpImageFolderKey({
        productId: 1000,
        productVariationId: null,
      }),
    ).toBe("1000");
  });

  it("combines product and variation ids for variation images", () => {
    expect(
      getTmpImageFolderKey({
        productId: 1000,
        productVariationId: 1001,
      }),
    ).toBe("1000-1001");
  });
});

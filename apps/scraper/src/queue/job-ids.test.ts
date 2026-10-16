import { describe, expect, it } from "vitest";
import {
  getAutmogArchiveJobId,
  getGrimsmoKnifeVariationJobId,
  getGrimsmoPenVariationJobId,
  getGrimsmoSagaCatalogJobId,
  getGrimsmoSagaImageUploadJobId,
  getGrimsmoSagaMaterialsJobId,
  getGrimsmoVariationBatchJobId,
  getTmpImageDeleteJobId,
  getTmpImageUploadJobId,
} from "./job-ids.js";

describe("scraper job ids", () => {
  it("creates deterministic archive job ids independent of source id order", () => {
    expect(getAutmogArchiveJobId(["2", "1"])).toBe(
      getAutmogArchiveJobId(["1", "2"]),
    );
  });

  it("creates deterministic Saga material job ids independent of source order", () => {
    expect(getGrimsmoSagaMaterialsJobId(["Titanium", "Bronze"])).toBe(
      getGrimsmoSagaMaterialsJobId(["Bronze", "Titanium"]),
    );
  });

  it("creates deterministic image job ids", () => {
    expect(
      getTmpImageUploadJobId({
        imageId: 1000,
        source: "autmog",
        sourceHash: "sha256:image",
      }),
    ).toBe("autmog--image--upload--1000--sha256%3Aimage");
    expect(getTmpImageDeleteJobId({ imageId: 1000, source: "autmog" })).toBe(
      "autmog--image--delete--1000",
    );
  });

  it("creates transport-safe job ids without colon separators", () => {
    const jobIds = [
      getAutmogArchiveJobId(["2", "1"]),
      getTmpImageUploadJobId({
        imageId: 1000,
        source: "autmog",
        sourceHash: "sha256:image",
      }),
      getTmpImageDeleteJobId({ imageId: 1000, source: "autmog" }),
      getGrimsmoPenVariationJobId("grimsmo-saga", {
        detailsHash: "sha256:pen",
        sourceHandle: "saga-1234",
      } as Parameters<typeof getGrimsmoPenVariationJobId>[1]),
      getGrimsmoKnifeVariationJobId("grimsmo-rask", {
        detailsHash: "sha256:knife",
        sourceHandle: "rask-1234",
      } as Parameters<typeof getGrimsmoKnifeVariationJobId>[1]),
      getGrimsmoVariationBatchJobId({
        inventorySourceHandles: ["b", "a"],
        source: "grimsmo-saga",
        sourceHandles: ["c", "b", "a"],
      }),
      getGrimsmoSagaMaterialsJobId(["Titanium", "Bronze"]),
      getGrimsmoSagaCatalogJobId({
        appearances: [],
        colorNames: [],
        finishNames: [],
        images: [],
        materialNames: ["Titanium"],
        sliderOptions: [],
      }),
      getGrimsmoSagaImageUploadJobId({
        listingId: 1000,
        sourceImageId: "123",
        sourceUrl: "https://cdn.example.test/saga.jpg",
      }),
      getTmpImageUploadJobId({
        imageId: 2000,
        source: "grimsmo-rask",
        sourceHash: "sha256:image",
      }),
      getTmpImageDeleteJobId({
        imageId: 2000,
        source: "grimsmo-rask",
      }),
    ];

    expect(jobIds.every((jobId) => !jobId.includes(":"))).toBe(true);
  });

  it("keys Grimsmo variation jobs by source handle and details hash", () => {
    expect(
      getGrimsmoPenVariationJobId("grimsmo-saga", {
        detailsHash: "sha256:details",
        sourceHandle: "saga-1234",
      } as Parameters<typeof getGrimsmoPenVariationJobId>[1]),
    ).toBe("grimsmo-saga--pen-variation--saga-1234--sha256%3Adetails");
    expect(
      getGrimsmoKnifeVariationJobId("grimsmo-rask", {
        detailsHash: "sha256:details",
        sourceHandle: "rask-1234",
      } as Parameters<typeof getGrimsmoKnifeVariationJobId>[1]),
    ).toBe("grimsmo-rask--knife-variation--rask-1234--sha256%3Adetails");
  });
});

/** @vitest-environment jsdom */

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { expect, it } from "vitest";
import { canCommitSearch } from "./search-navigation";

it("uses current route identity and parsed IDs for valid leading-zero collection URLs", async () => {
  const root = createRootRoute();
  const publicCollection = createRoute({
    /**
     * Supplies the collection regression root.
     * @returns Root route.
     */
    getParentRoute: () => root,
    path: "/collections/$userId/$collectionId",
    params: {
      /**
       * Uses the production numeric collection parameter convention.
       * @param params - Serialized owner and collection IDs.
       * @returns Parsed numeric IDs.
       */
      parse: (params) => ({
        userId: Number(params.userId),
        collectionId: Number(params.collectionId),
      }),
    },
  });
  const privateCollection = createRoute({
    /**
     * Supplies the collection regression root.
     * @returns Root route.
     */
    getParentRoute: () => root,
    path: "/user/collections/$collectionId",
    params: {
      /**
       * Parses the existing signed-in collection ID convention.
       * @param params - Serialized collection ID.
       * @returns Parsed numeric collection ID.
       */
      parse: (params) => ({ collectionId: Number(params.collectionId) }),
    },
  });
  const tree = root.addChildren([publicCollection, privateCollection]);
  const publicRouter = createRouter({
    routeTree: tree,
    history: createMemoryHistory({
      initialEntries: ["/collections/001/02?q=bolt"],
    }),
  });
  await publicRouter.load();
  expect(
    canCommitSearch(publicRouter, publicCollection.id, {
      userId: 1,
      collectionId: 2,
    }),
  ).toBe(true);
  expect(
    canCommitSearch(publicRouter, publicCollection.id, {
      userId: 1,
      collectionId: 3,
    }),
  ).toBe(false);
  const privateRouter = createRouter({
    routeTree: tree,
    history: createMemoryHistory({
      initialEntries: ["/user/collections/02?q=bolt"],
    }),
  });
  await privateRouter.load();
  expect(
    canCommitSearch(privateRouter, privateCollection.id, { collectionId: 2 }),
  ).toBe(true);
  expect(canCommitSearch(privateRouter, publicCollection.id)).toBe(false);
  await privateRouter.navigate({ to: "/" });
  expect(
    canCommitSearch(privateRouter, privateCollection.id, { collectionId: 2 }),
  ).toBe(false);
});

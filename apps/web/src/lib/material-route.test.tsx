import type * as ReactRouter from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Resolves controlled public material data for route tests. */
const getPublicMaterial = vi.hoisted(() => vi.fn());
vi.mock("@/lib/catalog-api", () => ({ getPublicMaterial }));
/** Captures navigation search values without mutating browser history. */
const navigate = vi.hoisted(() => vi.fn());
/** Captures the page callbacks passed by the production route. */
const detailPage = vi.hoisted(() =>
  vi.fn(
    (props: {
      /** Updates the product URL page.
       * @param page - Next one-based product page.
       */
      onProductsPageChange(page: number): void;
      /** Updates the collection URL page.
       * @param page - Next one-based collection page.
       */
      onCollectionItemsPageChange(page: number): void;
    }) => {
      void props;
      return null;
    },
  ),
);
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  /** Returns the controlled navigation spy.
   * @returns Navigation spy used to inspect search preservation.
   */
  useNavigate: () => navigate,
}));
vi.mock("@/pages/material-pages", () => ({ MaterialDetailPage: detailPage }));

import { Route as GeneralRoute } from "../routes/materials.$materialSlug";
import { Route } from "../routes/materials.$materialSlug_.$materialSpecificSlug";

describe("material-specific route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates both slugs and passes their exact pair to the public service", async () => {
    const parse = Route.options.params?.parse;
    const loader = Route.options.loader;
    if (!parse || typeof loader !== "function")
      throw new Error("Material route contract is missing.");
    expect(() =>
      parse({ materialSlug: "zirconium", materialSpecificSlug: "Bad-Slug" }),
    ).toThrow();
    expect(() =>
      parse({ materialSlug: "Bad-Slug", materialSpecificSlug: "705" }),
    ).toThrow();
    const params = parse({
      materialSlug: "zirconium",
      materialSpecificSlug: "705",
    });
    getPublicMaterial.mockResolvedValueOnce({ id: 1000 });
    await expect(loader({ params } as never)).resolves.toEqual({ id: 1000 });
    expect(getPublicMaterial).toHaveBeenCalledWith({ data: params });
    getPublicMaterial.mockResolvedValueOnce(null);
    await expect(loader({ params } as never)).rejects.toEqual(
      expect.objectContaining({ isNotFound: true }),
    );
  });
});

it.each([
  Route,
  GeneralRoute,
])("keeps the other pager's URL value when either production route changes a page", (route) => {
  vi.spyOn(route, "useLoaderData").mockReturnValue({} as never);
  vi.spyOn(route, "useSearch").mockReturnValue({
    productsPage: 2,
    collectionItemsPage: 3,
  });
  vi.spyOn(route, "useParams").mockReturnValue({
    materialSlug: "zirconium",
    materialSpecificSlug: "705",
  });
  const Component = route.options.component;
  if (!Component) throw new Error("Material route component is missing.");
  renderToStaticMarkup(<Component />);
  const props = detailPage.mock.calls.at(-1)?.[0];
  if (!props) throw new Error("Missing material page callbacks.");
  props.onProductsPageChange(4);
  expect(navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      search: { productsPage: 4, collectionItemsPage: 3 },
    }),
  );
  props.onCollectionItemsPageChange(5);
  expect(navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      search: { productsPage: 2, collectionItemsPage: 5 },
    }),
  );
});

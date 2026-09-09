import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import type { PenProduct } from "@/lib/pen-data";
import { decodePenParam, penParam } from "@/lib/pen-links";
import { absoluteUrl } from "@/lib/site-url";
import { ArchivePage } from "@/pages/archive-page";

export const Route = createFileRoute("/pens/$penId")({
  // `?img=<n>` is 1-based and targets a gallery image; the primary image
  // (n = 1) is left out of the URL to keep shared links clean.
  validateSearch: (search: Record<string, unknown>): { img?: number } => {
    const raw = search.img;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) && n > 1 ? { img: Math.floor(n) } : {};
  },
  loaderDeps: ({ search }) => ({ img: search.img }),
  loader: ({ params, deps }) => {
    const product = decodePenParam(params.penId);
    if (!product) throw notFound();

    // Keep the URL on the canonical `<slug>-<code>` form so share previews
    // and SEO stay stable even if someone hits a short/edited slug.
    const canonical = penParam(product);
    if (params.penId !== canonical) {
      throw redirect({
        to: "/pens/$penId",
        params: { penId: canonical },
        search: deps.img ? { img: deps.img } : {},
      });
    }

    const gallery = product.images_local.length
      ? product.images_local
      : [product.image];
    const imgNum = Math.min(Math.max(deps.img ?? 1, 1), gallery.length);
    const imagePath = gallery[imgNum - 1] ?? product.image;

    return {
      title: product.title,
      description: buildDescription(product),
      imageUrl: absoluteUrl(imagePath),
      imageAlt: product.title,
      pageUrl: absoluteUrl(
        `/pens/${canonical}${imgNum > 1 ? `?img=${imgNum}` : ""}`,
      ),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { title, description, imageUrl, imageAlt, pageUrl } = loaderData;
    const siteName = formatTranslation("web.site.name");
    return {
      meta: [
        { title: `${title} · ${siteName}` },
        { name: "description", content: description },
        { property: "og:site_name", content: siteName },
        { property: "og:type", content: "product" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: pageUrl },
        { property: "og:image", content: imageUrl },
        { property: "og:image:alt", content: imageAlt },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: imageUrl },
      ],
      links: [{ rel: "canonical", href: pageUrl }],
    };
  },
  component: ArchivePage,
});

function buildDescription(product: PenProduct): string {
  const specs = [
    product.sizes.length ? product.sizes.join(" / ") : null,
    product.materials.length ? product.materials.join(", ") : null,
    product.weight_g ? `${product.weight_g} g` : null,
    product.diameter_mm ? `${product.diameter_mm} mm` : null,
    product.length_in ? `${product.length_in}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const price = product.price_min
    ? `$${product.price_min}${
        product.price_max && product.price_max !== product.price_min
          ? `–${product.price_max}`
          : ""
      } CAD`
    : "";
  const siteName = formatTranslation("web.site.name");
  return (
    [specs, price].filter(Boolean).join(" — ") ||
    formatTranslation("web.archive.defaultPenDescription", { siteName })
  );
}

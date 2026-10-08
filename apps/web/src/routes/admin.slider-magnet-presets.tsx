import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageMaterials, listSliderMagnetPresets } from "@/lib/catalog-api";
import { AdminSliderMagnetPresetsPage } from "@/pages/admin-slider-magnet-presets-page";

/** Permission-gated reusable slider magnet preset manager. */
export const Route = createFileRoute("/admin/slider-magnet-presets")({
  /**
   * Requires product-management permission.
   *
   * @returns Completion after authorization succeeds.
   * @rejects When the actor lacks permission.
   */
  beforeLoad: async () => {
    if (!(await canManageMaterials())) throw notFound();
  },
  component: AdminSliderMagnetPresetsRoute,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [
      {
        title: formatTranslation(
          "web.slider.magnet.presets" as Parameters<
            typeof formatTranslation
          >[0],
        ),
      },
    ],
  }),
  /**
   * Loads all reusable presets.
   *
   * @returns Reusable slider magnet presets.
   * @rejects When authorization or loading fails.
   */
  loader: async () => await listSliderMagnetPresets(),
});

/**
 * Renders the server-loaded preset manager.
 *
 * @returns Preset administration page.
 */
function AdminSliderMagnetPresetsRoute() {
  return (
    <AdminSliderMagnetPresetsPage initialPresets={Route.useLoaderData()} />
  );
}

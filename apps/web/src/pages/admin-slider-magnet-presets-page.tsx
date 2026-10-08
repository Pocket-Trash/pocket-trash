import type {
  SliderMagnetConfiguration,
  SliderMagnetLayout,
  SliderMagnetPreset,
} from "@package/services";
import {
  sliderMagnetLayoutDetails,
  sliderMagnetLayouts,
} from "@package/services/constants";
import type { TranslationKey } from "@pocket-trash/localizations";
import * as React from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import {
  SliderMagnetConfigurationEditor,
  uniformMagnetConfiguration,
} from "@/components/slider-magnet-configuration-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createSliderMagnetPreset,
  deleteSliderMagnetPreset,
  updateSliderMagnetPreset,
} from "@/lib/catalog-api";
import { useCatalogCopy } from "@/lib/catalog-copy";

/**
 * General manager for reusable slider magnet presets.
 *
 * @param root0 - Initial server-loaded presets.
 * @returns Preset list and create/edit form.
 */
export function AdminSliderMagnetPresetsPage({
  initialPresets,
}: {
  /** Initial reusable presets. */
  initialPresets: SliderMagnetPreset[];
}) {
  const t = useCatalogCopy();
  const [presets, setPresets] = React.useState(initialPresets);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [name, setName] = React.useState("");
  const [layout, setLayout] = React.useState<SliderMagnetLayout>("2x4");
  const [configuration, setConfiguration] =
    React.useState<SliderMagnetConfiguration>(() =>
      uniformMagnetConfiguration("2x4", "N52"),
    );
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Restores the form to its create-preset defaults.
   *
   * @returns Nothing.
   */
  const reset = () => {
    setEditingId(null);
    setName("");
    setLayout("2x4");
    setConfiguration(uniformMagnetConfiguration("2x4", "N52"));
    setError(null);
  };

  return (
    <AdminPageShell
      section="magnet-presets"
      title={t("web.slider.magnet.presets" as TranslationKey)}
    >
      <main className="grid w-full max-w-5xl gap-6 p-4 md:p-6">
        <form
          className="grid gap-4 rounded-xl border border-border bg-card p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              const data = { configuration, magnetLayout: layout, name };
              const result = editingId
                ? await updateSliderMagnetPreset({
                    data: { ...data, presetId: editingId },
                  })
                : await createSliderMagnetPreset({ data });
              if (!result.ok) {
                setError(result.formError);
                return;
              }
              setPresets((current) =>
                [
                  ...current.filter(({ id }) => id !== result.preset.id),
                  result.preset,
                ].sort((a, b) => a.name.localeCompare(b.name)),
              );
              reset();
            })();
          }}
        >
          <label className="grid gap-1 text-sm font-medium">
            {t("web.catalog.field.name")}
            <Input
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {t("web.slider.layout.label")}
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => {
                const next = event.target.value as SliderMagnetLayout;
                setLayout(next);
                setConfiguration(uniformMagnetConfiguration(next, "N52"));
              }}
              value={layout}
            >
              {sliderMagnetLayouts.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {sliderMagnetLayoutDetails[candidate].label}
                </option>
              ))}
            </select>
          </label>
          <SliderMagnetConfigurationEditor
            layout={layout}
            onChange={(value) =>
              setConfiguration(
                value ?? uniformMagnetConfiguration(layout, null),
              )
            }
            t={t}
            value={configuration}
          />
          {error ? (
            <p className="text-sm text-destructive">{t(error)}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit">
              {editingId ? t("action.save") : t("web.action.confirmAdd")}
            </Button>
            {editingId ? (
              <Button onClick={reset} type="button" variant="outline">
                {t("action.cancel")}
              </Button>
            ) : null}
          </div>
        </form>
        <ul className="grid list-none gap-3 p-0">
          {presets.map((preset) => (
            <li
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
              key={preset.id}
            >
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-base font-semibold">{preset.name}</h2>
                <p className="m-0 text-sm text-muted-foreground">
                  {sliderMagnetLayoutDetails[preset.magnetLayout].label}
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditingId(preset.id);
                  setName(preset.name);
                  setLayout(preset.magnetLayout);
                  setConfiguration(preset.configuration);
                }}
                type="button"
                variant="outline"
              >
                {t("web.action.edit")}
              </Button>
              <Button
                onClick={() => {
                  if (
                    !window.confirm(
                      t(
                        "web.slider.magnet.deletePresetConfirmation" as TranslationKey,
                        { name: preset.name },
                      ),
                    )
                  )
                    return;
                  void deleteSliderMagnetPreset({
                    data: { presetId: preset.id },
                  }).then((result) => {
                    if (result.ok)
                      setPresets((current) =>
                        current.filter(({ id }) => id !== preset.id),
                      );
                  });
                }}
                type="button"
                variant="destructive"
              >
                {t("web.action.delete")}
              </Button>
            </li>
          ))}
        </ul>
      </main>
    </AdminPageShell>
  );
}

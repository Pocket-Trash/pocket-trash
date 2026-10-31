import { useAuth } from "@clerk/tanstack-react-start";
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
import { useForm, useStore } from "@tanstack/react-form";
import { useRef } from "react";
import {
  type EffectEntity,
  type EffectFunction,
  useEffectReducer,
} from "use-effect-reducer";
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

/** Form-owned reusable magnet configuration. */
type PresetDraft = {
  /** Existing preset name. */
  name: string;
  /** Physical magnet layout. */
  layout: SliderMagnetLayout;
  /** Magnet strengths/positions for the selected layout. */
  configuration: SliderMagnetConfiguration;
};
/** Confirmed preset mutation. */
type PresetEffect =
  | {
      /** Create/update implementation. */
      type: "save";
      /** Existing preset identity, or null for creation. */
      presetId: number | null;
      /** Captured form values. */
      value: PresetDraft;
    }
  | {
      /** Confirmed deletion implementation. */
      type: "remove";
      /** Preset whose deletion was confirmed. */
      presetId: number;
    };
/** Preset list, edit selection, and serialized mutation lifetime. */
type PresetState = {
  /** Canonical reusable presets. */
  presets: SliderMagnetPreset[];
  /** Current edit identity, or null for creation. */
  editingId: number | null;
  /** Confirmed mutation in flight. */
  request: EffectEntity<PresetState, PresetEvent> | undefined;
};
/** Canonical mutation result retained across suspension. */
type PresetOutcome = {
  /** Canonical preset after save. */
  preset?: SliderMagnetPreset;
  /** Deleted preset identity. */
  deletedId?: number;
  /** Existing localized failure key. */
  error?: string;
};
/** Preset selection, validated intent, and terminal feedback. */
type PresetEvent =
  | {
      /** Selects an existing preset or create mode. */
      type: "editingSelected";
      /** Current preset identity. */
      presetId: number | null;
    }
  | {
      /** Requests one validated save. */
      type: "saveRequested";
      /** Captured form values. */
      value: PresetDraft;
    }
  | {
      /** Requests confirmed deletion. */
      type: "deleteRequested";
      /** Existing preset identity. */
      presetId: number;
    }
  | {
      /** Stops a terminal mutation and merges its canonical result. */
      type: "finished";
      /** Canonical mutation result. */
      result: PresetOutcome;
    };

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
  const { userId } = useAuth();
  return <MagnetPresetsContent key={userId} initialPresets={initialPresets} />;
}

/**
 * Owns one administrator's preset draft and committed mutations.
 * @param props - Initial canonical reusable presets.
 * @returns Scoped preset administration.
 */
function MagnetPresetsContent({
  initialPresets,
}: {
  /** Initial canonical reusable presets. */
  initialPresets: SliderMagnetPreset[];
}) {
  const t = useCatalogCopy();
  const form = useForm({
    defaultValues: {
      name: "",
      layout: "2x4" as SliderMagnetLayout,
      configuration: uniformMagnetConfiguration("2x4", "N52"),
    },
    validators: {
      /**
       * Requires the existing preset name before a mutation starts.
       * @param input - Current preset fields.
       * @returns Existing form feedback for an empty name.
       */
      onSubmit: ({ value }): string | undefined =>
        value.name.trim() ? undefined : "web.catalog.error.form",
    },
    /**
     * Captures one validated reusable configuration.
     * @param input - Current preset fields.
     * @returns Nothing.
     */
    onSubmit: ({ value }) => dispatch({ type: "saveRequested", value }),
  });
  const { name, layout, configuration } = useStore(
    form.store,
    (state) => state.values,
  );
  const error = useStore(form.store, (state) => state.errorMap.onSubmit);
  const task = useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: PresetEffect;
    /** Retained canonical result. */
    promise: Promise<PresetOutcome>;
  } | null>(null);
  /**
   * Observes a confirmed preset mutation through the current account lifetime.
   * @param _state - Current preset list/edit selection.
   * @param effect - Captured save or deletion intent.
   * @param dispatch - Terminal dispatcher.
   * @param context - Current observer lifetime.
   */
  const execute: EffectFunction<PresetState, PresetEvent, PresetEffect> = (
    _state,
    effect,
    dispatch,
    { signal },
  ) => {
    if (task.current?.effect !== effect)
      task.current = {
        effect,
        promise: (async (): Promise<PresetOutcome> => {
          try {
            if (effect.type === "remove") {
              const result = await deleteSliderMagnetPreset({
                data: { presetId: effect.presetId },
              });
              return result.ok
                ? { deletedId: effect.presetId }
                : { error: result.formError };
            }
            const data = {
              configuration: effect.value.configuration,
              magnetLayout: effect.value.layout,
              name: effect.value.name,
            };
            const result = effect.presetId
              ? await updateSliderMagnetPreset({
                  data: { ...data, presetId: effect.presetId },
                })
              : await createSliderMagnetPreset({ data });
            return result.ok
              ? { preset: result.preset }
              : { error: result.formError };
          } catch {
            return { error: "web.catalog.error.form" };
          }
        })(),
      };
    void task.current.promise.then((result) => {
      if (signal.aborted) return;
      dispatch({ type: "finished", result });
      if (result.error) form.setErrorMap({ onSubmit: result.error });
      else if (effect.type === "save" || _state.editingId === result.deletedId)
        form.reset();
    });
  };
  const [state, dispatch] = useEffectReducer<
    PresetState,
    PresetEvent,
    PresetEffect
  >(
    (state, event, exec) => {
      if (event.type === "editingSelected")
        return state.request ? state : { ...state, editingId: event.presetId };
      if (event.type === "saveRequested")
        return state.request
          ? state
          : {
              ...state,
              request: exec({
                type: "save",
                presetId: state.editingId,
                value: event.value,
              }),
            };
      if (event.type === "deleteRequested")
        return state.request
          ? state
          : {
              ...state,
              request: exec({ type: "remove", presetId: event.presetId }),
            };
      exec.stop(state.request);
      const saved = event.result.preset;
      const deletedId = event.result.deletedId;
      return {
        ...state,
        request: undefined,
        editingId:
          saved || state.editingId === deletedId ? null : state.editingId,
        presets: saved
          ? [...state.presets.filter(({ id }) => id !== saved.id), saved].sort(
              (a, b) => a.name.localeCompare(b.name),
            )
          : deletedId
            ? state.presets.filter(({ id }) => id !== deletedId)
            : state.presets,
      };
    },
    { presets: initialPresets, editingId: null, request: undefined },
    { save: execute, remove: execute },
  );
  const { presets, editingId } = state;
  const busy = Boolean(state.request);
  /** Restores the form and edit selection to the existing create defaults. */
  const reset = () => {
    if (busy) return;
    form.reset();
    dispatch({ type: "editingSelected", presetId: null });
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
            if (busy) return;
            form.setErrorMap({ onSubmit: undefined });
            void form.handleSubmit();
          }}
        >
          <label className="grid gap-1 text-sm font-medium">
            {t("web.catalog.field.name")}
            <Input
              disabled={busy}
              onChange={(event) =>
                form.setFieldValue("name", event.target.value)
              }
              required
              value={name}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {t("web.slider.layout.label")}
            <select
              disabled={busy}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => {
                const next = event.target.value as SliderMagnetLayout;
                form.setFieldValue("layout", next);
                form.setFieldValue(
                  "configuration",
                  uniformMagnetConfiguration(next, "N52"),
                );
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
          <fieldset disabled={busy} className="contents">
            <SliderMagnetConfigurationEditor
              layout={layout}
              onChange={(value) =>
                form.setFieldValue(
                  "configuration",
                  value ?? uniformMagnetConfiguration(layout, null),
                )
              }
              t={t}
              value={configuration}
            />
          </fieldset>
          {error ? (
            <p className="text-sm text-destructive">{t(error)}</p>
          ) : null}
          <div className="flex gap-2">
            <Button disabled={busy} type="submit">
              {editingId ? t("action.save") : t("web.action.confirmAdd")}
            </Button>
            {editingId ? (
              <Button
                disabled={busy}
                onClick={reset}
                type="button"
                variant="outline"
              >
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
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  form.reset(
                    {
                      name: preset.name,
                      layout: preset.magnetLayout,
                      configuration: preset.configuration,
                    },
                    { keepDefaultValues: true },
                  );
                  dispatch({ type: "editingSelected", presetId: preset.id });
                }}
                type="button"
                variant="outline"
              >
                {t("web.action.edit")}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  if (
                    !window.confirm(
                      t(
                        "web.slider.magnet.deletePresetConfirmation" as TranslationKey,
                        { name: preset.name },
                      ),
                    )
                  )
                    return;
                  dispatch({ type: "deleteRequested", presetId: preset.id });
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

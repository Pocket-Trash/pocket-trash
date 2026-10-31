import { useAuth } from "@clerk/tanstack-react-start";
import { faArrowRotateLeft } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { CatalogImageTrashItem } from "@package/services";
import { formatTranslation } from "@pocket-trash/localizations";
import { useRef } from "react";
import { toast } from "sonner";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Button } from "@/components/ui/button";
import { restoreCatalogImage } from "@/lib/catalog-api";
import { useLocale } from "@/providers/locale-provider";

/** Current deleted images and independent restore lifetimes. */
type ImageTrashState = {
  /** Recoverable server-loaded images. */
  images: CatalogImageTrashItem[];
  /** One committed restoration per image identity. */
  pending: ReadonlyMap<string, EffectEntity<ImageTrashState, ImageTrashEvent>>;
};
/** Confirmed restoration intent and terminal cleanup. */
type ImageTrashEvent =
  | {
      /** Requests a confirmed image restoration. */
      type: "restoreRequested";
      /** Selected deleted image. */
      image: CatalogImageTrashItem;
      /** Existing required staff reason. */
      reason: string;
    }
  | {
      /** Stops a completed restoration. */
      type: "restoreFinished";
      /** Current image identity. */
      key: string;
      /** Whether restoration succeeded. */
      success: boolean;
    };
/** Captured image restoration payload. */
type ImageTrashEffect = {
  /** Restoration implementation. */
  type: "restore";
  /** Selected deleted image. */
  image: CatalogImageTrashItem;
  /** Existing staff reason. */
  reason: string;
};

/**
 * Identifies a catalog image across target tables.
 * @param image - Catalog image identity.
 * @returns Target-scoped image key.
 */
function imageKey(image: CatalogImageTrashItem) {
  return `${image.targetType}:${image.id}`;
}

/**
 * Renders deleted catalog images and restore controls.
 *
 * @param props - Catalog image trash properties.
 * @param props.initialImages - Deleted images shown initially.
 * @returns The catalog image trash page.
 */
export function CatalogImageTrashPage({
  initialImages,
}: {
  /** Deleted images shown initially. */
  initialImages: CatalogImageTrashItem[];
}) {
  const { userId } = useAuth();
  return (
    <CatalogImageTrashContent key={userId} initialImages={initialImages} />
  );
}

/**
 * Owns one administrator's recoverable image list and restoration observers.
 * @param props - Initial deleted images.
 * @returns Scoped image trash controls.
 */
function CatalogImageTrashContent({
  initialImages,
}: {
  /** Initial recoverable images. */
  initialImages: CatalogImageTrashItem[];
}) {
  const { locale } = useLocale();
  const tasks = useRef(
    new Map<
      string,
      {
        /** Descriptor whose mutation must not replay. */
        effect: ImageTrashEffect;
        /** Retained server completion. */
        promise: Promise<boolean>;
      }
    >(),
  );
  const [state, dispatch] = useEffectReducer<
    ImageTrashState,
    ImageTrashEvent,
    ImageTrashEffect
  >(
    (state, event, exec) => {
      const pending = new Map(state.pending);
      if (event.type === "restoreRequested") {
        const key = imageKey(event.image);
        if (pending.has(key)) return state;
        pending.set(
          key,
          exec({ type: "restore", image: event.image, reason: event.reason }),
        );
        return { ...state, pending };
      }
      exec.stop(pending.get(event.key));
      pending.delete(event.key);
      return {
        pending,
        images: event.success
          ? state.images.filter((image) => imageKey(image) !== event.key)
          : state.images,
      };
    },
    { images: initialImages, pending: new Map() },
    {
      /**
       * Restores one image without replaying writes during Activity resumption.
       * @param _state - Current recoverable images.
       * @param effect - Captured image and staff reason.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      restore: (_state, effect, dispatch, { signal }) => {
        const key = imageKey(effect.image);
        if (tasks.current.get(key)?.effect !== effect)
          tasks.current.set(key, {
            effect,
            promise: Promise.resolve()
              .then(() =>
                restoreCatalogImage({
                  data: {
                    imageId: effect.image.id,
                    reason: effect.reason,
                    targetType: effect.image.targetType,
                  },
                }),
              )
              .then(
                () => true,
                () => false,
              ),
          });
        void tasks.current.get(key)?.promise.then((success) => {
          if (signal.aborted) return;
          tasks.current.delete(key);
          dispatch({ type: "restoreFinished", key, success });
          if (!success) toast.error(t("web.catalog.error.form"));
        });
      },
    },
  );
  const { images, pending } = state;
  /**
   * Formats localized catalog image trash copy.
   *
   * @param key - Localization key.
   * @param values - Values interpolated into the translation.
   * @returns The formatted translation.
   */
  const t = (
    key: Parameters<typeof formatTranslation>[0],
    values: Record<string, unknown> = {},
  ) => formatTranslation(key, values, locale);
  return (
    <AdminPageShell
      breadcrumbItems={[
        { label: t("web.navigation.admin"), to: "/admin" },
        { label: t("web.admin.trash.title"), to: "/admin/trash" },
      ]}
      section="trash"
      title={t("web.admin.hub.catalogImageTrash")}
    >
      <main className="grid max-w-4xl gap-3 p-6">
        {images.map((image) => (
          <article
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
            key={`${image.targetType}-${image.id}`}
          >
            <img
              alt={t("web.resources.detail.imageAlt", { name: image.fileName })}
              className="size-20 rounded-md object-cover"
              src={image.url}
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{image.targetName}</h2>
              <p className="truncate text-sm text-muted-foreground">
                {image.fileName}
              </p>
            </div>
            <Button
              disabled={pending.has(imageKey(image))}
              onClick={() => {
                const reason = window
                  .prompt(t("web.resources.moderation.reasonLabel"))
                  ?.trim();
                if (reason)
                  dispatch({ type: "restoreRequested", image, reason });
              }}
              type="button"
              variant="outline"
            >
              <FontAwesomeIcon aria-hidden="true" icon={faArrowRotateLeft} />
              {t("web.resources.action.restore")}
            </Button>
          </article>
        ))}
      </main>
    </AdminPageShell>
  );
}

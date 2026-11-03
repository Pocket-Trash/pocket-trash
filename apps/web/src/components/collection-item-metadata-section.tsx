import type {
  CollectionItemNote,
  CollectionItemStatusState,
  MoneyValue,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { type ReactNode, useReducer, useRef } from "react";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import { collectionStatusLabels } from "@/components/collection-item-status-fields";
import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicCollectionItem } from "@/lib/catalog-api";
import { formatCollectionMoney } from "@/lib/catalog-money";
import { useLocale } from "@/providers/locale-provider";

/** Anonymous detail shape returned by the same public-viewer query as the item route. */
type PublicVersion = Awaited<ReturnType<typeof getPublicCollectionItem>>;
/** Public-preview load effect carrying immutable item identity. */
type PreviewEffect = {
  /** Requests the anonymous public item projection. */
  type: "load";
};
/** Preview state preserves the loaded public projection across modal dismissal. */
type PreviewState = {
  /** Current cancellable preview request. */
  pending?: EffectEntity<PreviewState, PreviewEvent>;
  /** Last redacted public response. */
  result?: PublicVersion;
};
/** Explicit user intent and completion events for the preview load. */
type PreviewEvent =
  | {
      /** User requested the public preview. */
      type: "load";
    }
  | {
      /** Preview request completed. */
      type: "loaded";
      /** Redacted result or unavailable state. */
      result: PublicVersion;
    };

/**
 * Shows one metadata scope and a modal loaded through the anonymous public boundary.
 * @param props - Redacted metadata, item identity, and the shared public detail renderer.
 * @returns Owner controls or only the public assignments for another viewer.
 */
export function CollectionItemMetadataSection(props: {
  /** Independent saved status scopes, already redacted by the service. */
  statuses: CollectionItemStatusState;
  /** Already-redacted Markdown notes in independent saved scope order. */
  notes?: CollectionItemNote[];
  /** Already-redacted paid price for the current ownership period. */
  pricePaid?: MoneyValue & { /** Paid price visibility. */ isPublic: boolean };
  /** Sale price supplied only to the owner. */
  priceSold?: MoneyValue;
  /** Whether the current viewer owns this item. */
  isOwner: boolean;
  /** Database item identity used for the public projection request. */
  identity: {
    /** Parent collection. */
    collectionId: number;
    /** Physical item. */
    collectionItemId: number;
    /** Collection owner. */
    userId: number;
  };
  /**
   * Renders the actual detail presentation without substituting owner data.
   * @param detail - Anonymous viewer projection.
   * @returns Public item presentation.
   */
  renderPublicVersion: (detail: NonNullable<PublicVersion>) => ReactNode;
}) {
  const { locale } = useLocale();
  /**
   * Formats one message in the active locale.
   * @param key - Semantic localization key.
   * @returns Localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const [scope, selectScope] = useReducer(
    (_previous: "public" | "private", next: "public" | "private") => next,
    "public",
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, dispatch] = useEffectReducer<
    PreviewState,
    PreviewEvent,
    PreviewEffect
  >(
    (state, event, exec) => {
      if (event.type === "load")
        return state.pending
          ? state
          : { ...state, pending: exec({ type: "load" }) };
      exec.stop(state.pending);
      return { result: event.result };
    },
    {},
    {
      /**
       * Loads only the anonymous public representation.
       * @param _state - Current preview state.
       * @param _effect - Captured request descriptor.
       * @param dispatch - Completion dispatcher.
       * @param context - Cancellable observer lifetime.
       */
      load: (_state, _effect, dispatch, context) => {
        const { signal } = context;
        void getPublicCollectionItem({
          data: { ...props.identity, publicVersion: true },
        })
          .then((result) => {
            if (!signal.aborted) dispatch({ type: "loaded", result });
          })
          .catch(() => {
            if (!signal.aborted) dispatch({ type: "loaded", result: null });
          });
      },
    },
  );
  const selected =
    scope === "private"
      ? props.statuses.private.filter(
          (status) => !props.statuses.public.includes(status),
        )
      : props.statuses.public;
  if (
    !props.isOwner &&
    !props.statuses.public.length &&
    !props.pricePaid?.isPublic &&
    !props.notes?.some((note) => note.isPublic)
  )
    return null;
  const showPaid =
    props.pricePaid &&
    (props.isOwner
      ? scope === "public"
        ? props.pricePaid.isPublic
        : !props.pricePaid.isPublic
      : props.pricePaid.isPublic);
  return (
    <section className="grid gap-4 border border-border bg-card p-4">
      <h2>{t("web.collectionItemMetadata.title")}</h2>
      {props.isOwner ? (
        <div className="flex flex-wrap gap-2">
          {(["public", "private"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={scope === value ? "default" : "outline"}
              aria-pressed={scope === value}
              onClick={() => selectScope(value)}
            >
              {t(
                value === "public"
                  ? "web.collectionItemMetadata.public"
                  : "web.collectionItemMetadata.private",
              )}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              dispatch({ type: "load" });
              dialog.current?.showModal();
            }}
          >
            {t("web.collectionItemMetadata.viewPublicVersion")}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(props.isOwner ? selected : props.statuses.public).map((status) => (
          <Badge key={status}>{t(collectionStatusLabels[status])}</Badge>
        ))}
      </div>
      <dl className="grid gap-2">
        {showPaid && props.pricePaid ? (
          <div>
            <dt className="text-muted-foreground">
              {t("web.collectionItemMetadata.pricePaid")}
            </dt>
            <dd>{formatCollectionMoney(props.pricePaid, locale)}</dd>
          </div>
        ) : null}
        {props.isOwner && scope === "private" && props.priceSold ? (
          <div>
            <dt className="text-muted-foreground">
              {t("web.collectionItemMetadata.priceSold")}
            </dt>
            <dd>{formatCollectionMoney(props.priceSold, locale)}</dd>
          </div>
        ) : null}
      </dl>
      {(props.notes ?? [])
        .filter((note) =>
          props.isOwner
            ? note.isPublic === (scope === "public")
            : note.isPublic,
        )
        .sort((a, b) => a.position - b.position)
        .map((note) => (
          <article
            key={note.id}
            className="grid gap-2 border border-border p-3"
          >
            <h3 className="text-sm font-semibold">{note.name}</h3>
            <MarkdownContent markdown={note.content} />
          </article>
        ))}
      {props.isOwner ? (
        <dialog
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              dialog.current?.close();
            }
          }}
          ref={dialog}
          aria-label={t("web.collectionItemMetadata.publicVersionTitle")}
          className="m-auto max-h-[90dvh] w-[min(64rem,95vw)] overflow-auto border border-border bg-background p-4 text-foreground backdrop:bg-black/50"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => dialog.current?.close()}
          >
            {t("web.collectionItemMetadata.closePublicVersion")}
          </Button>
          {preview.pending ? (
            <p role="status">{t("web.collectionItemStatusTrends.loading")}</p>
          ) : preview.result ? (
            props.renderPublicVersion(preview.result)
          ) : (
            <p>{t("web.collectionItemMetadata.unavailableWarning")}</p>
          )}
        </dialog>
      ) : null}
    </section>
  );
}

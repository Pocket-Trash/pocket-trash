import { faTriangleExclamation } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type {
  CollectionItemMetadataWrite,
  CollectionItemStatus,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocale } from "@/providers/locale-provider";

/** Browser-safe status values and their localized label keys. */
export const collectionStatusLabels = {
  grail: "web.collectionItemMetadata.grail",
  favorite: "web.collectionItemMetadata.favorite",
  want_to_sell: "web.collectionItemMetadata.wantToSell",
  want_to_trade: "web.collectionItemMetadata.wantToTrade",
  sold: "web.collectionItemMetadata.sold",
} as const satisfies Record<CollectionItemStatus, TranslationKey>;

/**
 * Edits independent public/private statuses without overwriting derived controls.
 * @param props - Saved selections, editing mode, and form-owned update callback.
 * @returns Metadata disclosure and an explicit sale-date input when Sold is selected.
 */
export function CollectionItemStatusFields(props: {
  /** Current form-owned metadata. */
  value: CollectionItemMetadataWrite;
  /**
   * Updates form values while preserving the independent saved scopes.
   * @param value - Replacement form metadata.
   */
  onChange: (value: CollectionItemMetadataWrite) => void;
  /** Whether this is an existing item. */
  editing?: boolean;
  /** Validation errors force the disclosure open. */
  invalid?: boolean;
  /** Whether the latest ownership period already records its editable sale date. */
  saleDateRecorded?: boolean;
  /** Localized explanation of the blocking public visibility condition. */
  warning?: TranslationKey;
}) {
  const { locale } = useLocale();
  const id = useId();
  /**
   * Formats one message in the active locale.
   * @param key - Semantic localization key.
   * @returns Localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const sold =
    props.value.statuses.public.includes("sold") ||
    props.value.statuses.private.includes("sold");
  return (
    <details
      className="border-y py-4"
      key={props.invalid ? "invalid" : "valid"}
      open={props.editing || props.invalid || undefined}
    >
      <summary className="cursor-pointer focus-visible:outline focus-visible:outline-ring">
        {t(
          props.editing
            ? "web.collectionItemMetadata.editDisclosure"
            : "web.collectionItemMetadata.addDisclosure",
        )}
      </summary>
      <div className="grid gap-4 pt-4 sm:grid-cols-2">
        {(["public", "private"] as const).map((scope) => (
          <fieldset className="grid gap-2" key={scope}>
            <legend className="mb-2">
              {t(
                scope === "public"
                  ? "web.collectionItemMetadata.publicStatus"
                  : "web.collectionItemMetadata.privateStatus",
              )}
            </legend>
            {scope === "public" &&
            props.warning &&
            props.value.statuses.public.length ? (
              <Tooltip>
                <TooltipTrigger
                  aria-label={t("web.collectionItemMetadata.publicHidden")}
                >
                  <FontAwesomeIcon
                    aria-hidden="true"
                    icon={faTriangleExclamation}
                  />
                </TooltipTrigger>
                <TooltipContent>{t(props.warning)}</TooltipContent>
              </Tooltip>
            ) : null}
            {(
              Object.keys(collectionStatusLabels) as CollectionItemStatus[]
            ).map((status) => {
              const inherited =
                scope === "private" &&
                props.value.statuses.public.includes(status);
              return (
                <label className="flex min-h-9 items-center gap-2" key={status}>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary focus-visible:outline focus-visible:outline-ring"
                    checked={
                      inherited || props.value.statuses[scope].includes(status)
                    }
                    disabled={inherited}
                    onChange={(event) =>
                      props.onChange({
                        ...props.value,
                        statuses: {
                          ...props.value.statuses,
                          [scope]: event.target.checked
                            ? [...props.value.statuses[scope], status]
                            : props.value.statuses[scope].filter(
                                (value) => value !== status,
                              ),
                        },
                      })
                    }
                  />
                  {t(collectionStatusLabels[status])}
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      {sold && !props.saleDateRecorded ? (
        <div className="mt-4 grid gap-2">
          <label htmlFor={`${id}-sale`}>
            {t("web.collectionItemMetadata.saleDate")}
          </label>
          <Input
            id={`${id}-sale`}
            type="date"
            required
            value={props.value.saleDate ?? ""}
            onChange={(event) =>
              props.onChange({ ...props.value, saleDate: event.target.value })
            }
          />
        </div>
      ) : null}
    </details>
  );
}

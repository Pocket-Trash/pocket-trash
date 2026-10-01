import {
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  type FeedbackCategory,
  feedbackCategoryKey,
  feedbackStatus,
  type VisibleFeedbackStatus,
} from "@/lib/feedback-shared";
import { useLocale } from "@/providers/locale-provider";

/** Feedback details displayed in a public or administrative list. */
export type FeedbackCardProps = {
  /** Feedback category, or `null` when uncategorized. */
  category: FeedbackCategory | null;
  /** Optional action controls rendered below the metadata. */
  children?: React.ReactNode;
  /** Valid submission date or parseable date string. */
  createdAt: Date | string;
  /** Feedback body text. */
  description: string;
  /** Public status used to choose the badge label and icon. */
  status: VisibleFeedbackStatus;
  /** Optional submitter name shown in the metadata. */
  submitter?: string | null;
  /** Feedback title. */
  title: string;
  /** Number of votes displayed for the feedback. */
  voteCount: number;
};

/**
 * Renders localized feedback details, status, category, and optional actions.
 *
 * @param props - Feedback card properties.
 * @param props.category - Feedback category, or `null` when uncategorized.
 * @param props.children - Optional action controls.
 * @param props.createdAt - Valid submission date or parseable date string.
 * @param props.description - Feedback body text.
 * @param props.status - Public feedback status.
 * @param props.submitter - Optional submitter name.
 * @param props.title - Feedback title.
 * @param props.voteCount - Number of votes.
 * @returns A localized feedback summary card.
 * @throws {Error} If the required locale provider is missing.
 * @throws {RangeError} If `createdAt` cannot be formatted as a valid date.
 */
export function FeedbackCard({
  category,
  children,
  createdAt,
  description,
  status,
  submitter,
  title,
  voteCount,
}: FeedbackCardProps) {
  const { locale } = useLocale();
  /**
   * Formats a feedback translation for the active locale.
   *
   * @param key - Feedback localization key.
   * @param params - Translation interpolation values.
   * @returns The localized feedback text.
   */
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);
  const statusDetails = feedbackStatus(status);

  return (
    <article className="grid gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-semibold break-words">{title}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">
              <img
                alt=""
                aria-hidden="true"
                className="size-4"
                src={`https://cdn.pocket-trash.app/assets/static/icons/${statusDetails.icon}`}
              />
              {t(statusDetails.key)}
            </Badge>
            <Badge variant="secondary">
              {t(
                category
                  ? feedbackCategoryKey(category)
                  : "web.feedback.category.unset",
              )}
            </Badge>
          </div>
        </div>
        <span className="text-sm text-muted-foreground">
          {t("web.feedback.metadata.votes", { count: voteCount })}
        </span>
      </div>
      <p className="m-0 whitespace-pre-wrap text-sm leading-6">{description}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t("web.feedback.metadata.submittedOn", {
            date: formatDate(createdAt, locale),
          })}
        </span>
        {submitter ? (
          <span>{t("web.feedback.metadata.submittedBy", { submitter })}</span>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </article>
  );
}

/**
 * Formats a date using the viewer's locale and the medium date style.
 *
 * @param value - Date instance or parseable date string.
 * @param locale - Locale used by `Intl.DateTimeFormat`.
 * @returns The localized date text.
 * @throws {RangeError} If `value` cannot be formatted as a valid date.
 */
function formatDate(value: Date | string, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

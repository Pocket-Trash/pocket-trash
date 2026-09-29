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

export type FeedbackCardProps = {
  category: FeedbackCategory | null;
  children?: React.ReactNode;
  createdAt: Date | string;
  description: string;
  status: VisibleFeedbackStatus;
  submitter?: string | null;
  title: string;
  voteCount: number;
};

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

function formatDate(value: Date | string, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

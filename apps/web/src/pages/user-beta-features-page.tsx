import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPageShell } from "@/components/user-page-shell";
import { useFeatureFlagMutation } from "@/hooks/use-feature-flag-mutation";
import type { listUserBetaFeatureFlags } from "@/lib/feature-flags";
import { useLocale } from "@/providers/locale-provider";

/** User-visible beta feature and its current opt-in state. */
type BetaFlag = Awaited<ReturnType<typeof listUserBetaFeatureFlags>>[number];

/**
 * Renders controls for the current user's beta-feature opt-ins.
 *
 * @param props - Current route-loaded beta flags.
 * @returns The beta-features settings page.
 */
export function UserBetaFeaturesPage({
  initialFlags = [],
  actorId,
}: {
  /** Account that authorized the route loader snapshot. */
  actorId?: string;
  /** Current user-specific flags supplied by the route loader. */
  initialFlags?: BetaFlag[];
}) {
  const { userId } = useAuth();
  return (
    <BetaFeaturesContent
      key={userId}
      flags={actorId === undefined || actorId === userId ? initialFlags : []}
    />
  );
}

/**
 * Observes one account's opt-ins while Router owns canonical flags.
 * @param props - Current route-owned flags.
 * @returns Account-scoped beta-feature controls.
 */
function BetaFeaturesContent({
  flags,
}: {
  /** Current canonical opt-in data. */
  flags: BetaFlag[];
}) {
  const { locale } = useLocale();
  /**
   * Formats localized beta-feature copy.
   *
   * @param key - Translation key.
   * @returns The localized message.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const mutation = useFeatureFlagMutation();
  const status = mutation.error;

  return (
    <UserPageShell
      section="beta-features"
      title={t("web.navigation.betaFeatures")}
    >
      <div className="mx-auto grid max-w-3xl gap-3">
        {status ? (
          <Badge className="bg-destructive text-destructive-foreground">
            {status}
          </Badge>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {flags.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {t("web.page.betaFeatures.empty")}
            </div>
          ) : null}
          {flags.map((flag) => (
            <div
              className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
              key={flag.slug}
            >
              <div className="min-w-0">
                <div className="font-medium">{flag.name}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {flag.slug}
                </div>
                {flag.description ? (
                  <p className="m-0 mt-1 text-sm text-muted-foreground">
                    {flag.description}
                  </p>
                ) : null}
              </div>
              <Button
                disabled={mutation.pending}
                onClick={() =>
                  mutation.mutate({
                    kind: "beta",
                    enabled: !flag.enabled,
                    slug: flag.slug,
                  })
                }
                type="button"
                variant={flag.enabled ? "default" : "outline"}
              >
                {flag.enabled
                  ? t("web.status.enabled")
                  : t("web.status.disabled")}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </UserPageShell>
  );
}

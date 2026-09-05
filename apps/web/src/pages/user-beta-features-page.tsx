import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPageShell } from "@/components/user-page-shell";
import {
  listUserBetaFeatureFlags,
  setUserBetaFeatureFlag,
} from "@/lib/feature-flags";
import { webText } from "@/lib/ui-text";
import { useLocale } from "@/providers/locale-provider";

type BetaFlag = Awaited<ReturnType<typeof listUserBetaFeatureFlags>>[number];

export function UserBetaFeaturesPage() {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);
  const [flags, setFlags] = useState<BetaFlag[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const failedToLoadText = t("Failed to load.");

  async function loadFlags() {
    setFlags(await listUserBetaFeatureFlags());
  }

  useEffect(() => {
    loadFlags().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : failedToLoadText);
    });
  }, [failedToLoadText]);

  return (
    <UserPageShell title={t("Beta features")}>
      <div className="mx-auto grid max-w-3xl gap-3">
        {status ? (
          <Badge className="bg-destructive text-white">{status}</Badge>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {flags.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {t("No beta features are available.")}
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
                onClick={async () => {
                  await setUserBetaFeatureFlag({
                    data: {
                      enabled: !flag.enabled,
                      slug: flag.slug,
                    },
                  });
                  await loadFlags();
                }}
                type="button"
                variant={flag.enabled ? "default" : "outline"}
              >
                {flag.enabled ? t("Enabled") : t("Disabled")}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </UserPageShell>
  );
}

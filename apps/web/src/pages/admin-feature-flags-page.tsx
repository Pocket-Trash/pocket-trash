import type { FeatureFlagAudience } from "@package/feature-flags";
import {
  Archive,
  Check,
  Search,
  Settings2,
  Shield,
  ToggleLeft,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClerkUserSearchResult } from "@/lib/feature-flags";
import {
  archiveAdminFeatureFlag,
  createAdminFeatureFlag,
  listAdminFeatureFlags,
  listAdminTargetingForUser,
  searchFeatureFlagUsers,
  setAdminFeatureFlagForUser,
  updateAdminFeatureFlag,
} from "@/lib/feature-flags";
import { webText } from "@/lib/ui-text";
import { useLocale } from "@/providers/locale-provider";

type AdminFlag = Awaited<ReturnType<typeof listAdminFeatureFlags>>[number];
type TargetFlag = Awaited<ReturnType<typeof listAdminTargetingForUser>>[number];

const audiences: FeatureFlagAudience[] = ["global", "admin", "user"];

export function AdminFeatureFlagsPage() {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);
  const failedToLoadText = t("Failed to load.");
  const [flags, setFlags] = useState<AdminFlag[]>([]);
  const [form, setForm] = useState({
    audience: "user" as FeatureFlagAudience,
    defaultEnabled: false,
    description: "",
    name: "",
    slug: "",
  });
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ClerkUserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] =
    useState<ClerkUserSearchResult | null>(null);
  const [targetFlags, setTargetFlags] = useState<TargetFlag[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  async function loadFlags() {
    setFlags(await listAdminFeatureFlags());
  }

  async function loadTargeting(user: ClerkUserSearchResult) {
    setSelectedUser(user);
    setTargetFlags(
      await listAdminTargetingForUser({
        data: { targetClerkId: user.clerkId },
      }),
    );
  }

  useEffect(() => {
    loadFlags().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : failedToLoadText);
    });
  }, [failedToLoadText]);

  async function saveFlag() {
    if (editingSlug) {
      await updateAdminFeatureFlag({
        data: {
          defaultEnabled: form.defaultEnabled,
          description: form.description || null,
          name: form.name,
          slug: editingSlug,
        },
      });
    } else {
      await createAdminFeatureFlag({
        data: {
          audience: form.audience,
          defaultEnabled: form.defaultEnabled,
          description: form.description || null,
          name: form.name,
          slug: form.slug,
        },
      });
    }

    setForm({
      audience: "user",
      defaultEnabled: false,
      description: "",
      name: "",
      slug: "",
    });
    setEditingSlug(null);
    await loadFlags();
  }

  async function searchUsers() {
    setUsers(await searchFeatureFlagUsers({ data: { query } }));
  }

  return (
    <AppShell sidebarContent={null} title={t("Feature flags")}>
      <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-6 md:grid-cols-[minmax(0,1fr)_360px] md:px-6">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-base font-semibold">{t("Flags")}</h2>
              <p className="m-0 text-sm text-muted-foreground">
                {t("Boolean controls for global, private, and beta surfaces.")}
              </p>
            </div>
            {status ? (
              <Badge className="bg-destructive text-white">{status}</Badge>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
              <span>{t("Flag")}</span>
              <span>{t("Audience")}</span>
              <span>{t("Actions")}</span>
            </div>
            {flags.map((flag) => (
              <div
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border px-3 py-3 last:border-b-0"
                key={flag.slug}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{flag.name}</span>
                    {flag.archivedAt ? (
                      <Badge variant="outline">{t("Archived")}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {flag.slug}
                  </div>
                  {flag.description ? (
                    <p className="m-0 mt-1 text-sm text-muted-foreground">
                      {flag.description}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant={flag.audience === "admin" ? "default" : "secondary"}
                >
                  {flag.audience}
                </Badge>
                <div className="flex items-center gap-2">
                  <Button
                    aria-label={`${t("Edit")} ${flag.slug}`}
                    onClick={() => {
                      setEditingSlug(flag.slug);
                      setForm({
                        audience: flag.audience,
                        defaultEnabled: flag.defaultEnabled,
                        description: flag.description ?? "",
                        name: flag.name,
                        slug: flag.slug,
                      });
                    }}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Settings2 />
                  </Button>
                  <Button
                    aria-label={`${t("Archive")} ${flag.slug}`}
                    disabled={Boolean(flag.archivedAt)}
                    onClick={async () => {
                      await archiveAdminFeatureFlag({
                        data: { slug: flag.slug },
                      });
                      await loadFlags();
                    }}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Archive />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="m-0 mb-3 text-sm font-semibold">
              {editingSlug ? t("Edit flag") : t("New flag")}
            </h2>
            <div className="grid gap-3">
              <Input
                disabled={Boolean(editingSlug)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
                placeholder="new-library-ui"
                value={form.slug}
              />
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder={t("Display name")}
                value={form.name}
              />
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder={t("Description")}
                value={form.description}
              />
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                disabled={Boolean(editingSlug)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    audience: event.target.value as FeatureFlagAudience,
                  }))
                }
                value={form.audience}
              >
                {audiences.map((audience) => (
                  <option key={audience} value={audience}>
                    {audience}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={form.defaultEnabled}
                  disabled={form.audience !== "global"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defaultEnabled: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                {t("Global default enabled")}
              </label>
              <Button onClick={saveFlag} type="button">
                <Check />
                {t("Save flag")}
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="m-0 mb-3 text-sm font-semibold">
              {t("Admin-only targeting")}
            </h2>
            <div className="flex gap-2">
              <Input
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Email, username, or name")}
                value={query}
              />
              <Button
                aria-label={t("Search users")}
                onClick={searchUsers}
                size="icon"
                type="button"
                variant="outline"
              >
                <Search />
              </Button>
            </div>
            <div className="mt-3 grid gap-2">
              {users.map((user) => (
                <Button
                  className="h-auto justify-start px-3 py-2"
                  key={user.clerkId}
                  onClick={() => loadTargeting(user)}
                  type="button"
                  variant="outline"
                >
                  <Shield />
                  <span className="min-w-0 text-left">
                    <span className="block truncate">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email ?? user.username ?? user.clerkId}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            {selectedUser ? (
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                  {selectedUser.name}
                </div>
                <div className="grid gap-2">
                  {targetFlags.map((flag) => (
                    <Button
                      className="justify-between"
                      key={flag.slug}
                      onClick={async () => {
                        await setAdminFeatureFlagForUser({
                          data: {
                            enabled: !flag.enabled,
                            slug: flag.slug,
                            targetClerkId: selectedUser.clerkId,
                          },
                        });
                        await loadTargeting(selectedUser);
                      }}
                      type="button"
                      variant="outline"
                    >
                      <span>{flag.name}</span>
                      <span className="flex items-center gap-2 text-xs">
                        <ToggleLeft />
                        {flag.enabled ? t("Enabled") : t("Disabled")}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </aside>
      </main>
    </AppShell>
  );
}

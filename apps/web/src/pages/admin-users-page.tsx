import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Search, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AdminUserAccess,
  type AdminUserIdentity,
  getAdminUserAccess,
  searchAdminUsers,
  setAdminUserBanState,
} from "@/lib/user-bans";
import { useLocale } from "@/providers/locale-provider";

/**
 * Renders user search and administrator ban controls.
 *
 * @returns User-access administration page.
 */
export function AdminUsersPage() {
  const { locale } = useLocale();
  /**
   * Formats localized copy for the active locale.
   *
   * @param key - Localization key.
   * @returns Localized copy.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserIdentity[]>([]);
  const [selected, setSelected] = useState<AdminUserAccess | null>(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Searches users from the submitted query.
   *
   * @param event - Search form submission.
   * @returns Completion after results are loaded.
   */
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      setUsers(await searchAdminUsers({ data: { query } }));
      setSelected(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Loads durable access state for a selected user.
   *
   * @param user - Selected Clerk identity.
   * @returns Completion after access state is loaded.
   */
  async function selectUser(user: AdminUserIdentity) {
    setBusy(true);
    setStatus(null);
    try {
      const access = await getAdminUserAccess({
        data: { targetClerkId: user.clerkId },
      });
      setSelected(access);
      setReason(access.banState?.reason ?? "");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Saves the requested ban state and reason.
   *
   * @param banned - Desired completed ban state.
   * @returns Completion after provider reconciliation.
   */
  async function save(banned: boolean) {
    if (!selected) return;
    if (!reason.trim()) {
      setStatus(t("web.resources.moderation.reasonRequired"));
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const banState = await setAdminUserBanState({
        data: {
          banned,
          reason,
          targetClerkId: selected.user.clerkId,
        },
      });
      setSelected({
        banState,
        user: { ...selected.user, banned: banState.status === "banned" },
      });
      setReason(banState.reason);
      setStatus(t("web.admin.users.updated"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  const pendingStatus = selected?.banState?.status.startsWith("pending_")
    ? selected.banState.status
    : null;
  const currentStatus = selected
    ? (pendingStatus ?? (selected.user.banned ? "banned" : "unbanned"))
    : null;
  const statusLabel = currentStatus
    ? t(
        {
          banned: "web.admin.users.banned",
          pending_ban: "web.admin.users.pendingBan",
          pending_unban: "web.admin.users.pendingUnban",
          unbanned: "web.admin.users.active",
        }[currentStatus] as TranslationKey,
      )
    : null;

  return (
    <AdminPageShell section="users" title={t("web.admin.users.title")}>
      <main className="grid w-full max-w-5xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] md:p-6">
        <section aria-labelledby="user-search-title" className="grid gap-4">
          <div>
            <h2 className="m-0 text-base font-semibold" id="user-search-title">
              {t("web.admin.users.title")}
            </h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              {t("web.admin.users.description")}
            </p>
          </div>
          <form className="flex gap-2" onSubmit={search}>
            <label className="sr-only" htmlFor="admin-user-search">
              {t("web.admin.featureFlags.emailUsernameOrName")}
            </label>
            <Input
              id="admin-user-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("web.admin.featureFlags.emailUsernameOrName")}
              required
              value={query}
            />
            <Button disabled={busy} type="submit" variant="outline">
              <Search aria-hidden="true" />
              {t("web.action.search")}
            </Button>
          </form>
          <div className="grid gap-2">
            {users.map((user) => (
              <Button
                className="h-auto min-h-11 justify-start px-3 py-2"
                disabled={busy}
                key={user.clerkId}
                onClick={() => selectUser(user)}
                type="button"
                variant="outline"
              >
                <UserRound aria-hidden="true" />
                <span className="min-w-0 text-left">
                  <span className="block truncate">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email ?? user.username ?? user.clerkId}
                  </span>
                </span>
              </Button>
            ))}
            {query && !busy && users.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                {t("web.admin.users.noResults")}
              </p>
            ) : null}
          </div>
        </section>

        {selected && currentStatus ? (
          <section
            aria-labelledby="selected-user-title"
            className="grid content-start gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  className="m-0 truncate text-base font-semibold"
                  id="selected-user-title"
                >
                  {selected.user.name}
                </h2>
                <p className="m-0 truncate text-xs text-muted-foreground">
                  {selected.user.email ?? selected.user.clerkId}
                </p>
              </div>
              <Badge
                variant={currentStatus === "banned" ? "destructive" : "outline"}
              >
                {statusLabel}
              </Badge>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="ban-reason">
                {t("web.admin.audit.reason")}
              </label>
              <textarea
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                id="ban-reason"
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("web.admin.users.reasonPlaceholder")}
                required
                value={reason}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {currentStatus === "unbanned" ? (
                <Button
                  disabled={busy}
                  onClick={() => save(true)}
                  type="button"
                >
                  {t("web.admin.users.ban")}
                </Button>
              ) : null}
              {currentStatus === "banned" ? (
                <>
                  <Button
                    disabled={busy}
                    onClick={() => save(true)}
                    type="button"
                  >
                    {t("web.admin.users.updateReason")}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => save(false)}
                    type="button"
                    variant="outline"
                  >
                    {t("web.admin.users.unban")}
                  </Button>
                </>
              ) : null}
              {currentStatus === "pending_ban" ||
              currentStatus === "pending_unban" ? (
                <Button
                  disabled={busy}
                  onClick={() => save(currentStatus === "pending_ban")}
                  type="button"
                >
                  {t("web.page.error.retry")}
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}
        <p
          aria-live="polite"
          className="m-0 text-sm md:col-span-2"
          role="status"
        >
          {status}
        </p>
      </main>
    </AdminPageShell>
  );
}

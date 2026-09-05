import { useAuth, useClerk, useUser } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import {
  ChevronsUpDown,
  FlaskConical,
  Folder,
  Languages,
  LogOut,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { localeLabel, supportedLocales } from "@/lib/locale";
import { updateLocaleSetting } from "@/lib/locale-api";
import { webText } from "@/lib/ui-text";
import { useLocale } from "@/providers/locale-provider";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const { locale, setLocale } = useLocale();
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    return compact ? (
      <Skeleton className="size-9 rounded-full" />
    ) : (
      <div className="flex h-12 items-center gap-3 rounded-md border border-sidebar-border bg-sidebar px-3">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return compact ? (
      <Button
        aria-label={t("Sign in")}
        className="rounded-full"
        nativeButton={false}
        render={<Link params={{ _splat: "" }} to="/sign-in/$" />}
        size="icon"
        variant="outline"
      >
        <User />
      </Button>
    ) : (
      <Button
        className="w-full"
        nativeButton={false}
        render={<Link params={{ _splat: "" }} to="/sign-in/$" />}
        variant="outline"
      >
        {t("Sign in")}
      </Button>
    );
  }

  const username = user.username ?? "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          compact ? (
            <Button
              aria-label={t("Account menu")}
              className="rounded-full p-0"
              size="icon"
              type="button"
              variant="outline"
            />
          ) : (
            <Button
              className="h-12 w-full justify-start gap-3 px-3"
              type="button"
              variant="outline"
            />
          )
        }
      >
        <Avatar size={compact ? "sm" : undefined}>
          <AvatarImage alt={username} src={user.imageUrl} />
          <AvatarFallback>{initialsFor(username)}</AvatarFallback>
        </Avatar>
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">
                {username}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {t("Account")}
              </span>
            </span>
            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64"
        side={compact ? "bottom" : "top"}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarImage alt={username} src={user.imageUrl} />
              <AvatarFallback>{initialsFor(username)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {username}
              </span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user.primaryEmailAddress?.emailAddress}
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/user/account" />}>
          <User />
          {t("Account")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/user/collections" />}>
          <Folder />
          {t("Collections")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/user/settings/beta-features" />}>
          <FlaskConical />
          {t("Beta features")}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages />
            {t("Language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                const nextLocale = value as typeof locale;
                setLocale(nextLocale);

                if (isSignedIn) {
                  void updateLocaleSetting(nextLocale);
                }
              }}
              value={locale}
            >
              {supportedLocales.map((code) => (
                <DropdownMenuRadioItem key={code} value={code}>
                  {localeLabel(code)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void clerk.signOut({ redirectUrl: "/" });
          }}
        >
          <LogOut />
          {t("Log out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initialsFor(value: string | null | undefined) {
  const first = value?.trim().charAt(0).toUpperCase();
  return first || "U";
}

import { useClerk, useUser } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { Folder, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/providers/locale-provider";

export function UserMenu() {
  const clerk = useClerk();
  const { locale } = useLocale();
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    return <Skeleton className="size-9 rounded-full" />;
  }

  if (!user) {
    return (
      <Button
        nativeButton={false}
        render={<Link params={{ _splat: "" }} to="/sign-in/$" />}
        variant="outline"
      >
        {t("web.action.signIn")}
      </Button>
    );
  }

  const username = user.username ?? t("web.navigation.user");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("web.navigation.accountMenu")}
            className="rounded-full p-0"
            size="icon"
            type="button"
            variant="outline"
          />
        }
      >
        <Avatar size="sm">
          <AvatarImage alt={username} src={user.imageUrl} />
          <AvatarFallback>{initialsFor(username)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" side="bottom">
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
          {t("web.navigation.account")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/user/collections" />}>
          <Folder />
          {t("web.navigation.collections")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/user/settings" />}>
          <Settings />
          {t("web.settings.settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void clerk.signOut({ redirectUrl: "/" });
          }}
        >
          <LogOut />
          {t("web.navigation.logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initialsFor(value: string | null | undefined) {
  const first = value?.trim().charAt(0).toUpperCase();
  return first || "U";
}

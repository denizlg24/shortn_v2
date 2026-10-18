"use client";

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@shortn/ui";
import { Languages, LogOut, SunMoon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { isLocale, locales } from "@/i18n/locale";
import { isThemePreference } from "@/lib/theme";
import { useLocaleSwitch } from "@/lib/use-locale-switch";
import { useThemePreference } from "@/lib/use-theme";
import { UserAvatar } from "./avatars";
import { useShell } from "./shell-context";
import { useSignOut } from "./use-sign-out";

/** `rail` collapses to the avatar between 768 and 1199px, like the rest of the sidebar. */
export function AccountMenu({ layout }: { layout: "rail" | "full" }) {
  const t = useTranslations("shell.account");
  const tCommon = useTranslations("common");
  const { user } = useShell();
  const [theme, setTheme] = useThemePreference();
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();
  const { signOut, pending } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("menu")}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-control px-1.5 text-left hover:bg-bg-muted aria-expanded:bg-bg-muted",
            layout === "rail" &&
              "max-xl:size-9 max-xl:justify-center max-xl:px-0",
          )}
        >
          <UserAvatar name={user.name} image={user.image} />
          <span
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              layout === "rail" && "max-xl:sr-only",
            )}
          >
            <span className="truncate text-small leading-tight font-medium">
              {user.name}
            </span>
            <span className="truncate text-meta leading-tight text-fg-subtle">
              {user.email}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<SunMoon aria-hidden />}>
            {t("theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => {
                if (isThemePreference(value)) setTheme(value);
              }}
            >
              <DropdownMenuRadioItem value="light">
                {t("light")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                {t("dark")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                {t("system")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<Languages aria-hidden />}>
            {t("language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(value) => {
                if (isLocale(value)) switchLocale(value);
              }}
            >
              {locales.map((option) => (
                <DropdownMenuRadioItem
                  key={option}
                  value={option}
                  lang={option}
                >
                  {tCommon(`languages.${option}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={<LogOut aria-hidden />}
          disabled={pending}
          onSelect={() => void signOut()}
        >
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  KeyboardHint,
} from "@shortn/ui";
import { Keyboard, Languages, Monitor, Moon, Plus, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { locales } from "@/i18n/locale";
import { useLocaleSwitch } from "@/lib/use-locale-switch";
import { useThemePreference } from "@/lib/use-theme";
import { WorkspaceAvatar } from "./avatars";
import { allNav } from "./nav";
import { useShell } from "./shell-context";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("shell.palette");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { workspace, workspaces, navigate, switchWorkspace, openShortcuts } =
    useShell();
  const [, setTheme] = useThemePreference();
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();
  const [search, setSearch] = useState("");
  const router = useRouter();

  // Close first so focus returns to the page before the action opens anything else.
  const run = (action: () => void) => {
    onOpenChange(false);
    setSearch("");
    window.setTimeout(action, 0);
  };

  return (
    <CommandDialog
      title={t("title")}
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
      footer={
        <>
          <span className="inline-flex items-center gap-1.5">
            <KeyboardHint keys={["up"]} />
            <KeyboardHint keys={["down"]} />
            {t("navigate")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <KeyboardHint keys="enter" />
            {t("select")}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <KeyboardHint keys="esc" />
            {t("close")}
          </span>
        </>
      }
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={t("placeholder")}
      />
      <CommandList>
        <CommandEmpty>{t("empty")}</CommandEmpty>
        <CommandGroup heading={t("actions")}>
          <CommandItem
            value={`new link create ${t("newLink")}`}
            icon={<Plus aria-hidden />}
            shortcut="c"
            onSelect={() =>
              run(() => router.push(`/${workspace.slug}/links/new`))
            }
          >
            {t("newLink")}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t("navigation")}>
          {allNav.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.section}
                value={`go ${item.section} ${tNav(item.section)}`}
                icon={<Icon aria-hidden />}
                shortcut={["g", item.goKey]}
                shortcutSequence
                onSelect={() => run(() => navigate(item.section))}
              >
                {tNav(item.section)}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {workspaces.length > 1 ? (
          <CommandGroup heading={t("workspaces")}>
            {workspaces.map((option) => {
              const current = option.id === workspace.id;
              return (
                <CommandItem
                  key={option.id}
                  value={`workspace ${option.slug} ${option.name}`}
                  icon={
                    <WorkspaceAvatar
                      name={option.name}
                      logo={option.logo}
                      size={16}
                    />
                  }
                  meta={current ? t("current") : undefined}
                  onSelect={() =>
                    run(() => {
                      if (!current) switchWorkspace(option.slug);
                    })
                  }
                >
                  {option.name}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading={t("preferences")}>
          <CommandItem
            icon={<Sun aria-hidden />}
            onSelect={() => run(() => setTheme("light"))}
          >
            {t("themeLight")}
          </CommandItem>
          <CommandItem
            icon={<Moon aria-hidden />}
            onSelect={() => run(() => setTheme("dark"))}
          >
            {t("themeDark")}
          </CommandItem>
          <CommandItem
            icon={<Monitor aria-hidden />}
            onSelect={() => run(() => setTheme("system"))}
          >
            {t("themeSystem")}
          </CommandItem>
          {locales
            .filter((option) => option !== locale)
            .map((option) => (
              <CommandItem
                key={option}
                value={`language ${option} ${tCommon(`languages.${option}`)}`}
                keywords={["language", "idioma"]}
                icon={<Languages aria-hidden />}
                onSelect={() => run(() => switchLocale(option))}
              >
                {t("language", { language: tCommon(`languages.${option}`) })}
              </CommandItem>
            ))}
          <CommandItem
            icon={<Keyboard aria-hidden />}
            shortcut="?"
            onSelect={() => run(openShortcuts)}
          >
            {t("shortcuts")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

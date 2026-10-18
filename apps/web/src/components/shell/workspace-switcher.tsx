"use client";

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Tooltip,
} from "@shortn/ui";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { WorkspaceAvatar } from "./avatars";
import { useShell } from "./shell-context";

export function WorkspaceSwitcher({
  layout,
  open,
  onOpenChange,
}: {
  layout: "rail" | "full";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("shell.workspace");
  const { workspace, workspaces, switchWorkspace } = useShell();
  const rail = layout === "rail";

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={rail ? t("switch") : undefined}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-control px-1.5 text-left hover:bg-bg-muted aria-expanded:bg-bg-muted",
          rail && "max-xl:justify-center",
        )}
      >
        <WorkspaceAvatar
          name={workspace.name}
          logo={workspace.logo}
          size={24}
        />
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            rail && "max-xl:hidden",
          )}
        >
          <span className="truncate text-small leading-tight font-semibold">
            {workspace.name}
          </span>
          <span className="truncate text-meta leading-tight font-normal text-fg-subtle">
            {t(`plans.${workspace.plan}`)}
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-fg-subtle",
            rail && "max-xl:hidden",
          )}
        />
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      {rail ? (
        <Tooltip content={t("switch")} shortcut={["mod", "o"]} side="right">
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>{t("switch")}</DropdownMenuLabel>
        {workspaces.map((option) => {
          const current = option.id === workspace.id;
          return (
            <DropdownMenuItem
              key={option.id}
              icon={
                <WorkspaceAvatar
                  name={option.name}
                  logo={option.logo}
                  size={16}
                />
              }
              onSelect={() => {
                if (!current) switchWorkspace(option.slug);
              }}
            >
              {option.name}
              {current ? (
                <>
                  <Check
                    aria-hidden
                    className="ml-auto inline size-4 text-fg!"
                  />
                  <span className="sr-only">{t("current")}</span>
                </>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

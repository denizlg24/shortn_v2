"use client";

import type { LinkView } from "@shortn/core";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  parseDestination,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@shortn/ui";
import { Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { listLinksAction } from "@/server/actions/links";

const searchDebounceMs = 200;
const resultLimit = 20;

type Search =
  | { status: "idle" }
  | { status: "ready"; query: string; links: LinkView[] }
  | { status: "error"; query: string };

/** Finds a workspace link by key, title or destination. */
export function LinkPicker({
  workspace,
  onSelect,
  exclude,
  suggestions,
  suggestionsLabel,
  trigger,
  disabled,
}: {
  workspace: string;
  onSelect: (link: LinkView) => void;
  /** Ids already used, hidden from the results. */
  exclude?: ReadonlySet<string>;
  /** Shown before typing, e.g. the campaign's own links. */
  suggestions?: LinkView[];
  suggestionsLabel?: string;
  /** The button that opens the picker; defaults to "Add link". */
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  const t = useTranslations("common.linkPicker");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ status: "idle" });

  useEffect(() => {
    if (!open) return;
    let live = true;
    const term = query.trim();
    const handle = window.setTimeout(
      () => {
        listLinksAction(workspace, {
          ...(term ? { search: term } : {}),
          limit: resultLimit,
        }).then(
          (result) => {
            if (!live) return;
            setSearch(
              result.ok
                ? { status: "ready", query: term, links: result.data.links }
                : { status: "error", query: term },
            );
          },
          () => {
            if (live) setSearch({ status: "error", query: term });
          },
        );
      },
      term ? searchDebounceMs : 0,
    );
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [open, query, workspace]);

  const visible = (links: LinkView[]) =>
    exclude ? links.filter((link) => !exclude.has(link.id)) : links;
  const term = query.trim();
  const settled = search.status !== "idle" && search.query === term;
  const results =
    search.status === "ready" && settled ? visible(search.links) : [];
  const suggested = !term && suggestions ? visible(suggestions) : [];
  const suggestedIds = new Set(suggested.map((link) => link.id));

  const pick = (link: LinkView) => {
    onSelect(link);
    setOpen(false);
    setQuery("");
  };

  const item = (link: LinkView) => (
    <CommandItem
      key={link.id}
      value={link.id}
      onSelect={() => pick(link)}
      icon={<Link2 aria-hidden />}
      meta={parseDestination(link.url).host}
    >
      <span className="text-fg-muted">{link.domain}/</span>
      <span className="font-medium">{link.key}</span>
      {link.title ? (
        <span className="ml-2 text-fg-muted">{link.title}</span>
      ) : null}
    </CommandItem>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ?? <Button disabled={disabled}>{t("add")}</Button>}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(420px,calc(100vw-32px))] p-0"
      >
        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("search")}
            frameClassName="h-10 px-3"
            className="text-small"
          />
          <CommandList className="max-h-72 p-1">
            {settled ? (
              <CommandEmpty className="py-6">
                {search.status === "error" ? t("failed") : t("empty")}
              </CommandEmpty>
            ) : suggested.length === 0 ? (
              <div
                role="status"
                className="px-3 py-6 text-center text-small text-fg-muted"
              >
                {t("searching")}
              </div>
            ) : null}
            {suggested.length > 0 ? (
              <CommandGroup heading={suggestionsLabel}>
                {suggested.map(item)}
              </CommandGroup>
            ) : null}
            {results.length > 0 ? (
              <CommandGroup
                heading={suggested.length > 0 ? t("allLinks") : undefined}
              >
                {results.filter((link) => !suggestedIds.has(link.id)).map(item)}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

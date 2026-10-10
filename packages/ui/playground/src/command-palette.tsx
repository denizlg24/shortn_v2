import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Favicon,
  KeyboardHint,
  parseDestination,
} from "@shortn/ui";
import {
  ClipboardPaste,
  Copy,
  FlaskConical,
  Keyboard,
  Languages,
  LayoutGrid,
  Monitor,
  Moon,
  PanelRight,
  Pencil,
  Plus,
  Sun,
} from "lucide-react";
import { useState } from "react";
import { usePlayground, type DemoState } from "./app-context";
import { linksApiRegistry } from "./lib/links-api";
import { ALL_NAV } from "./shell/nav-items";

export function CommandPalette() {
  const {
    copy,
    paletteOpen,
    setPaletteOpen,
    navigate,
    setTheme,
    setLocale,
    locale,
    setShortcutsOpen,
    setDemoState,
  } = usePlayground();
  const [search, setSearch] = useState("");
  const api = paletteOpen ? linksApiRegistry.get() : null;
  const active = api?.activeLink ?? null;

  const run = (action: () => void) => {
    setPaletteOpen(false);
    setSearch("");
    window.setTimeout(action, 0);
  };

  const states: Array<[DemoState, string]> = [
    ["ready", copy.palette.stateReady],
    ["empty", copy.palette.stateEmpty],
    ["loading", copy.palette.stateLoading],
    ["error", copy.palette.stateError],
    ["readonly", copy.palette.stateReadonly],
    ["long", copy.palette.stateLong],
  ];

  const linkMatches =
    api && search.trim().length > 0
      ? api.links
          .filter((link) =>
            `${link.key} ${link.url}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
          )
          .slice(0, 8)
      : [];

  return (
    <CommandDialog
      title={copy.palette.title}
      open={paletteOpen}
      onOpenChange={(open) => {
        setPaletteOpen(open);
        if (!open) setSearch("");
      }}
      commandProps={{ shouldFilter: true }}
      footer={
        <>
          <span className="inline-flex items-center gap-1.5">
            <KeyboardHint keys={["up"]} />
            <KeyboardHint keys={["down"]} />
            {copy.palette.navigate}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <KeyboardHint keys="enter" />
            {copy.palette.select}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <KeyboardHint keys="esc" />
            {copy.palette.close}
          </span>
        </>
      }
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={copy.palette.placeholder}
      />
      <CommandList>
        <CommandEmpty>{copy.palette.empty}</CommandEmpty>
        {active ? (
          <CommandGroup
            heading={`${copy.palette.focused} · ${active.domain}/${active.key}`}
          >
            <CommandItem
              icon={<Copy aria-hidden />}
              shortcut={["mod", "c"]}
              onSelect={() => run(() => api?.copyLink(active))}
            >
              {copy.palette.copy}
            </CommandItem>
            <CommandItem
              icon={<PanelRight aria-hidden />}
              shortcut="enter"
              onSelect={() => run(() => api?.openLink(active, "overview"))}
            >
              {copy.palette.open}
            </CommandItem>
            <CommandItem
              icon={<Pencil aria-hidden />}
              shortcut="e"
              onSelect={() => run(() => api?.openLink(active, "edit"))}
            >
              {copy.palette.edit}
            </CommandItem>
          </CommandGroup>
        ) : null}
        {api?.canEdit ? (
          <CommandGroup heading={copy.palette.actions}>
            <CommandItem
              icon={<Plus aria-hidden />}
              shortcut="c"
              onSelect={() => run(() => api.openComposer())}
            >
              {copy.palette.create}
            </CommandItem>
            <CommandItem
              icon={<ClipboardPaste aria-hidden />}
              onSelect={() => run(() => api.createFromClipboard())}
            >
              {copy.palette.createFromClipboard}
            </CommandItem>
          </CommandGroup>
        ) : null}
        {linkMatches.length > 0 ? (
          <CommandGroup heading={copy.palette.links}>
            {linkMatches.map((link) => (
              <CommandItem
                key={link.id}
                value={`jump ${link.key} ${link.url.slice(0, 200)}`}
                icon={
                  <Favicon
                    host={parseDestination(link.url).host}
                    src={link.faviconSrc}
                  />
                }
                meta={parseDestination(link.url).host}
                onSelect={() => run(() => api?.openLink(link, "overview"))}
              >
                <span className="text-fg-subtle">{link.domain}/</span>
                <span className="font-medium">{link.key}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading={copy.palette.navigation}>
          {ALL_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.section}
                icon={<Icon aria-hidden />}
                {...(item.goKey
                  ? { shortcut: ["g", item.goKey], shortcutSequence: true }
                  : {})}
                onSelect={() => run(() => navigate(item.section))}
              >
                {item.label(copy)}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={copy.palette.preferences}>
          <CommandItem
            icon={<Sun aria-hidden />}
            onSelect={() => run(() => setTheme("light"))}
          >
            {copy.palette.themeLight}
          </CommandItem>
          <CommandItem
            icon={<Moon aria-hidden />}
            onSelect={() => run(() => setTheme("dark"))}
          >
            {copy.palette.themeDark}
          </CommandItem>
          <CommandItem
            icon={<Monitor aria-hidden />}
            onSelect={() => run(() => setTheme("system"))}
          >
            {copy.palette.themeSystem}
          </CommandItem>
          <CommandItem
            icon={<Languages aria-hidden />}
            onSelect={() => run(() => setLocale(locale === "en" ? "pt" : "en"))}
          >
            {copy.palette.language}
          </CommandItem>
          <CommandItem
            icon={<Keyboard aria-hidden />}
            shortcut="?"
            onSelect={() => run(() => setShortcutsOpen(true))}
          >
            {copy.palette.shortcuts}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={copy.palette.playground}>
          <CommandItem
            icon={<LayoutGrid aria-hidden />}
            onSelect={() => run(() => navigate("gallery"))}
          >
            {copy.palette.gallery}
          </CommandItem>
          {states.map(([state, label]) => (
            <CommandItem
              key={state}
              icon={<FlaskConical aria-hidden />}
              onSelect={() => run(() => setDemoState(state))}
            >
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

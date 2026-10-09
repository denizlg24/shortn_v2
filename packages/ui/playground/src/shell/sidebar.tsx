import {
  Button,
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
  ShortnMark,
  Tooltip,
  UsageMeter,
  type Locale,
} from "@shortn/ui";
import {
  Check,
  ChevronsUpDown,
  CircleQuestionMark,
  Keyboard,
  Languages,
  LayoutGrid,
  LogOut,
  Plus,
  SunMoon,
} from "lucide-react";
import {
  usePlayground,
  type Section,
  type ThemePreference,
} from "../app-context";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav-items";

export function Sidebar({
  workspaceMenuOpen,
  onWorkspaceMenuOpenChange,
}: {
  workspaceMenuOpen: boolean;
  onWorkspaceMenuOpenChange: (open: boolean) => void;
}) {
  const { copy, route } = usePlayground();
  return (
    <aside
      aria-label={copy.nav.primary}
      className="sticky top-0 hidden h-dvh w-rail shrink-0 flex-col border-r border-line bg-bg-subtle md:flex xl:w-sidebar"
    >
      <div className="px-2.5 pt-2.5 pb-2 xl:px-3">
        <WorkspaceSwitcher
          open={workspaceMenuOpen}
          onOpenChange={onWorkspaceMenuOpenChange}
        />
      </div>
      <nav
        aria-label={copy.nav.primary}
        className="flex flex-col gap-px px-2 xl:px-3"
      >
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.section}
            item={item}
            active={route.section === item.section}
          />
        ))}
      </nav>
      <div role="separator" className="mx-4 my-3 h-px bg-line xl:mx-5" />
      <nav
        aria-label={copy.nav.settings}
        className="flex flex-col gap-px px-2 xl:px-3"
      >
        {SECONDARY_NAV.map((item) => (
          <NavLink
            key={item.section}
            item={item}
            active={route.section === item.section}
          />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3 px-2 pb-3 xl:px-3">
        <UsageMeter
          label={copy.usage.clicks}
          used={62_480}
          limit={100_000}
          unit={copy.usage.unit}
          detail={copy.usage.resets}
          className="hidden px-2 xl:flex"
        />
        <div className="flex flex-col gap-px border-t border-line pt-2 max-xl:items-center">
          <HelpMenu />
          <AccountMenu />
        </div>
      </div>
    </aside>
  );
}

function WorkspaceSwitcher({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { copy } = usePlayground();
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <Tooltip
        content={copy.workspace.switch}
        shortcut={["mod", "o"]}
        side="right"
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-control px-1.5 text-left hover:bg-bg-muted aria-expanded:bg-bg-muted max-xl:justify-center"
          >
            <ShortnMark size={24} />
            <span className="flex min-w-0 flex-1 flex-col max-xl:hidden">
              <span className="truncate text-small leading-tight font-semibold">
                {copy.workspace.name}
              </span>
              <span className="truncate text-meta leading-tight text-fg-subtle">
                {copy.workspace.demo}
              </span>
            </span>
            <ChevronsUpDown
              aria-hidden
              className="size-4 shrink-0 text-fg-subtle max-xl:hidden"
            />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>{copy.workspace.switch}</DropdownMenuLabel>
        <DropdownMenuItem icon={<ShortnMark size={16} />}>
          {copy.workspace.name}
          <Check aria-hidden className="ml-auto inline size-4 text-fg!" />
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={
            <span className="grid size-4 place-items-center rounded-chip bg-fg/10 text-[10px] font-semibold text-fg">
              E
            </span>
          }
        >
          {copy.workspace.events}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Plus aria-hidden />}>
          {copy.workspace.create}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { copy, navigate } = usePlayground();
  const label = item.label(copy);
  const Icon = item.icon;
  const link = (
    <a
      href={`#/${item.section}`}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        event.preventDefault();
        navigate(item.section as Section);
      }}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-control px-2 text-small max-xl:justify-center max-xl:px-0",
        active
          ? "bg-bg-muted font-medium text-fg"
          : "text-fg-muted hover:bg-bg-muted hover:text-fg",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary" : "text-fg-subtle group-hover:text-fg-muted",
        )}
      />
      <span className="truncate max-xl:sr-only">{label}</span>
    </a>
  );
  return (
    <Tooltip
      content={label}
      side="right"
      {...(item.goKey
        ? { shortcut: ["g", item.goKey], shortcutSequence: true }
        : {})}
      className="xl:hidden"
    >
      {link}
    </Tooltip>
  );
}

function HelpMenu() {
  const { copy, navigate, setShortcutsOpen } = usePlayground();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-control px-2 text-small text-fg-muted hover:bg-bg-muted hover:text-fg aria-expanded:bg-bg-muted max-xl:size-8 max-xl:justify-center max-xl:px-0"
          aria-label={copy.nav.help}
        >
          <CircleQuestionMark
            aria-hidden
            className="size-4 shrink-0 text-fg-subtle"
          />
          <span className="max-xl:sr-only">{copy.nav.help}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-60">
        <DropdownMenuItem
          icon={<Keyboard aria-hidden />}
          shortcut="?"
          onSelect={() => setShortcutsOpen(true)}
        >
          {copy.account.shortcuts}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<LayoutGrid aria-hidden />}
          onSelect={() => navigate("gallery")}
        >
          {copy.account.gallery}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { copy, theme, setTheme, locale, setLocale } = usePlayground();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={copy.account.menu}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-control px-1.5 text-left hover:bg-bg-muted aria-expanded:bg-bg-muted",
            compact
              ? "size-9 justify-center px-0"
              : "max-xl:size-9 max-xl:justify-center max-xl:px-0",
          )}
        >
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-fg/10 text-meta font-semibold text-fg"
          >
            IM
          </span>
          <span
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              compact ? "sr-only" : "max-xl:sr-only",
            )}
          >
            <span className="truncate text-small leading-tight font-medium">
              {copy.account.name}
            </span>
            <span className="truncate text-meta leading-tight text-fg-subtle">
              {copy.account.email}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="truncate">
          {copy.account.email}
        </DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<SunMoon aria-hidden />}>
            {copy.account.theme}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as ThemePreference)}
            >
              <DropdownMenuRadioItem value="light">
                {copy.account.light}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                {copy.account.dark}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                {copy.account.system}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<Languages aria-hidden />}>
            {copy.account.language}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(value) => setLocale(value as Locale)}
            >
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="pt">
                Português
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut aria-hidden />}>
          {copy.account.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeLocaleQuick() {
  const { theme, setTheme, locale, setLocale, copy } = usePlayground();
  const nextTheme: Record<ThemePreference, ThemePreference> = {
    light: "dark",
    dark: "system",
    system: "light",
  };
  return (
    <span className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme(nextTheme[theme])}
        aria-label={copy.account.theme}
      >
        <SunMoon aria-hidden />
        {copy.account[theme]}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocale(locale === "en" ? "pt" : "en")}
        aria-label={copy.account.language}
      >
        <Languages aria-hidden />
        {locale === "en" ? "English" : "Português"}
      </Button>
    </span>
  );
}

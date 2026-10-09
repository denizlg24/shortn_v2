import {
  cn,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  ShortnMark,
  UsageMeter,
} from "@shortn/ui";
import { usePlayground } from "../app-context";
import { ALL_NAV, PRIMARY_NAV } from "./nav-items";
import { AccountMenu } from "./sidebar";

export function MobileTabBar() {
  const { copy, route, navigate } = usePlayground();
  return (
    <nav
      aria-label={copy.nav.primary}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {PRIMARY_NAV.slice(0, 4).map((item) => {
        const Icon = item.icon;
        const active = route.section === item.section;
        return (
          <a
            key={item.section}
            href={`#/${item.section}`}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate(item.section);
            }}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 text-[11px] leading-none font-medium",
              active ? "text-fg" : "text-fg-muted",
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "size-5",
                active ? "text-primary" : "text-fg-subtle",
              )}
              strokeWidth={active ? 2.25 : 1.75}
            />
            <span className="max-w-full truncate px-1">{item.label(copy)}</span>
          </a>
        );
      })}
    </nav>
  );
}

export function MobileDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { copy, route, navigate } = usePlayground();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2.5">
            <ShortnMark size={24} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-small leading-tight font-semibold">
                {copy.workspace.name}
              </span>
              <span className="truncate text-meta leading-tight font-normal text-fg-subtle">
                {copy.workspace.demo}
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-px px-3">
          {ALL_NAV.map((item) => {
            const Icon = item.icon;
            const active = route.section === item.section;
            return (
              <a
                key={item.section}
                href={`#/${item.section}`}
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.section);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-control px-2.5 text-body",
                  active ? "bg-bg-muted font-medium text-fg" : "text-fg-muted",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4",
                    active ? "text-primary" : "text-fg-subtle",
                  )}
                />
                {item.label(copy)}
              </a>
            );
          })}
          <div className="mt-auto flex flex-col gap-4 border-t border-line pt-4">
            <UsageMeter
              label={copy.usage.clicks}
              used={62_480}
              limit={100_000}
              unit={copy.usage.unit}
              detail={copy.usage.resets}
              className="px-2.5"
            />
            <AccountMenu />
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

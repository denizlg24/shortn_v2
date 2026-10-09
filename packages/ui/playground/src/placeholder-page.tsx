import { Button } from "@shortn/ui";
import { Menu } from "lucide-react";
import { usePlayground } from "./app-context";
import { ALL_NAV } from "./shell/nav-items";

export function PlaceholderPage({
  onOpenDrawer,
}: {
  onOpenDrawer: () => void;
}) {
  const { copy, route, navigate } = usePlayground();
  const item = ALL_NAV.find((candidate) => candidate.section === route.section);
  const title = item ? item.label(copy) : "";
  return (
    <>
      <header className="flex min-h-page-header shrink-0 items-center gap-3 border-b border-line px-gutter">
        <Button
          variant="ghost"
          size="icon-md"
          className="-ml-2 md:hidden"
          aria-label={copy.nav.openMenu}
          onClick={onOpenDrawer}
        >
          <Menu aria-hidden />
        </Button>
        <h1 className="text-title font-semibold tracking-[-0.015em]">
          {title}
        </h1>
      </header>
      <div className="flex flex-col items-start gap-3 px-gutter py-10">
        <p className="max-w-[60ch] text-body text-pretty text-fg-muted">
          {copy.placeholder.body(title)}
        </p>
        <Button onClick={() => navigate("links")}>
          {copy.placeholder.back}
        </Button>
      </div>
    </>
  );
}

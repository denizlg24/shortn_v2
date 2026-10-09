export const overlaySurface =
  "z-50 rounded-overlay border border-line bg-overlay text-fg shadow-overlay outline-none data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out";

export const menuItem = [
  "relative flex h-8 cursor-pointer items-center gap-2 rounded-control px-2 text-small text-fg outline-none select-none",
  "data-highlighted:bg-bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-fg-muted",
].join(" ");

export const menuLabel = "px-2 pt-2 pb-1 text-meta font-medium text-fg-subtle";

export const menuSeparator = "-mx-1 my-1 h-px bg-line";

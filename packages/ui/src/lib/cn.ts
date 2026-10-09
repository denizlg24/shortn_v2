import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["meta", "small", "body", "emphasis", "title", "section"],
      radius: ["chip", "control", "overlay"],
      shadow: ["overlay"],
      spacing: [
        "gutter",
        "cell",
        "row",
        "header-row",
        "page-header",
        "sidebar",
        "rail",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

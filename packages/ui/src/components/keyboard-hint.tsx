import { useSyncExternalStore } from "react";
import { cn } from "../lib/cn";
import { isApplePlatform } from "../lib/platform";

const subscribeNever = () => () => {};

export function useIsApplePlatform(): boolean {
  return useSyncExternalStore(subscribeNever, isApplePlatform, () => true);
}

type KeyName =
  | "mod"
  | "shift"
  | "alt"
  | "enter"
  | "esc"
  | "up"
  | "down"
  | "left"
  | "right"
  | "backspace"
  | "tab"
  | (string & {});

const glyph = (
  key: KeyName,
  apple: boolean,
): { label: string; spoken: string } => {
  switch (key) {
    case "mod":
      return apple
        ? { label: "⌘", spoken: "Command" }
        : { label: "Ctrl", spoken: "Control" };
    case "shift":
      return { label: "⇧", spoken: "Shift" };
    case "alt":
      return apple
        ? { label: "⌥", spoken: "Option" }
        : { label: "Alt", spoken: "Alt" };
    case "enter":
      return { label: "↵", spoken: "Enter" };
    case "esc":
      return { label: "Esc", spoken: "Escape" };
    case "up":
      return { label: "↑", spoken: "Up arrow" };
    case "down":
      return { label: "↓", spoken: "Down arrow" };
    case "left":
      return { label: "←", spoken: "Left arrow" };
    case "right":
      return { label: "→", spoken: "Right arrow" };
    case "backspace":
      return { label: "⌫", spoken: "Backspace" };
    case "tab":
      return { label: "Tab", spoken: "Tab" };
    default:
      return {
        label: key.length === 1 ? key.toUpperCase() : key,
        spoken: key.toUpperCase(),
      };
  }
};

export interface KeyboardHintProps {
  keys: KeyName | KeyName[];
  /** `then` renders a sequence (G then L) instead of a chord (⌘ K). */
  sequence?: boolean;
  tone?: "default" | "inverse" | "plain";
  className?: string;
}

export function KeyboardHint({
  keys,
  sequence = false,
  tone = "default",
  className,
}: KeyboardHintProps) {
  const apple = useIsApplePlatform();
  const list = (Array.isArray(keys) ? keys : [keys]).map((key) =>
    glyph(key, apple),
  );
  const spoken = list.map((key) => key.spoken).join(sequence ? " then " : " ");
  return (
    <kbd
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 font-sans not-italic",
        className,
      )}
    >
      <span className="sr-only">{spoken}</span>
      {list.map((key, index) => (
        <kbd
          key={`${key.label}-${index}`}
          aria-hidden
          className={cn(
            "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-chip px-1 font-mono text-[11px] leading-none font-medium",
            tone === "default" &&
              "border border-line bg-bg-subtle text-fg-muted",
            tone === "inverse" && "bg-current/15 text-current/80",
            tone === "plain" && "min-w-0 px-0.5 text-fg-subtle",
          )}
        >
          {key.label}
        </kbd>
      ))}
    </kbd>
  );
}

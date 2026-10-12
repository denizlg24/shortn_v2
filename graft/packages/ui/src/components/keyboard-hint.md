# packages/ui/src/components/keyboard-hint.tsx

- subscribeNever · function · L7-L7 — subscribeNever = ()
- useIsApplePlatform · function · L9-L11 — function useIsApplePlatform(): boolean
- KeyName · type · L13-L25 — type KeyName = | "mod" | "shift" | "alt" | "enter" | "esc" | "up" | "down" | "left" | "right" | "backspace" | "tab" | (string & {});
- glyph · function · L27-L64 — glyph = ( key: KeyName, apple: boolean, ): { label: string; spoken: string }
- KeyboardHintProps · interface · L66-L72 — interface KeyboardHintProps
- KeyboardHint · function · L74-L110 — function KeyboardHint({ keys, sequence = false, tone = "default", className, }: KeyboardHintProps)

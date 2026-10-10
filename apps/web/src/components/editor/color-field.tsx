"use client";

import { cn, Input } from "@shortn/ui";
import type { FieldControlProps } from "../auth/auth-field";

const shortHex = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const longHex = /^#[0-9a-f]{6}/i;

/** The native picker only takes #rrggbb; anything else opens on the fallback. */
function pickerValue(value: string, fallback: string): string {
  const short = shortHex.exec(value);
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (longHex.test(value)) return value.slice(0, 7);
  return longHex.test(fallback) ? fallback.slice(0, 7) : "#000000";
}

/**
 * A colour as text (hex, rgb() or any CSS value the field accepts) with a
 * swatch that opens the system picker. An empty value shows `placeholder`,
 * the colour that applies when none is set.
 */
export function ColorField({
  control,
  value,
  placeholder,
  pickerLabel,
  disabled,
  onChange,
  className,
}: {
  control: FieldControlProps;
  value: string;
  placeholder: string;
  /** Accessible name of the swatch, e.g. "Pick the background colour". */
  pickerLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  const shown = value.trim() || placeholder;
  return (
    <Input
      {...control}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={512}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="none"
      onChange={(event) => onChange(event.target.value)}
      className="font-mono"
      frameClassName={cn("pl-1.5", className)}
      leading={
        <span
          className="relative size-5 overflow-hidden rounded-chip border border-line-strong"
          style={{ background: shown }}
        >
          <input
            type="color"
            aria-label={pickerLabel}
            disabled={disabled}
            value={pickerValue(value.trim(), placeholder)}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </span>
      }
    />
  );
}

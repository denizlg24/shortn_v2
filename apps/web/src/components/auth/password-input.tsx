"use client";

import { Input, type InputProps } from "@shortn/ui";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function PasswordInput(props: Omit<InputProps, "type" | "trailing">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      trailing={
        <button
          type="button"
          aria-label={t("showPassword")}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="-mr-1 grid size-6 cursor-pointer place-items-center rounded-chip text-fg-subtle hover:bg-bg-muted hover:text-fg"
        >
          {visible ? (
            <EyeOff aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
        </button>
      }
    />
  );
}

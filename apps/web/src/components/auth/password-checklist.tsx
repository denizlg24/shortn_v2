"use client";

import { cn } from "@shortn/ui";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { passwordChecks, passwordMinLength } from "./rules";

export function PasswordChecklist({
  id,
  password,
  flagUnmet,
}: {
  id: string;
  password: string;
  /** After a failed submit, unmet rules turn red so the cause is obvious. */
  flagUnmet: boolean;
}) {
  const t = useTranslations("auth.requirements");
  return (
    <ul
      id={id}
      aria-label={t("label")}
      className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5 text-meta"
    >
      {passwordChecks(password).map(({ check, met }) => (
        <li
          key={check}
          className={cn(
            "flex min-w-0 items-start gap-1.5",
            met
              ? "text-fg-muted"
              : flagUnmet
                ? "text-danger"
                : "text-fg-subtle",
          )}
        >
          {met ? (
            <Check
              aria-hidden
              className="mt-px size-3.5 shrink-0 text-success"
            />
          ) : (
            <span
              aria-hidden
              className="mt-px grid size-3.5 shrink-0 place-items-center"
            >
              <span className="size-1 rounded-full bg-current" />
            </span>
          )}
          <span>
            <span className="sr-only">{met ? t("met") : t("unmet")} </span>
            {check === "length"
              ? t("length", { min: passwordMinLength })
              : t(check)}
          </span>
        </li>
      ))}
    </ul>
  );
}

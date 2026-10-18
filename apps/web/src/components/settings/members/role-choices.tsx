"use client";

import { cn } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type { AssignableRole } from "./roles";

/** Each role with what it can do, as a radio list (17: invite, member page). */
export function RoleChoices({
  roles,
  value,
  onChange,
  legend,
}: {
  roles: AssignableRole[];
  value: AssignableRole;
  onChange: (role: AssignableRole) => void;
  legend: string;
}) {
  const t = useTranslations("settings");
  const id = useId();
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <ul className="divide-y divide-line border-y border-line">
        {roles.map((role) => (
          <li key={role}>
            <label
              htmlFor={`${id}-${role}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 py-3",
                value === role && "text-fg",
              )}
            >
              <input
                id={`${id}-${role}`}
                type="radio"
                name="role"
                value={role}
                checked={value === role}
                onChange={() => onChange(role)}
                className="mt-0.5 size-4 accent-[var(--color-signal)]"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-small font-medium">
                  {t(`roles.${role}`)}
                </span>
                <span className="text-small text-pretty text-fg-muted">
                  {t(`roleDescriptions.${role}`)}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

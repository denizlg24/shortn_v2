"use client";

import { Button } from "@shortn/ui";
import { UserRoundCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useShell } from "./shell-context";
import { useSignOut } from "./use-sign-out";

const strong = (chunks: ReactNode) => (
  <strong className="font-semibold">{chunks}</strong>
);

export function ImpersonationBanner() {
  const t = useTranslations("shell.impersonation");
  const { user } = useShell();
  const { signOut, pending } = useSignOut();
  return (
    <section
      aria-label={t("label")}
      className="flex min-h-9 shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line bg-warning/10 px-gutter py-1 text-small text-fg"
    >
      <p className="flex min-w-0 items-center gap-2">
        <UserRoundCheck aria-hidden className="size-4 shrink-0 text-warning" />
        <span className="min-w-0 text-pretty">
          {t.rich("notice", { name: user.name, email: user.email, strong })}
        </span>
      </p>
      <Button size="sm" loading={pending} onClick={() => void signOut()}>
        {t("end")}
      </Button>
    </section>
  );
}

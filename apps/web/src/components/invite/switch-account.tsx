"use client";

import { authClient } from "@shortn/auth/client";
import { Button } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Signs out and comes back to `next` after signing in with another account. */
export function SwitchAccount({ next }: { next: string }) {
  const t = useTranslations("invite");
  const [pending, setPending] = useState(false);

  const switchAccount = async () => {
    setPending(true);
    try {
      const { error } = await authClient.signOut();
      if (!error) {
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
    } catch {
      // Still signed in; the button stays usable for another try.
    }
    setPending(false);
  };

  return (
    <Button
      variant="primary"
      size="lg"
      className="w-full"
      loading={pending}
      onClick={() => void switchAccount()}
    >
      {t("mismatch.switch")}
    </Button>
  );
}

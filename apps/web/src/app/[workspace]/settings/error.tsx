"use client";

import { Button, EmptyState } from "@shortn/ui";
import { useTranslations } from "next-intl";

export default function SettingsError({ retry }: { retry: () => void }) {
  const t = useTranslations("settings.common");
  return (
    <EmptyState
      tone="danger"
      title={t("loadFailed")}
      description={t("loadFailedBody")}
      action={<Button onClick={() => retry()}>{t("retry")}</Button>}
    />
  );
}

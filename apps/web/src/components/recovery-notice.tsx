import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

/** Incident notice for Shortn's own pages; never injected into customers' bio pages. */
export function RecoveryNotice() {
  const t = useTranslations("common.recoveryNotice");
  return (
    <section
      aria-label={t("title")}
      className="shrink-0 border-b border-warning/30 bg-warning/10 px-gutter py-3 text-small text-fg"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-2.5">
        <TriangleAlert
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <p className="min-w-0 text-pretty">
          <strong className="font-semibold">{t("title")}</strong> {t("message")}
        </p>
      </div>
    </section>
  );
}

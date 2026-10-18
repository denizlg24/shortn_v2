import { useTranslations } from "next-intl";
import type { ChangelogTag as Tag } from "@/lib/changelog/entries";

/** A label, not a control: which plan (or add-on) an item needs. */
export function ChangelogTag({ tag }: { tag: Tag }) {
  const tGate = useTranslations("gate");
  const tPlans = useTranslations("shell.workspace");
  const t = useTranslations("changelog");
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-chip bg-fg/[0.06] px-1.5 text-meta font-medium text-fg-muted">
      {tag === "addon" ? (
        t("addon")
      ) : (
        <>
          <span aria-hidden>{tGate(`plans.${tag}`)}</span>
          <span className="sr-only">{tPlans(`plans.${tag}`)}</span>
        </>
      )}
    </span>
  );
}

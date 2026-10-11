"use client";

import { cn, formatPercent } from "@shortn/ui";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import type { ScanIssue } from "./qr-scan-check";

type Tone = "success" | "warning" | "danger" | "neutral";

const icons = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  neutral: Info,
} as const;

const colors: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-fg-subtle",
};

/** The scan check under the preview: contrast first, then the logo. */
export function QrScanReport({ issues }: { issues: ScanIssue[] }) {
  const t = useTranslations("qr.check");
  const intlLocale = useIntlLocale();
  const headingId = useId();

  const describe = (issue: ScanIssue): [Tone, string] => {
    switch (issue.kind) {
      case "contrast": {
        const value = formatPercent(issue.difference, intlLocale);
        if (issue.tone === "ok") return ["success", t("contrastOk", { value })];
        if (issue.tone === "warning")
          return ["warning", t("contrastLow", { value })];
        return ["danger", t("contrastFail", { value })];
      }
      case "unknownColor":
        return ["neutral", t("unknownColor")];
      case "inverted":
        return ["warning", t("inverted")];
      case "transparent":
        return ["warning", t("transparent")];
      case "logoLarge":
        return [
          "warning",
          t("logoLarge", { value: formatPercent(issue.share, intlLocale) }),
        ];
      case "logoSmall":
        return ["neutral", t("logoSmall")];
      case "logoUnavailable":
        return ["warning", t("logoUnavailable")];
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex w-full flex-col gap-3">
      <h2 id={headingId} className="text-small font-medium">
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-2.5" aria-live="polite">
        {issues.map((issue) => {
          const [tone, message] = describe(issue);
          const Icon = icons[tone];
          return (
            <li key={issue.kind} className="flex items-start gap-2 text-small">
              <Icon
                aria-hidden
                className={cn("mt-px size-4 shrink-0", colors[tone])}
              />
              <span className="min-w-0 text-pretty">{message}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

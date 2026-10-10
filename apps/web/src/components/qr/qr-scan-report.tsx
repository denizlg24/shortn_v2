"use client";

import { formatPercent } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import { Notice, type NoticeTone } from "../settings/section";
import type { ScanIssue } from "./qr-scan-check";

/** The inline scan-contrast check under the preview (12 §QR codes). */
export function QrScanReport({ issues }: { issues: ScanIssue[] }) {
  const t = useTranslations("qr.check");
  const intlLocale = useIntlLocale();
  const headingId = useId();

  const describe = (issue: ScanIssue): [NoticeTone, string] => {
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
          const [tone, text] = describe(issue);
          return (
            <li key={issue.kind}>
              <Notice tone={tone}>{text}</Notice>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

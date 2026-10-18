import type { LinkHealthView } from "@shortn/core";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Section } from "../page/page";

export function HealthFlag({
  href,
  label,
  accessibleLabel,
}: {
  href: string;
  label: string;
  accessibleLabel: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}. ${accessibleLabel}`}
      data-link-health-flag
      className="mt-1 inline-flex min-h-6 max-w-48 items-center gap-1.5 rounded-control text-meta text-fg underline decoration-warning/70 underline-offset-4 hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
    >
      <TriangleAlert
        className="size-3.5 shrink-0 text-warning"
        aria-hidden="true"
      />
      <span>{label}</span>
    </Link>
  );
}

export async function LinkHealthSection({
  health,
  editHref,
}: {
  health?: LinkHealthView | undefined;
  editHref?: string | undefined;
}) {
  const t = await getTranslations("linkPages.health");
  const format = await getFormatter();
  const checks = [...(health?.checks ?? [])].sort(
    (a, b) =>
      Number(b.status === "http_error" && b.streak >= 2) -
      Number(a.status === "http_error" && a.streak >= 2),
  );
  const date = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const summary = health?.flagged
    ? t("repeatedErrors")
    : !checks.length
      ? t("pending")
      : !health?.checkedAt
        ? t("partial")
        : checks.every((check) => check.status === "ok")
          ? t("noErrors")
          : t("resultsAvailable");
  return (
    <div id="destination-health" className="scroll-mt-6 border-b border-line">
      <Section
        title={t("title")}
        description={t("description")}
        aside={
          editHref ? (
            <Link
              href={editHref}
              className="text-small text-signal hover:underline"
            >
              {t("edit")}
            </Link>
          ) : undefined
        }
      >
        <p className="flex items-start gap-2 text-small text-fg">
          {health?.flagged ? (
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden="true"
            />
          ) : null}
          {summary}
        </p>
        {checks.length ? (
          <details open={health?.flagged} className="group mt-3">
            <summary className="flex min-h-10 w-fit max-w-full cursor-pointer list-none items-center gap-2 rounded-control text-small text-signal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal [&::-webkit-details-marker]:hidden">
              <ChevronDown
                className="size-4 shrink-0 group-open:rotate-180"
                aria-hidden="true"
              />
              {t("results", { count: checks.length })}
            </summary>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {checks.map((check) => (
                <li
                  key={check.url}
                  className="grid min-w-0 gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6"
                >
                  <div className="min-w-0">
                    <p
                      className="line-clamp-2 text-small break-all text-fg"
                      title={check.url}
                    >
                      {check.url}
                    </p>
                    <p className="mt-1 text-meta text-fg-muted">
                      {t("checked", { date: date(check.checkedAt) })}
                    </p>
                    {check.failingSince ? (
                      <p className="mt-1 text-meta text-fg-muted">
                        {t("since", {
                          date: format.dateTime(new Date(check.failingSince), {
                            dateStyle: "medium",
                          }),
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div className="min-w-0 sm:text-right">
                    <p className="text-small text-fg">
                      {check.status === "ok"
                        ? check.httpStatus
                          ? t("response", { code: check.httpStatus })
                          : t("responded")
                        : check.status === "http_error"
                          ? t("httpError", { code: check.httpStatus ?? "—" })
                          : check.status === "blocked"
                            ? t("blocked")
                            : t("unreachable")}
                    </p>
                    {check.streak ? (
                      <p className="mt-1 text-meta text-fg-muted">
                        {t("streak", { count: check.streak })}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Section>
    </div>
  );
}

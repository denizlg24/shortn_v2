import { listOwnFeedback } from "@shortn/core";
import { feedbackMessageMax } from "@shortn/db";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import { submitFeedbackPageAction } from "@/server/actions/feedback";
import { serviceContext } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("feedback");
  return { title: t("title") };
}

export default async function FeedbackPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/feedback">) {
  const { workspace } = await params;
  const query = await searchParams;
  const sent = typeof query.sent === "string" ? query.sent : "";
  const from =
    typeof query.from === "string" &&
    query.from.startsWith("/") &&
    !query.from.startsWith("//")
      ? query.from.slice(0, 500)
      : "";
  const [t, format, ctx] = await Promise.all([
    getTranslations("feedback"),
    getFormatter(),
    serviceContext(workspace),
  ]);
  const history = await listOwnFeedback(ctx);
  return (
    <Page
      crumbs={[{ label: t("title") }]}
      title={t("title")}
      description={t("description")}
      width="form"
    >
      {sent ? <Notice tone="success">{t("sent")}</Notice> : null}
      <Section title={t("formTitle")}>
        <FeedbackForm
          key={sent}
          action={submitFeedbackPageAction.bind(null, workspace)}
          page={from}
          maxLength={feedbackMessageMax}
        />
      </Section>
      {history.length ? (
        <Section title={t("history")} description={t("historyHint")}>
          <ul className="flex flex-col">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 border-t border-line py-3 first:border-t-0 first:pt-0"
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-fg-muted">
                  <span className="font-medium text-fg">
                    {t(`categories.${item.category}`)}
                  </span>
                  <span aria-hidden>·</span>
                  <time dateTime={item.createdAt.toISOString()}>
                    {format.dateTime(item.createdAt, { dateStyle: "medium" })}
                  </time>
                  <span className="rounded-chip bg-bg-muted px-1.5 py-0.5">
                    {t(`statuses.${item.status}`)}
                  </span>
                </p>
                <p className="line-clamp-3 text-small break-words whitespace-pre-line">
                  {item.message}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </Page>
  );
}

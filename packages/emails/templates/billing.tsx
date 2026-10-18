import {
  Action,
  DetailRows,
  Heading,
  Layout,
  Panel,
  Paragraph,
  type Detail,
} from "../layout";
import { messages, type Locale } from "../messages";

export type BillingNotice =
  | { kind: "started"; plan: string }
  | { kind: "changed"; plan: string }
  | { kind: "scheduled"; plan: string; date: string }
  | { kind: "canceled"; date: string }
  | { kind: "payment_failed" };

export function billingSubject(locale: Locale, notice: BillingNotice) {
  const t = messages[locale].billing;
  switch (notice.kind) {
    case "started":
      return t.startedSubject(notice.plan);
    case "changed":
      return t.changedSubject(notice.plan);
    case "scheduled":
      return t.scheduledSubject;
    case "canceled":
      return t.canceledSubject;
    case "payment_failed":
      return t.paymentFailedSubject;
  }
}

function content(locale: Locale, workspace: string, notice: BillingNotice) {
  const t = messages[locale].billing;
  const workspaceRow: Detail = { label: t.workspace, value: workspace };
  switch (notice.kind) {
    case "started":
      return {
        heading: t.startedHeading(notice.plan),
        body: t.startedBody,
        rows: [workspaceRow, { label: t.plan, value: notice.plan }],
      };
    case "changed":
      return {
        heading: t.changedSubject(notice.plan),
        body: t.changedBody,
        rows: [workspaceRow, { label: t.plan, value: notice.plan }],
      };
    case "scheduled":
      return {
        heading: t.scheduledSubject,
        body: t.scheduledBody,
        rows: [
          workspaceRow,
          { label: t.newPlan, value: notice.plan },
          { label: t.startsOn, value: notice.date },
        ],
      };
    case "canceled":
      return {
        heading: t.canceledSubject,
        body: t.canceledBody,
        rows: [
          workspaceRow,
          { label: t.endsOn, value: notice.date },
          { label: t.afterwards, value: t.plans.free },
        ],
      };
    case "payment_failed":
      return {
        heading: t.paymentFailedSubject,
        body: t.paymentFailedBody,
        rows: [
          workspaceRow,
          { label: t.status, value: t.paymentFailed },
          { label: t.gracePeriod, value: t.gracePeriodValue },
        ],
      };
  }
}

export function BillingEmail({
  locale,
  workspace,
  notice,
  url,
}: {
  locale: Locale;
  workspace: string;
  notice: BillingNotice;
  url: string;
}) {
  const t = messages[locale];
  const { heading, body, rows } = content(locale, workspace, notice);
  return (
    <Layout
      locale={locale}
      preview={`${workspace} · ${body}`}
      footer={t.footer.workspace}
    >
      <Heading>{heading}</Heading>
      <Paragraph>{body}</Paragraph>
      <Panel>
        <DetailRows rows={rows} />
      </Panel>
      <Action href={url}>
        {notice.kind === "payment_failed"
          ? t.billing.paymentAction
          : t.billing.action}
      </Action>
    </Layout>
  );
}

import {
  Action,
  DetailRows,
  Heading,
  Layout,
  Panel,
  Paragraph,
  type Detail,
  type Branded,
} from "../layout";
import { messages, type Locale } from "../messages";

export const webhookDisabledSubject = (locale: Locale) =>
  messages[locale].webhook.subject;

export function WebhookDisabled({
  locale,
  name,
  endpoint,
  url,
  logoUrl,
}: Branded & {
  locale: Locale;
  name: string;
  endpoint?: string | undefined;
  url: string;
}) {
  const t = messages[locale];
  const rows: Detail[] = [
    { label: t.webhook.webhook, value: name },
    ...(endpoint
      ? [{ label: t.webhook.endpoint, value: endpoint, mono: true, wide: true }]
      : []),
    { label: t.webhook.reason, value: t.webhook.reasonValue },
  ];
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={`${name} · ${t.webhook.body}`}
      footer={t.footer.workspace}
    >
      <Heading>{t.webhook.heading}</Heading>
      <Paragraph>{t.webhook.body}</Paragraph>
      <Panel>
        <DetailRows rows={rows} />
      </Panel>
      <Paragraph>{t.webhook.next}</Paragraph>
      <Action href={url}>{t.webhook.action}</Action>
    </Layout>
  );
}

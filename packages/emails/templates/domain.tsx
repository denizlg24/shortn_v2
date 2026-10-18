import {
  Action,
  DetailRows,
  Heading,
  Layout,
  Panel,
  Paragraph,
  type Branded,
} from "../layout";
import { messages, type Locale } from "../messages";

export const domainReadySubject = (locale: Locale) =>
  messages[locale].domain.subject;

export function DomainReady({
  locale,
  hostname,
  url,
  logoUrl,
}: Branded & {
  locale: Locale;
  hostname: string;
  url: string;
}) {
  const t = messages[locale];
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={`${hostname} · ${t.domain.body}`}
      footer={t.footer.workspace}
    >
      <Heading>{t.domain.heading}</Heading>
      <Paragraph>{t.domain.body}</Paragraph>
      <Panel>
        <DetailRows
          rows={[
            { label: t.domain.domain, value: hostname, mono: true },
            { label: t.domain.dns, value: t.domain.verified },
            { label: t.domain.https, value: t.domain.certificateActive },
          ]}
        />
      </Panel>
      <Action href={url}>{t.domain.action}</Action>
    </Layout>
  );
}

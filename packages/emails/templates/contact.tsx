import {
  Code,
  DetailRows,
  Heading,
  Layout,
  Muted,
  Panel,
  Paragraph,
  Quote,
  type Detail,
} from "../layout";
import { messages, operatorMessages, type Locale } from "../messages";

export const contactReceivedSubject = (locale: Locale, reference: string) =>
  messages[locale].contact.subject(reference);

export function ContactReceived({
  locale,
  reference,
  message,
}: {
  locale: Locale;
  reference: string;
  message: string;
}) {
  const t = messages[locale];
  return (
    <Layout
      locale={locale}
      preview={`${t.contact.heading}. ${t.contact.body}`}
      footer={t.footer.contact}
    >
      <Heading>{t.contact.heading}</Heading>
      <Paragraph>{t.contact.body}</Paragraph>
      <Code label={t.contact.reference}>{reference}</Code>
      <Quote label={t.contact.yourMessage}>{message}</Quote>
    </Layout>
  );
}

export const contactNotificationSubject = operatorMessages.subject;

export function ContactNotification({
  reference,
  name,
  email,
  company,
  topic,
  locale,
  message,
}: {
  reference: string;
  name: string;
  email: string;
  company?: string | undefined;
  topic: string;
  locale: Locale;
  message: string;
}) {
  const t = operatorMessages;
  const rows: Detail[] = [
    { label: t.from, value: name },
    {
      label: t.email,
      value: (
        <a href={`mailto:${email}`} style={{ color: "inherit" }}>
          {email}
        </a>
      ),
      wide: true,
    },
    ...(company ? [{ label: t.company, value: company }] : []),
    { label: t.topic, value: topic },
    { label: t.language, value: t.languages[locale] },
    { label: t.reference, value: reference, mono: true },
  ];
  return (
    <Layout
      locale="en"
      preview={`${name}: ${message.slice(0, 80)}`}
      footer={t.footer}
    >
      <Heading>{t.heading(name)}</Heading>
      <Panel>
        <DetailRows rows={rows} />
      </Panel>
      <Quote label={t.message}>{message}</Quote>
      <Muted>{t.reply(name)}</Muted>
    </Layout>
  );
}

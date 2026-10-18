import {
  Action,
  Heading,
  Layout,
  List,
  Paragraph,
  type Branded,
} from "../layout";
import { messages, type Locale } from "../messages";

export const announcementSubject = (locale: Locale) =>
  messages[locale].announcement.subject;

const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** The reader's own bio host when the handle is a usable DNS label. */
function bioHost(locale: Locale, handle: string | undefined) {
  const label = handle?.trim().toLowerCase();
  return label && dnsLabel.test(label)
    ? `${label}.shortn.at`
    : messages[locale].announcement.bioPlaceholder;
}

export function ProductAnnouncement({
  locale,
  name,
  handle,
  url,
  logoUrl,
}: Branded & {
  locale: Locale;
  name?: string | undefined;
  handle?: string | undefined;
  url: string;
}) {
  const t = messages[locale];
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={t.announcement.preview}
      footer={t.footer.announcement}
    >
      <Heading>{t.announcement.heading}</Heading>
      <Paragraph>{t.announcement.intro(name?.trim() ?? "")}</Paragraph>
      <List items={t.announcement.changes(bioHost(locale, handle))} />
      <Action href={url}>{t.announcement.action}</Action>
      <Paragraph>{t.announcement.note}</Paragraph>
    </Layout>
  );
}

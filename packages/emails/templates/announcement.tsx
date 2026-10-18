import { Action, Heading, Layout, List, Paragraph } from "../layout";
import { messages, type Locale } from "../messages";

export const announcementSubject = (locale: Locale) =>
  messages[locale].announcement.subject;

export function ProductAnnouncement({
  locale,
  name,
  url,
}: {
  locale: Locale;
  name?: string | undefined;
  url: string;
}) {
  const t = messages[locale];
  return (
    <Layout
      locale={locale}
      preview={t.announcement.preview}
      footer={t.footer.announcement}
    >
      <Heading>{t.announcement.heading}</Heading>
      <Paragraph>{t.announcement.intro(name?.trim() ?? "")}</Paragraph>
      <List items={t.announcement.changes} />
      <Action href={url}>{t.announcement.action}</Action>
      <Paragraph>{t.announcement.note}</Paragraph>
    </Layout>
  );
}

import { Action, Layout, Heading, Paragraph } from "../layout";
import { messages, type Locale } from "../messages";
const copy = {
  en: {
    subject: "Your custom domain is ready",
    body: "Your domain is verified and its HTTPS certificate is active.",
    action: "Manage domains",
  },
  pt: {
    subject: "O seu domínio personalizado está pronto",
    body: "O seu domínio está verificado e o certificado HTTPS está ativo.",
    action: "Gerir domínios",
  },
  es: {
    subject: "Tu dominio personalizado está listo",
    body: "Tu dominio está verificado y su certificado HTTPS está activo.",
    action: "Gestionar dominios",
  },
};
export const domainReadySubject = (locale: Locale) => copy[locale].subject;
export function DomainReady({
  locale,
  hostname,
  url,
}: {
  locale: Locale;
  hostname: string;
  url: string;
}) {
  const t = copy[locale];
  return (
    <Layout
      locale={locale}
      preview={`${hostname}: ${t.body}`}
      footer={messages[locale].footer}
    >
      <Heading>{hostname}</Heading>
      <Paragraph>{t.body}</Paragraph>
      <Action href={url}>{t.action}</Action>
    </Layout>
  );
}

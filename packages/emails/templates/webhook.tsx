import { Action, Layout, Heading, Paragraph } from "../layout";
import { messages, type Locale } from "../messages";

const copy = {
  en: {
    subject: "Your webhook was disabled",
    body: "Delivery to this webhook has failed for three days. Check your receiver, then enable the webhook again using the API.",
    action: "Open workspace settings",
  },
  pt: {
    subject: "O seu webhook foi desativado",
    body: "A entrega para este webhook falhou durante três dias. Verifique o destino e volte a ativar o webhook através da API.",
    action: "Abrir definições do espaço de trabalho",
  },
  es: {
    subject: "Tu webhook se ha desactivado",
    body: "La entrega a este webhook ha fallado durante tres días. Revisa el destino y vuelve a activar el webhook mediante la API.",
    action: "Abrir ajustes del espacio de trabajo",
  },
};
export const webhookDisabledSubject = (locale: Locale) => copy[locale].subject;
export function WebhookDisabled({
  locale,
  name,
  url,
}: {
  locale: Locale;
  name: string;
  url: string;
}) {
  const t = copy[locale];
  return (
    <Layout
      locale={locale}
      preview={t.subject}
      footer={messages[locale].footer}
    >
      <Heading>{t.subject}</Heading>
      <Paragraph>{name}</Paragraph>
      <Paragraph>{t.body}</Paragraph>
      <Action href={url}>{t.action}</Action>
    </Layout>
  );
}

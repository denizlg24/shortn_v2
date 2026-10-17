import { Heading, Layout, Muted, Paragraph } from "../layout";
import { messages, type Locale } from "../messages";

const copy = {
  en: {
    subject: (reference: string) => `We received your message (${reference})`,
    heading: "Thanks for getting in touch",
    body: "We've received your message and will reply to this address. Keep this reference if you write to us again:",
    yourMessage: "Your message",
  },
  pt: {
    subject: (reference: string) => `Recebemos a sua mensagem (${reference})`,
    heading: "Obrigado pelo contacto",
    body: "Recebemos a sua mensagem e vamos responder para este endereço. Guarde esta referência se voltar a escrever-nos:",
    yourMessage: "A sua mensagem",
  },
  es: {
    subject: (reference: string) => `Hemos recibido tu mensaje (${reference})`,
    heading: "Gracias por escribirnos",
    body: "Hemos recibido tu mensaje y te responderemos a esta dirección. Guarda esta referencia si vuelves a escribirnos:",
    yourMessage: "Tu mensaje",
  },
};

export const contactReceivedSubject = (locale: Locale, reference: string) =>
  copy[locale].subject(reference);

export function ContactReceived({
  locale,
  reference,
  message,
}: {
  locale: Locale;
  reference: string;
  message: string;
}) {
  const t = copy[locale];
  return (
    <Layout
      locale={locale}
      preview={t.heading}
      footer={messages[locale].footer}
    >
      <Heading>{t.heading}</Heading>
      <Paragraph>{t.body}</Paragraph>
      <Paragraph>
        <strong>{reference}</strong>
      </Paragraph>
      <Muted>{t.yourMessage}</Muted>
      <Paragraph>{message}</Paragraph>
    </Layout>
  );
}

// Operator-facing, so English only.
export const contactNotificationSubject = (topic: string, reference: string) =>
  `[Contact · ${topic}] ${reference}`;

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
  return (
    <Layout
      locale="en"
      preview={`${name}: ${message.slice(0, 80)}`}
      footer={messages.en.footer}
    >
      <Heading>{reference}</Heading>
      <Paragraph>
        {name} &lt;{email}&gt;
        {company ? ` · ${company}` : ""} · {topic} · {locale}
      </Paragraph>
      <Paragraph>{message}</Paragraph>
      <Muted>Reply to this email to answer the sender.</Muted>
    </Layout>
  );
}

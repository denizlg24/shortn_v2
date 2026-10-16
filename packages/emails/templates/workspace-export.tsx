import { Action, Layout, Heading, Paragraph } from "../layout";
import { messages, type Locale } from "../messages";
const copy = {
  en: {
    subject: "Your workspace export is ready",
    body: "Your workspace archive is ready. Sign in to download it. The export expires 24 hours after you requested it.",
    action: "Open workspace export",
  },
  pt: {
    subject: "A exportação do seu espaço de trabalho está pronta",
    body: "O arquivo do espaço de trabalho está pronto. Inicie sessão para o descarregar. A exportação expira 24 horas após o pedido.",
    action: "Abrir exportação do espaço de trabalho",
  },
  es: {
    subject: "La exportación de tu espacio de trabajo está lista",
    body: "El archivo del espacio de trabajo está listo. Inicia sesión para descargarlo. La exportación caduca 24 horas después de solicitarla.",
    action: "Abrir exportación del espacio de trabajo",
  },
};
export const workspaceExportSubject = (locale: Locale) => copy[locale].subject;
export function WorkspaceExportReady({
  locale,
  workspace,
  url,
}: {
  locale: Locale;
  workspace: string;
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
      <Paragraph>{workspace}</Paragraph>
      <Paragraph>{t.body}</Paragraph>
      <Action href={url}>{t.action}</Action>
    </Layout>
  );
}

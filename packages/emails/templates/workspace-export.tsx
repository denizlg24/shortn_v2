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

export const workspaceExportSubject = (locale: Locale) =>
  messages[locale].workspaceExport.subject;

export function WorkspaceExportReady({
  locale,
  workspace,
  url,
  logoUrl,
}: Branded & {
  locale: Locale;
  workspace: string;
  url: string;
}) {
  const t = messages[locale];
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={`${workspace} · ${t.workspaceExport.body}`}
      footer={t.footer.workspace}
    >
      <Heading>{t.workspaceExport.heading}</Heading>
      <Paragraph>{t.workspaceExport.body}</Paragraph>
      <Panel>
        <DetailRows
          rows={[
            { label: t.workspaceExport.workspace, value: workspace },
            {
              label: t.workspaceExport.expires,
              value: t.workspaceExport.expiresValue,
            },
          ]}
        />
      </Panel>
      <Action href={url}>{t.workspaceExport.action}</Action>
    </Layout>
  );
}

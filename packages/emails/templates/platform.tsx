import {
  Heading,
  Layout,
  Paragraph,
  DetailRows,
  type Branded,
} from "../layout";
import { messages, type Locale } from "../messages";

const copy = {
  en: {
    accountSuspended: [
      "Your account is suspended",
      "Sign-in is disabled. Contact support@shortn.at if you need help.",
    ],
    workspaceSuspended: [
      "Your workspace is restricted",
      "A member of our team has restricted this workspace. Contact support@shortn.at for help.",
    ],
    workspaceRestored: [
      "Your workspace is restored",
      "Your workspace restriction has been removed.",
    ],
    linkRemoved: [
      "A link has been removed",
      "A link in your workspace was taken down following a review.",
    ],
    domainSuspended: [
      "Your domain is suspended",
      "This domain is temporarily unavailable following a review.",
    ],
    compExpiring: [
      "Your complimentary plan is expiring",
      "Your complimentary access ends on the date below. Your paid subscription, if any, stays in place.",
    ],
    accountDeletionScheduled: [
      "Account deletion scheduled",
      "Your account is scheduled for permanent deletion after the grace period. Contact support@shortn.at before the date below to cancel.",
    ],
    accountDeleted: [
      "Your account has been deleted",
      "Your account and owned workspace data have been erased. Some billing, support and abuse-prevention records are retained.",
    ],
  },
  pt: {
    accountSuspended: [
      "A sua conta foi suspensa",
      "O início de sessão está desativado. Contacte support@shortn.at se precisar de ajuda.",
    ],
    workspaceSuspended: [
      "O seu espaço de trabalho foi restringido",
      "A nossa equipa restringiu este espaço. Contacte support@shortn.at para obter ajuda.",
    ],
    workspaceRestored: [
      "O seu espaço de trabalho foi restaurado",
      "A restrição do seu espaço de trabalho foi removida.",
    ],
    linkRemoved: [
      "Uma ligação foi removida",
      "Uma ligação do seu espaço de trabalho foi removida após análise.",
    ],
    domainSuspended: [
      "O seu domínio foi suspenso",
      "Este domínio está temporariamente indisponível após análise.",
    ],
    compExpiring: [
      "O seu plano de oferta vai expirar",
      "O acesso de oferta termina na data indicada abaixo. Uma eventual subscrição paga mantém-se.",
    ],
    accountDeletionScheduled: [
      "Eliminação da conta agendada",
      "A sua conta será eliminada permanentemente após o período de espera. Para cancelar, contacte support@shortn.at antes da data indicada.",
    ],
    accountDeleted: [
      "A sua conta foi eliminada",
      "A sua conta e os dados dos seus espaços de trabalho foram eliminados. Conservamos alguns registos de faturação, apoio e prevenção de abuso.",
    ],
  },
  es: {
    accountSuspended: [
      "Tu cuenta está suspendida",
      "El inicio de sesión está desactivado. Contacta con support@shortn.at si necesitas ayuda.",
    ],
    workspaceSuspended: [
      "Tu espacio de trabajo está restringido",
      "Nuestro equipo ha restringido este espacio. Contacta con support@shortn.at para obtener ayuda.",
    ],
    workspaceRestored: [
      "Tu espacio de trabajo está restaurado",
      "Se ha eliminado la restricción de tu espacio de trabajo.",
    ],
    linkRemoved: [
      "Se ha eliminado un enlace",
      "Se ha retirado un enlace de tu espacio de trabajo tras una revisión.",
    ],
    domainSuspended: [
      "Tu dominio está suspendido",
      "Este dominio no está disponible temporalmente tras una revisión.",
    ],
    compExpiring: [
      "Tu plan de cortesía va a caducar",
      "El acceso de cortesía termina en la fecha indicada. Tu suscripción de pago, si existe, se mantiene.",
    ],
    accountDeletionScheduled: [
      "Eliminación de cuenta programada",
      "Tu cuenta se eliminará permanentemente tras el período de espera. Para cancelar, contacta con support@shortn.at antes de la fecha indicada.",
    ],
    accountDeleted: [
      "Tu cuenta se ha eliminado",
      "Tu cuenta y los datos de tus espacios de trabajo se han borrado. Conservamos algunos registros de facturación, soporte y prevención de abusos.",
    ],
  },
} as const;
export type PlatformNoticeKind = keyof typeof copy.en;
export const platformSubject = (locale: Locale, kind: PlatformNoticeKind) =>
  copy[locale][kind][0];
export function PlatformNotice({
  locale,
  kind,
  details,
  logoUrl,
}: Branded & {
  locale: Locale;
  kind: PlatformNoticeKind;
  details: { label: string; value: string }[];
}) {
  const [title, body] = copy[locale][kind];
  const detailLabels: Record<string, Record<string, string>> = {
    pt: {
      Workspace: "Espaço de trabalho",
      Domain: "Domínio",
      Plan: "Plano",
      Expires: "Expira em",
      "Deletion date": "Data de eliminação",
      Until: "Até",
      Note: "Nota",
      "Links removed": "Ligações removidas",
      Link: "Ligação",
    },
    es: {
      Workspace: "Espacio de trabajo",
      Domain: "Dominio",
      Plan: "Plan",
      Expires: "Caduca el",
      "Deletion date": "Fecha de eliminación",
      Until: "Hasta",
      Note: "Nota",
      "Links removed": "Enlaces retirados",
      Link: "Enlace",
    },
  };
  const rows = details.map((row) => ({
    label: detailLabels[locale]?.[row.label] ?? row.label,
    value:
      ["Expires", "Deletion date", "Until"].includes(row.label) &&
      Number.isFinite(new Date(row.value).getTime())
        ? `${new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date(row.value))} UTC`
        : row.value,
  }));

  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={title}
      footer={messages[locale].footer.workspace}
    >
      <Heading>{title}</Heading>
      <Paragraph>{body}</Paragraph>
      <DetailRows rows={rows} />
    </Layout>
  );
}

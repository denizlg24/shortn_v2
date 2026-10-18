export const locales = ["en", "pt", "es"] as const;
export type Locale = (typeof locales)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

type Role = "admin" | "member" | "viewer";

interface Messages {
  footer: {
    account: string;
    invite: string;
    workspace: string;
    contact: string;
    announcement: string;
    madeIn: string;
  };
  fallback: string;
  ignore: string;
  verify: {
    subject: string;
    changeSubject: string;
    heading: string;
    changeHeading: string;
    body: (name: string) => string;
    changeBody: string;
    action: string;
    expiry: string;
  };
  verified: {
    subject: string;
    heading: string;
    body: string;
    action: string;
  };
  reset: {
    subject: string;
    heading: string;
    body: string;
    action: string;
    expiry: string;
  };
  emailChange: {
    subject: string;
    heading: string;
    body: string;
    newEmail: string;
    action: string;
  };
  billing: {
    plans: Record<"free" | "basic" | "plus" | "pro" | "enterprise", string>;
    startedSubject: (plan: string) => string;
    startedHeading: (plan: string) => string;
    startedBody: string;
    changedSubject: (plan: string) => string;
    changedBody: string;
    scheduledSubject: string;
    scheduledBody: string;
    canceledSubject: string;
    canceledBody: string;
    paymentFailedSubject: string;
    paymentFailedBody: string;
    workspace: string;
    plan: string;
    newPlan: string;
    startsOn: string;
    endsOn: string;
    afterwards: string;
    status: string;
    paymentFailed: string;
    gracePeriod: string;
    gracePeriodValue: string;
    action: string;
    paymentAction: string;
  };
  invite: {
    subject: (workspace: string) => string;
    heading: (workspace: string) => string;
    body: (inviter: string, role: string) => string;
    roles: Record<Role, string>;
    roleDescriptions: Record<Role, string>;
    action: string;
    expiry: string;
  };
  contact: {
    subject: (reference: string) => string;
    heading: string;
    body: string;
    reference: string;
    yourMessage: string;
  };
  domain: {
    subject: string;
    heading: string;
    body: string;
    domain: string;
    dns: string;
    verified: string;
    https: string;
    certificateActive: string;
    action: string;
  };
  webhook: {
    subject: string;
    heading: string;
    body: string;
    next: string;
    webhook: string;
    endpoint: string;
    reason: string;
    reasonValue: string;
    action: string;
  };
  workspaceExport: {
    subject: string;
    heading: string;
    body: string;
    workspace: string;
    expires: string;
    expiresValue: string;
    action: string;
  };
  announcement: {
    subject: string;
    preview: string;
    heading: string;
    intro: (name: string) => string;
    changes: readonly { title: string; body: string }[];
    action: string;
    note: string;
  };
}

const en: Messages = {
  footer: {
    account:
      "You're receiving this because of activity on your Shortn account.",
    invite:
      "You're receiving this because someone invited this address to a Shortn workspace.",
    workspace:
      "You're receiving this because of activity in a Shortn workspace you manage.",
    contact:
      "You're receiving this because you sent us a message on shortn.at.",
    announcement: "You're receiving this because you have a Shortn account.",
    madeIn: "Built in Portugal",
  },
  fallback: "If the button doesn't work, paste this link into your browser:",
  ignore:
    "If you didn't ask for this, you can ignore this email. Nothing changes until the link is used.",
  verify: {
    subject: "Verify your email for Shortn",
    changeSubject: "Verify your new email address",
    heading: "Verify your email",
    changeHeading: "Verify your new email",
    body: (name) =>
      name
        ? `Hi ${name}, confirm this is your address to finish setting up your Shortn account.`
        : "Confirm this is your address to finish setting up your Shortn account.",
    changeBody:
      "Confirm this address to finish changing the email on your Shortn account.",
    action: "Verify email",
    expiry: "The link works for one hour.",
  },
  verified: {
    subject: "Your email is verified",
    heading: "Your email is verified",
    body: "Your Shortn account is ready. Paste a long URL on the Links page to create your first short link.",
    action: "Open Shortn",
  },
  reset: {
    subject: "Reset your Shortn password",
    heading: "Reset your password",
    body: "We received a request to reset the password for your Shortn account.",
    action: "Choose a new password",
    expiry: "The link works once and expires in one hour.",
  },
  emailChange: {
    subject: "Approve your email change",
    heading: "Approve your email change",
    body: "You asked to change the email address on your Shortn account. Approve it from this address first, then we'll send a link to confirm the new one.",
    newEmail: "New address",
    action: "Approve change",
  },
  billing: {
    plans: {
      free: "Free",
      basic: "Basic",
      plus: "Plus",
      pro: "Pro",
      enterprise: "Enterprise",
    },
    startedSubject: (plan) => `Your Shortn ${plan} plan is active`,
    startedHeading: (plan) => `Your ${plan} plan is active`,
    startedBody:
      "Thanks for subscribing. The new limits and features are available now.",
    changedSubject: (plan) => `Your plan is now ${plan}`,
    changedBody: "The change applies now, along with the new plan's limits.",
    scheduledSubject: "Your plan change is scheduled",
    scheduledBody: "Nothing changes until the date below.",
    canceledSubject: "Your subscription will end",
    canceledBody:
      "It won't renew. Your links keep working on the Free plan after it ends.",
    paymentFailedSubject: "We couldn't take your payment",
    paymentFailedBody:
      "The last payment didn't go through. Everything keeps working for 7 days while you update your payment method.",
    workspace: "Workspace",
    plan: "Plan",
    newPlan: "New plan",
    startsOn: "Starts on",
    endsOn: "Ends on",
    afterwards: "Afterwards",
    status: "Status",
    paymentFailed: "Payment failed",
    gracePeriod: "Grace period",
    gracePeriodValue: "7 days",
    action: "Open billing",
    paymentAction: "Update payment method",
  },
  invite: {
    subject: (workspace) => `You're invited to ${workspace} on Shortn`,
    heading: (workspace) => `Join ${workspace} on Shortn`,
    body: (inviter, role) => `${inviter} invited you to join as ${role}.`,
    roles: { admin: "an admin", member: "a member", viewer: "a viewer" },
    roleDescriptions: {
      admin:
        "Admins manage members, domains and workspace settings, and can do everything members can.",
      member:
        "Members create and edit links, QR codes, bio pages and campaigns.",
      viewer: "Viewers see links and analytics but can't change anything.",
    },
    action: "Accept invitation",
    expiry: "The invitation works once and expires in 7 days.",
  },
  contact: {
    subject: (reference) => `We received your message (${reference})`,
    heading: "We got your message",
    body: "We'll reply to this address. If you write again about the same request, include the reference below.",
    reference: "Reference",
    yourMessage: "Your message",
  },
  domain: {
    subject: "Your custom domain is ready",
    heading: "Your domain is ready",
    body: "It's verified and serving over HTTPS. You can use it for new short links now.",
    domain: "Domain",
    dns: "DNS",
    verified: "Verified",
    https: "HTTPS",
    certificateActive: "Certificate active",
    action: "Manage domains",
  },
  webhook: {
    subject: "Your webhook was disabled",
    heading: "Your webhook was disabled",
    body: "Deliveries to it have failed for 3 days, so we've stopped sending events.",
    next: "Fix the receiving server, then turn the webhook back on with the API.",
    webhook: "Webhook",
    endpoint: "Endpoint",
    reason: "Reason",
    reasonValue: "Failing for 3 days",
    action: "Open settings",
  },
  workspaceExport: {
    subject: "Your workspace export is ready",
    heading: "Your export is ready",
    body: "Sign in to download the archive.",
    workspace: "Workspace",
    expires: "Expires",
    expiresValue: "24 hours after the request",
    action: "Open export",
  },
  announcement: {
    subject: "The new Shortn is here",
    preview: "Your links and QR codes keep working. Here's what's new.",
    heading: "The new Shortn is here",
    intro: (name) =>
      `${name ? `${name}, we` : "We"} rebuilt Shortn from the ground up. Same account, same links, and a better place to manage them.`,
    changes: [
      {
        title: "A new dashboard at app.shortn.at",
        body: "Sign in with your existing account.",
      },
      {
        title: "Bio pages on their own address",
        body: "Your page now lives at yourname.shortn.at. Old shortn.at/b/ links redirect there.",
      },
      {
        title: "An API, webhooks and an MCP server",
        body: "Connect Shortn to your own systems and AI assistants.",
      },
    ],
    action: "Open the new dashboard",
    note: "Nothing breaks. Every short link, QR code and bio page you've shared keeps working, and there's nothing you need to do.",
  },
};

const pt: Messages = {
  footer: {
    account: "Recebeu este e-mail devido a atividade na sua conta Shortn.",
    invite:
      "Recebeu este e-mail porque alguém convidou este endereço para um espaço de trabalho no Shortn.",
    workspace:
      "Recebeu este e-mail devido a atividade num espaço de trabalho que gere no Shortn.",
    contact:
      "Recebeu este e-mail porque nos enviou uma mensagem a partir de shortn.at.",
    announcement: "Recebeu este e-mail porque tem uma conta Shortn.",
    madeIn: "Feito em Portugal",
  },
  fallback: "Se o botão não funcionar, cole este link no navegador:",
  ignore:
    "Se não fez este pedido, pode ignorar este e-mail. Nada muda enquanto o link não for usado.",
  verify: {
    subject: "Verifique o seu e-mail no Shortn",
    changeSubject: "Verifique o seu novo endereço de e-mail",
    heading: "Verifique o seu e-mail",
    changeHeading: "Verifique o novo e-mail",
    body: (name) =>
      name
        ? `Olá ${name}, confirme que este é o seu endereço para concluir a criação da sua conta Shortn.`
        : "Confirme que este é o seu endereço para concluir a criação da sua conta Shortn.",
    changeBody:
      "Confirme este endereço para concluir a alteração do e-mail da sua conta Shortn.",
    action: "Verificar e-mail",
    expiry: "O link é válido durante uma hora.",
  },
  verified: {
    subject: "O seu e-mail está verificado",
    heading: "O seu e-mail está verificado",
    body: "A sua conta Shortn está pronta. Cole um URL longo na página Links para criar o seu primeiro link curto.",
    action: "Abrir o Shortn",
  },
  reset: {
    subject: "Repor a palavra-passe do Shortn",
    heading: "Repor a palavra-passe",
    body: "Recebemos um pedido para repor a palavra-passe da sua conta Shortn.",
    action: "Escolher nova palavra-passe",
    expiry: "O link só funciona uma vez e expira dentro de uma hora.",
  },
  emailChange: {
    subject: "Aprove a alteração de e-mail",
    heading: "Aprove a alteração de e-mail",
    body: "Pediu para alterar o endereço de e-mail da sua conta Shortn. Aprove primeiro a alteração a partir deste endereço; depois enviamos um link para confirmar o novo.",
    newEmail: "Novo endereço",
    action: "Aprovar alteração",
  },
  billing: {
    plans: {
      free: "Grátis",
      basic: "Basic",
      plus: "Plus",
      pro: "Pro",
      enterprise: "Enterprise",
    },
    startedSubject: (plan) => `O seu plano ${plan} do Shortn está ativo`,
    startedHeading: (plan) => `O seu plano ${plan} está ativo`,
    startedBody:
      "Obrigado pela subscrição. Os novos limites e funcionalidades já estão disponíveis.",
    changedSubject: (plan) => `O seu plano é agora ${plan}`,
    changedBody: "A alteração já está em vigor, com os limites do novo plano.",
    scheduledSubject: "A alteração de plano está agendada",
    scheduledBody: "Nada muda até à data indicada abaixo.",
    canceledSubject: "A sua subscrição vai terminar",
    canceledBody:
      "Não será renovada. Depois de terminar, os seus links continuam a funcionar no plano Grátis.",
    paymentFailedSubject: "Não foi possível cobrar o pagamento",
    paymentFailedBody:
      "O último pagamento não foi aceite. Tudo continua a funcionar durante 7 dias enquanto atualiza o método de pagamento.",
    workspace: "Espaço de trabalho",
    plan: "Plano",
    newPlan: "Novo plano",
    startsOn: "Começa a",
    endsOn: "Termina a",
    afterwards: "Depois",
    status: "Estado",
    paymentFailed: "Pagamento falhado",
    gracePeriod: "Período de tolerância",
    gracePeriodValue: "7 dias",
    action: "Abrir faturação",
    paymentAction: "Atualizar método de pagamento",
  },
  invite: {
    subject: (workspace) => `Foi convidado para ${workspace} no Shortn`,
    heading: (workspace) => `Junte-se a ${workspace} no Shortn`,
    body: (inviter, role) => `${inviter} convidou-o para entrar como ${role}.`,
    roles: { admin: "administrador", member: "membro", viewer: "leitor" },
    roleDescriptions: {
      admin:
        "Os administradores gerem membros, domínios e as definições do espaço de trabalho, e fazem tudo o que os membros fazem.",
      member:
        "Os membros criam e editam links, códigos QR, páginas bio e campanhas.",
      viewer:
        "Os leitores veem links e estatísticas, mas não podem alterar nada.",
    },
    action: "Aceitar convite",
    expiry: "O convite só pode ser usado uma vez e expira dentro de 7 dias.",
  },
  contact: {
    subject: (reference) => `Recebemos a sua mensagem (${reference})`,
    heading: "Recebemos a sua mensagem",
    body: "Vamos responder para este endereço. Se voltar a escrever sobre o mesmo pedido, indique a referência abaixo.",
    reference: "Referência",
    yourMessage: "A sua mensagem",
  },
  domain: {
    subject: "O seu domínio personalizado está pronto",
    heading: "O seu domínio está pronto",
    body: "Está verificado e já funciona com HTTPS. Pode usá-lo nos novos links curtos a partir de agora.",
    domain: "Domínio",
    dns: "DNS",
    verified: "Verificado",
    https: "HTTPS",
    certificateActive: "Certificado ativo",
    action: "Gerir domínios",
  },
  webhook: {
    subject: "O seu webhook foi desativado",
    heading: "O seu webhook foi desativado",
    body: "As entregas falharam durante 3 dias, por isso deixámos de enviar eventos.",
    next: "Corrija o servidor que recebe os eventos e volte a ativar o webhook através da API.",
    webhook: "Webhook",
    endpoint: "Endpoint",
    reason: "Motivo",
    reasonValue: "A falhar há 3 dias",
    action: "Abrir definições",
  },
  workspaceExport: {
    subject: "A exportação do seu espaço de trabalho está pronta",
    heading: "A sua exportação está pronta",
    body: "Inicie sessão para descarregar o arquivo.",
    workspace: "Espaço de trabalho",
    expires: "Expira",
    expiresValue: "24 horas após o pedido",
    action: "Abrir exportação",
  },
  announcement: {
    subject: "O novo Shortn chegou",
    preview:
      "Os seus links e códigos QR continuam a funcionar. Veja o que mudou.",
    heading: "O novo Shortn chegou",
    intro: (name) =>
      `${name ? `${name}, reconstruímos` : "Reconstruímos"} o Shortn de raiz. A mesma conta, os mesmos links e um sítio melhor para os gerir.`,
    changes: [
      {
        title: "Um novo painel em app.shortn.at",
        body: "Inicie sessão com a conta que já tem.",
      },
      {
        title: "Páginas bio com endereço próprio",
        body: "A sua página está agora em o\u2011seu\u2011nome.shortn.at. Os links antigos shortn.at/b/ redirecionam para lá.",
      },
      {
        title: "API, webhooks e servidor MCP",
        body: "Ligue o Shortn aos seus sistemas e a assistentes de IA.",
      },
    ],
    action: "Abrir o novo painel",
    note: "Nada deixa de funcionar. Todos os links curtos, códigos QR e páginas bio que partilhou continuam ativos, e não precisa de fazer nada.",
  },
};

const es: Messages = {
  footer: {
    account: "Recibes este correo por actividad en tu cuenta de Shortn.",
    invite:
      "Recibes este correo porque alguien invitó a esta dirección a un espacio de trabajo de Shortn.",
    workspace:
      "Recibes este correo por actividad en un espacio de trabajo que gestionas en Shortn.",
    contact: "Recibes este correo porque nos escribiste desde shortn.at.",
    announcement: "Recibes este correo porque tienes una cuenta de Shortn.",
    madeIn: "Hecho en Portugal",
  },
  fallback: "Si el botón no funciona, pega este enlace en el navegador:",
  ignore:
    "Si no lo has pedido, puedes ignorar este correo. No cambia nada mientras no se use el enlace.",
  verify: {
    subject: "Verifica tu correo en Shortn",
    changeSubject: "Verifica tu nueva dirección de correo",
    heading: "Verifica tu correo",
    changeHeading: "Verifica tu nuevo correo",
    body: (name) =>
      name
        ? `Hola, ${name}. Confirma que esta es tu dirección para terminar de crear tu cuenta de Shortn.`
        : "Confirma que esta es tu dirección para terminar de crear tu cuenta de Shortn.",
    changeBody:
      "Confirma esta dirección para terminar de cambiar el correo de tu cuenta de Shortn.",
    action: "Verificar correo",
    expiry: "El enlace es válido durante una hora.",
  },
  verified: {
    subject: "Tu correo está verificado",
    heading: "Tu correo está verificado",
    body: "Tu cuenta de Shortn está lista. Pega una URL larga en la página Enlaces para crear tu primer enlace corto.",
    action: "Abrir Shortn",
  },
  reset: {
    subject: "Restablece tu contraseña de Shortn",
    heading: "Restablece tu contraseña",
    body: "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de Shortn.",
    action: "Elegir nueva contraseña",
    expiry: "El enlace solo funciona una vez y caduca en una hora.",
  },
  emailChange: {
    subject: "Aprueba el cambio de correo",
    heading: "Aprueba el cambio de correo",
    body: "Has pedido cambiar la dirección de correo de tu cuenta de Shortn. Aprueba primero el cambio desde esta dirección; después te enviaremos un enlace para confirmar la nueva.",
    newEmail: "Nueva dirección",
    action: "Aprobar cambio",
  },
  billing: {
    plans: {
      free: "Gratis",
      basic: "Basic",
      plus: "Plus",
      pro: "Pro",
      enterprise: "Enterprise",
    },
    startedSubject: (plan) => `Tu plan ${plan} de Shortn está activo`,
    startedHeading: (plan) => `Tu plan ${plan} está activo`,
    startedBody:
      "Gracias por suscribirte. Los nuevos límites y funciones ya están disponibles.",
    changedSubject: (plan) => `Tu plan ahora es ${plan}`,
    changedBody: "El cambio ya está en vigor, con los límites del nuevo plan.",
    scheduledSubject: "El cambio de plan está programado",
    scheduledBody: "No cambia nada hasta la fecha indicada abajo.",
    canceledSubject: "Tu suscripción terminará",
    canceledBody:
      "No se renovará. Cuando termine, tus enlaces seguirán funcionando en el plan Gratis.",
    paymentFailedSubject: "No hemos podido cobrar tu pago",
    paymentFailedBody:
      "El último pago no se ha completado. Todo sigue funcionando durante 7 días mientras actualizas tu método de pago.",
    workspace: "Espacio de trabajo",
    plan: "Plan",
    newPlan: "Nuevo plan",
    startsOn: "Empieza el",
    endsOn: "Termina el",
    afterwards: "Después",
    status: "Estado",
    paymentFailed: "Pago fallido",
    gracePeriod: "Periodo de gracia",
    gracePeriodValue: "7 días",
    action: "Abrir facturación",
    paymentAction: "Actualizar método de pago",
  },
  invite: {
    subject: (workspace) => `Te han invitado a ${workspace} en Shortn`,
    heading: (workspace) => `Únete a ${workspace} en Shortn`,
    body: (inviter, role) => `${inviter} te ha invitado a unirte como ${role}.`,
    roles: { admin: "administrador", member: "miembro", viewer: "lector" },
    roleDescriptions: {
      admin:
        "Los administradores gestionan miembros, dominios y la configuración del espacio de trabajo, y pueden hacer todo lo que hacen los miembros.",
      member:
        "Los miembros crean y editan enlaces, códigos QR, páginas bio y campañas.",
      viewer:
        "Los lectores ven enlaces y estadísticas, pero no pueden cambiar nada.",
    },
    action: "Aceptar invitación",
    expiry: "La invitación solo se puede usar una vez y caduca en 7 días.",
  },
  contact: {
    subject: (reference) => `Hemos recibido tu mensaje (${reference})`,
    heading: "Hemos recibido tu mensaje",
    body: "Te responderemos a esta dirección. Si vuelves a escribirnos sobre la misma consulta, incluye la referencia de abajo.",
    reference: "Referencia",
    yourMessage: "Tu mensaje",
  },
  domain: {
    subject: "Tu dominio personalizado está listo",
    heading: "Tu dominio está listo",
    body: "Está verificado y ya funciona con HTTPS. Puedes usarlo en tus nuevos enlaces cortos desde ahora.",
    domain: "Dominio",
    dns: "DNS",
    verified: "Verificado",
    https: "HTTPS",
    certificateActive: "Certificado activo",
    action: "Gestionar dominios",
  },
  webhook: {
    subject: "Tu webhook se ha desactivado",
    heading: "Tu webhook se ha desactivado",
    body: "Las entregas han fallado durante 3 días, así que hemos dejado de enviar eventos.",
    next: "Corrige el servidor que recibe los eventos y vuelve a activar el webhook mediante la API.",
    webhook: "Webhook",
    endpoint: "Endpoint",
    reason: "Motivo",
    reasonValue: "Falla desde hace 3 días",
    action: "Abrir configuración",
  },
  workspaceExport: {
    subject: "La exportación de tu espacio de trabajo está lista",
    heading: "Tu exportación está lista",
    body: "Inicia sesión para descargar el archivo.",
    workspace: "Espacio de trabajo",
    expires: "Caduca",
    expiresValue: "24 horas después de la solicitud",
    action: "Abrir exportación",
  },
  announcement: {
    subject: "El nuevo Shortn ya está aquí",
    preview: "Tus enlaces y códigos QR siguen funcionando. Esto es lo nuevo.",
    heading: "El nuevo Shortn ya está aquí",
    intro: (name) =>
      `${name ? `${name}, hemos reconstruido` : "Hemos reconstruido"} Shortn desde cero. La misma cuenta, los mismos enlaces y un sitio mejor para gestionarlos.`,
    changes: [
      {
        title: "Un nuevo panel en app.shortn.at",
        body: "Inicia sesión con tu cuenta de siempre.",
      },
      {
        title: "Páginas bio con dirección propia",
        body: "Tu página ahora está en tu\u2011nombre.shortn.at. Los enlaces antiguos shortn.at/b/ redirigen allí.",
      },
      {
        title: "API, webhooks y servidor MCP",
        body: "Conecta Shortn con tus propios sistemas y con asistentes de IA.",
      },
    ],
    action: "Abrir el nuevo panel",
    note: "No se rompe nada. Todos los enlaces cortos, códigos QR y páginas bio que has compartido siguen funcionando, y no tienes que hacer nada.",
  },
};

export const messages: Record<Locale, Messages> = { en, pt, es };

/** The contact inbox is read by the team, so this copy is English only. */
export const operatorMessages = {
  subject: (topic: string, reference: string) =>
    `[Contact · ${topic}] ${reference}`,
  heading: (name: string) => `New message from ${name}`,
  from: "From",
  email: "Email",
  company: "Company",
  topic: "Topic",
  language: "Language",
  reference: "Reference",
  message: "Message",
  reply: (name: string) => `Reply to this email to answer ${name} directly.`,
  footer: "Sent by the contact form on shortn.at.",
  languages: {
    en: "English",
    pt: "Portuguese",
    es: "Spanish",
  } satisfies Record<Locale, string>,
};

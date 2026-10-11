export const locales = ["en", "pt", "es"] as const;
export type Locale = (typeof locales)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

interface Messages {
  footer: string;
  fallback: string;
  ignore: string;
  verify: {
    subject: string;
    changeSubject: string;
    heading: (name: string) => string;
    changeHeading: string;
    body: string;
    changeBody: string;
    action: string;
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
    body: (newEmail: string) => string;
    action: string;
  };
  billing: {
    plans: Record<"free" | "basic" | "plus" | "pro" | "enterprise", string>;
    startedSubject: (plan: string) => string;
    startedHeading: (plan: string) => string;
    startedBody: (workspace: string) => string;
    changedSubject: (plan: string) => string;
    changedBody: (workspace: string, plan: string) => string;
    scheduledSubject: string;
    scheduledBody: (workspace: string, plan: string, date: string) => string;
    canceledSubject: string;
    canceledBody: (workspace: string, date: string) => string;
    paymentFailedSubject: string;
    paymentFailedBody: (workspace: string) => string;
    action: string;
  };
  invite: {
    subject: (workspace: string) => string;
    heading: (inviter: string, workspace: string) => string;
    body: (role: string) => string;
    action: string;
    expiry: string;
    roles: Record<"admin" | "member" | "viewer", string>;
  };
}

const en: Messages = {
  footer:
    "Shortn · links, QR codes and bio pages. You received this email because of activity on your Shortn account.",
  fallback: "If the button doesn't work, open this link:",
  ignore: "If you didn't ask for this, you can ignore this email.",
  verify: {
    subject: "Verify your email for Shortn",
    changeSubject: "Verify your new email address",
    heading: (name) => `Welcome, ${name}`,
    changeHeading: "Confirm your new email address",
    body: "Confirm your email address to start creating links.",
    changeBody:
      "Confirm this address to finish changing the email on your Shortn account.",
    action: "Verify email",
  },
  verified: {
    subject: "Your email is verified",
    heading: "Your email is verified",
    body: "Your Shortn account is ready. Paste a URL on the links page to create your first short link.",
    action: "Open Shortn",
  },
  reset: {
    subject: "Reset your Shortn password",
    heading: "Reset your password",
    body: "Someone asked to reset the password for your Shortn account.",
    action: "Choose a new password",
    expiry: "The link expires in one hour.",
  },
  emailChange: {
    subject: "Confirm your email change",
    heading: "Confirm your email change",
    body: (newEmail) =>
      `You asked to change your Shortn email to ${newEmail}. Approve the change from this address first.`,
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
    startedHeading: (plan) => `Welcome to ${plan}`,
    startedBody: (workspace) =>
      `${workspace} now has the new plan's limits and features.`,
    changedSubject: (plan) => `Your plan is now ${plan}`,
    changedBody: (workspace, plan) => `${workspace} moved to the ${plan} plan.`,
    scheduledSubject: "Your plan change is scheduled",
    scheduledBody: (workspace, plan, date) =>
      `${workspace} moves to ${plan} on ${date}. Until then nothing changes.`,
    canceledSubject: "Your subscription will end",
    canceledBody: (workspace, date) =>
      `The subscription for ${workspace} ends on ${date}. Your links keep working on the Free plan after that.`,
    paymentFailedSubject: "We couldn't take your payment",
    paymentFailedBody: (workspace) =>
      `The last payment for ${workspace} failed. Everything keeps working for 7 days while you update your payment method.`,
    action: "Open billing",
  },
  invite: {
    subject: (workspace) => `You're invited to ${workspace} on Shortn`,
    heading: (inviter, workspace) => `${inviter} invited you to ${workspace}`,
    body: (role) => `You'll join as ${role}.`,
    action: "Accept invitation",
    expiry: "The invitation expires in 7 days.",
    roles: { admin: "an admin", member: "a member", viewer: "a viewer" },
  },
};

const pt: Messages = {
  footer:
    "Shortn · links, códigos QR e páginas bio. Recebeu este email devido a atividade na sua conta Shortn.",
  fallback: "Se o botão não funcionar, abra este link:",
  ignore: "Se não fez este pedido, pode ignorar este email.",
  verify: {
    subject: "Confirme o seu email no Shortn",
    changeSubject: "Confirme o seu novo endereço de email",
    heading: (name) => `Bem-vindo, ${name}`,
    changeHeading: "Confirme o seu novo endereço de email",
    body: "Confirme o seu endereço de email para começar a criar links.",
    changeBody:
      "Confirme este endereço para concluir a alteração do email da sua conta Shortn.",
    action: "Confirmar email",
  },
  verified: {
    subject: "O seu email está confirmado",
    heading: "O seu email está confirmado",
    body: "A sua conta Shortn está pronta. Cole um URL na página de links para criar o seu primeiro link curto.",
    action: "Abrir o Shortn",
  },
  reset: {
    subject: "Redefinir a sua palavra-passe do Shortn",
    heading: "Redefinir palavra-passe",
    body: "Foi pedido um reinício da palavra-passe da sua conta Shortn.",
    action: "Escolher nova palavra-passe",
    expiry: "O link expira dentro de uma hora.",
  },
  emailChange: {
    subject: "Confirme a alteração de email",
    heading: "Confirme a alteração de email",
    body: (newEmail) =>
      `Pediu para alterar o email do Shortn para ${newEmail}. Aprove primeiro a alteração a partir deste endereço.`,
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
    startedHeading: (plan) => `Bem-vindo ao ${plan}`,
    startedBody: (workspace) =>
      `${workspace} tem agora os limites e funcionalidades do novo plano.`,
    changedSubject: (plan) => `O seu plano é agora ${plan}`,
    changedBody: (workspace, plan) =>
      `${workspace} passou para o plano ${plan}.`,
    scheduledSubject: "A alteração de plano está agendada",
    scheduledBody: (workspace, plan, date) =>
      `${workspace} passa para ${plan} em ${date}. Até lá nada muda.`,
    canceledSubject: "A sua subscrição vai terminar",
    canceledBody: (workspace, date) =>
      `A subscrição de ${workspace} termina em ${date}. Depois disso os seus links continuam a funcionar no plano Grátis.`,
    paymentFailedSubject: "Não foi possível cobrar o pagamento",
    paymentFailedBody: (workspace) =>
      `O último pagamento de ${workspace} falhou. Tudo continua a funcionar durante 7 dias enquanto atualiza o método de pagamento.`,
    action: "Abrir faturação",
  },
  invite: {
    subject: (workspace) => `Foi convidado para ${workspace} no Shortn`,
    heading: (inviter, workspace) => `${inviter} convidou-o para ${workspace}`,
    body: (role) => `Vai entrar como ${role}.`,
    action: "Aceitar convite",
    expiry: "O convite expira dentro de 7 dias.",
    roles: { admin: "administrador", member: "membro", viewer: "leitor" },
  },
};

const es: Messages = {
  footer:
    "Shortn · enlaces, códigos QR y páginas bio. Recibes este email por actividad en tu cuenta de Shortn.",
  fallback: "Si el botón no funciona, abre este enlace:",
  ignore: "Si no lo pediste, puedes ignorar este email.",
  verify: {
    subject: "Verifica tu email en Shortn",
    changeSubject: "Verifica tu nueva dirección de email",
    heading: (name) => `Bienvenido, ${name}`,
    changeHeading: "Confirma tu nueva dirección de email",
    body: "Confirma tu dirección de email para empezar a crear enlaces.",
    changeBody:
      "Confirma esta dirección para terminar de cambiar el email de tu cuenta de Shortn.",
    action: "Verificar email",
  },
  verified: {
    subject: "Tu email está verificado",
    heading: "Tu email está verificado",
    body: "Tu cuenta de Shortn está lista. Pega una URL en la página de enlaces para crear tu primer enlace corto.",
    action: "Abrir Shortn",
  },
  reset: {
    subject: "Restablece tu contraseña de Shortn",
    heading: "Restablecer contraseña",
    body: "Alguien pidió restablecer la contraseña de tu cuenta de Shortn.",
    action: "Elegir nueva contraseña",
    expiry: "El enlace caduca en una hora.",
  },
  emailChange: {
    subject: "Confirma el cambio de email",
    heading: "Confirma el cambio de email",
    body: (newEmail) =>
      `Pediste cambiar tu email de Shortn a ${newEmail}. Aprueba primero el cambio desde esta dirección.`,
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
    startedHeading: (plan) => `Bienvenido a ${plan}`,
    startedBody: (workspace) =>
      `${workspace} ya tiene los límites y funciones del nuevo plan.`,
    changedSubject: (plan) => `Tu plan ahora es ${plan}`,
    changedBody: (workspace, plan) => `${workspace} pasó al plan ${plan}.`,
    scheduledSubject: "El cambio de plan está programado",
    scheduledBody: (workspace, plan, date) =>
      `${workspace} pasa a ${plan} el ${date}. Hasta entonces no cambia nada.`,
    canceledSubject: "Tu suscripción terminará",
    canceledBody: (workspace, date) =>
      `La suscripción de ${workspace} termina el ${date}. Después, tus enlaces siguen funcionando en el plan Gratis.`,
    paymentFailedSubject: "No pudimos cobrar tu pago",
    paymentFailedBody: (workspace) =>
      `El último pago de ${workspace} falló. Todo sigue funcionando durante 7 días mientras actualizas tu método de pago.`,
    action: "Abrir facturación",
  },
  invite: {
    subject: (workspace) => `Te invitaron a ${workspace} en Shortn`,
    heading: (inviter, workspace) => `${inviter} te invitó a ${workspace}`,
    body: (role) => `Entrarás como ${role}.`,
    action: "Aceptar invitación",
    expiry: "La invitación caduca en 7 días.",
    roles: { admin: "administrador", member: "miembro", viewer: "lector" },
  },
};

export const messages: Record<Locale, Messages> = { en, pt, es };

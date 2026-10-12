# packages/emails/index.tsx

- MailerConfig · interface · L22-L28 — interface MailerConfig
- recipientAllowed · function · L30-L40 — function recipientAllowed(allowlist: string | undefined, to: string)
- createMailer · function · L42-L151 — function createMailer(config: MailerConfig)
- send · function · L44-L67 — async function send( to: string, subject: string, element: ReactElement, idempotencyKey?: string, )
- domainReady · method · L69-L82 — domainReady(input: { to: string; locale: Locale; hostname: string; url: string; idempotencyKey: string; })
- verifyEmail · method · L83-L96 — verifyEmail(input: { to: string; locale: Locale; name: string; url: string; reason: "signup" | "change"; })
- emailVerified · method · L97-L103 — emailVerified(input: { to: string; locale: Locale; url: string })
- resetPassword · method · L104-L110 — resetPassword(input: { to: string; locale: Locale; url: string })
- confirmEmailChange · method · L111-L122 — confirmEmailChange(input: { to: string; locale: Locale; newEmail: string; url: string; })
- billing · method · L123-L135 — billing(input: { to: string; locale: Locale; workspace: string; notice: BillingNotice; url: string; })
- workspaceInvite · method · L136-L149 — workspaceInvite(input: { to: string; locale: Locale; inviter: string; workspace: string; role: "admin" | "member" | "viewer"; url: string; })
- Mailer · type · L153-L153 — type Mailer = ReturnType<typeof createMailer>;

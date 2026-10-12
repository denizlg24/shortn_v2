# packages/emails/templates/account.tsx

- Base · interface · L11-L13 — interface Base
- VerifyEmail · function · L15-L38 — function VerifyEmail({ locale, name, url, reason, }: Base & { name: string; url: string; reason: "signup" | "change" })
- EmailVerified · function · L40-L49 — function EmailVerified({ locale, url }: Base & { url: string })
- ResetPassword · function · L51-L63 — function ResetPassword({ locale, url }: Base & { url: string })
- ConfirmEmailChange · function · L65-L84 — function ConfirmEmailChange({ locale, newEmail, url, }: Base & { newEmail: string; url: string })
- WorkspaceInvite · function · L86-L109 — function WorkspaceInvite({ locale, inviter, workspace, role, url, }: Base & { inviter: string; workspace: string; role: "admin" | "member" | "viewer"; url: string; })

"use client";

import { Connections, type LinkedAccount } from "./connections";
import { EmailForm } from "./email-form";
import { PasswordSection } from "./password-form";
import { ProfileForm } from "./profile-form";
import { Sessions, type SessionRow } from "./sessions";

export interface AccountUser {
  name: string;
  username: string;
  image: string;
  email: string;
  emailVerified: boolean;
}

export function AccountPanel({
  user,
  accounts,
  providers,
  sessions,
  returnPath,
  linkError,
}: {
  user: AccountUser;
  accounts: LinkedAccount[];
  providers: { github: boolean; google: boolean };
  sessions: SessionRow[];
  /** Where OAuth linking returns, with `?error=` when it fails. */
  returnPath: string;
  linkError: string | null;
}) {
  const hasPassword = accounts.some(
    (account) => account.providerId === "credential",
  );
  return (
    <>
      <ProfileForm user={user} />
      <EmailForm email={user.email} verified={user.emailVerified} />
      <PasswordSection
        hasPassword={hasPassword}
        email={user.email}
        providers={accounts
          .map((account) => account.providerId)
          .filter((id) => id !== "credential")}
      />
      <Connections
        accounts={accounts}
        providers={providers}
        returnPath={returnPath}
        linkError={linkError}
      />
      <Sessions sessions={sessions} />
    </>
  );
}

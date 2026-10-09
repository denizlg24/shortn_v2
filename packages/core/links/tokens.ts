import { jwtVerify } from "jose";

export interface TokenSecrets {
  // Legacy AUTH_SECRET signs confirmation tokens and password cookies until
  // the new web app owns /authenticate (02 M9).
  legacy: Uint8Array;
  linkAccess?: Uint8Array | undefined;
  confirmation?: Uint8Array | undefined;
}

export const encodeSecret = (secret: string) =>
  new TextEncoder().encode(secret);

async function verifyWithAny(token: string, secrets: Uint8Array[]) {
  for (const secret of secrets) {
    try {
      return (await jwtVerify(token, secret)).payload;
    } catch {
      /* Try the next accepted secret. */
    }
  }
  return undefined;
}

export async function verifyConfirmationToken(
  token: string,
  key: string,
  secrets: TokenSecrets,
): Promise<boolean> {
  const payload = await verifyWithAny(
    token,
    [secrets.confirmation, secrets.legacy].filter(
      (secret): secret is Uint8Array => Boolean(secret),
    ),
  );
  return payload?.purpose === "link-confirmation" && payload.slug === key;
}

export async function verifyLinkAccessCookie(
  cookie: string,
  key: string,
  secrets: TokenSecrets,
): Promise<boolean> {
  const payload = await verifyWithAny(
    cookie,
    [secrets.linkAccess, secrets.legacy].filter(
      (secret): secret is Uint8Array => Boolean(secret),
    ),
  );
  return payload?.urlCode === key;
}

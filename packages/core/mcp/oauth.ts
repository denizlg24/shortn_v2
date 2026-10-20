import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import {
  collection,
  findAccountSuspension,
  physicalNames,
  ssoSessionActive,
} from "@shortn/db";
import { apiScopes } from "../api-keys/scopes";
import type { ApiPrincipal } from "../api-keys/service";
import { fail, ok } from "../result";

const oid = z.string().regex(/^[a-f0-9]{24}$/i);
const claimsSchema = z.object({
  sub: oid,
  sid: oid,
  azp: z.string().min(1).max(200),
  scope: z.string().min(1).max(2000),
  "https://shortn.at/workspace": oid,
});
export interface OAuthPrincipal extends ApiPrincipal {
  oauthClientId: string;
  consentId: string;
}
export function createMcpOAuthVerifier(
  db: Db,
  issuer: string,
  resource: string,
) {
  const jwks = createRemoteJWKSet(new URL(`${issuer.replace(/\/$/, "")}/jwks`));
  return (bearer: string) =>
    authenticateMcpOAuth(db, bearer, { issuer, resource, jwks });
}

/** Signature and audience are necessary; live grant/tenant state is authoritative. */
export async function authenticateMcpOAuth(
  db: Db,
  bearer: string,
  config: { issuer: string; resource: string; jwks: JWTVerifyGetKey },
  now = new Date(),
) {
  let claims: z.infer<typeof claimsSchema>;
  try {
    if (bearer.length > 16384) return fail("unauthorized");
    const verified = await jwtVerify(bearer, config.jwks, {
      issuer: config.issuer,
      audience: config.resource,
      algorithms: ["EdDSA", "ES256", "RS256"],
      currentDate: now,
      requiredClaims: ["iss", "aud", "exp", "iat", "sub"],
    });
    // This provider issues access tokens for one MCP resource. Do not accept
    // a multi-resource or generic auth-session token as equivalent authority.
    if (verified.payload.aud !== config.resource) return fail("unauthorized");
    claims = claimsSchema.parse(verified.payload);
  } catch {
    return fail("unauthorized");
  }
  const scopes = [...new Set(claims.scope.split(" ").filter(Boolean))];
  if (
    !scopes.length ||
    scopes.some(
      (scope) =>
        scope !== "offline_access" &&
        !apiScopes.some((known) => known === scope),
    )
  )
    return fail("unauthorized");
  const userId = claims.sub,
    workspaceId = new ObjectId(claims["https://shortn.at/workspace"]);
  const userIds = [userId, new ObjectId(userId)];
  const [client, consent, session, member, workspace, resource, suspension] =
    await Promise.all([
      db
        .collection(physicalNames.oauth_clients)
        .findOne({ clientId: claims.azp }),
      db.collection(physicalNames.oauth_consents).findOne({
        clientId: claims.azp,
        userId: { $in: userIds },
        referenceId: workspaceId.toHexString(),
        scopes: { $all: scopes },
      }),
      db.collection(physicalNames.session).findOne({
        _id: new ObjectId(claims.sid),
        userId: { $in: userIds },
        expiresAt: { $gt: now },
      }),
      collection(db, "workspace_members").findOne({ workspaceId, userId }),
      collection(db, "workspaces").findOne({ _id: workspaceId }),
      db
        .collection(physicalNames.oauth_resources)
        .findOne({ identifier: config.resource, disabled: { $ne: true } }),
      findAccountSuspension(db, userId, now),
    ]);
  if (
    suspension ||
    !client ||
    client.disabled ||
    !consent ||
    !session ||
    !member ||
    !workspace ||
    !resource
  )
    return fail("unauthorized");
  const resourceLink = await db
    .collection(physicalNames.oauth_client_resources)
    .findOne({
      clientId: claims.azp,
      resourceId: config.resource,
    });
  if (!resourceLink) return fail("unauthorized");
  if (
    !(await ssoSessionActive(
      db,
      {
        ssoProviderId: session.ssoProviderId,
        ssoWorkspaceId: session.ssoWorkspaceId,
      },
      userId,
    ))
  )
    return fail("unauthorized");
  // A session racing with credential removal must not retain MCP authority.
  if (session.passkeyId != null) {
    if (
      typeof session.passkeyId !== "string" ||
      !oid.safeParse(session.passkeyId).success ||
      !(await db
        .collection(physicalNames.passkeys)
        .findOne(
          { _id: new ObjectId(session.passkeyId), userId: { $in: userIds } },
          { projection: { _id: 1 } },
        ))
    )
      return fail("unauthorized");
  }
  // Rate identity survives refresh/token rotation and cannot be chosen by an
  // unverified initialize.clientInfo or request header.
  const keyId = `oauth:${createHash("sha256").update(`${claims.azp}:${workspaceId.toHexString()}:${userId}`).digest("hex")}`;
  return ok({
    keyId,
    scopes: scopes.filter((scope) => scope !== "offline_access"),
    actor: { userId, role: member.role },
    workspace,
    oauthClientId: claims.azp,
    consentId: String(consent._id),
  } satisfies OAuthPrincipal);
}

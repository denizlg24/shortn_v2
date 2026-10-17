/** Loopback-only signed IdP and DNS fixture. No external accounts or writes. */
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createSocket } from "node:dgram";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { IdentityProvider, ServiceProvider } from "samlify";

const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
export async function startSsoTestProvider({
  email,
  appOrigin,
  port = 3207,
  dnsPort = 53207,
  tls = false,
}: {
  email: string;
  appOrigin: string;
  port?: number;
  dnsPort?: number;
  tls?: boolean;
}) {
  if (
    !["localhost", "127.0.0.1"].includes(new URL(appOrigin).hostname) ||
    !email.endsWith("@example.test")
  )
    throw Error("Synthetic loopback fixture required");
  let currentEmail = email;
  const directory = await mkdtemp(join(tmpdir(), "shortn-browser-sso-")),
    origin = `${tls ? "https://127.0.0.1" : "http://localhost"}:${port}`,
    issuer = origin + "/oidc";
  const generated = Bun.spawn(
    [
      "openssl",
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-sha256",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=example.test",
      "-keyout",
      join(directory, "key.pem"),
      "-out",
      join(directory, "cert.pem"),
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  if ((await generated.exited) !== 0)
    throw Error(await new Response(generated.stderr).text());
  const [privateKey, signingCert] = await Promise.all([
    readFile(join(directory, "key.pem"), "utf8"),
    readFile(join(directory, "cert.pem"), "utf8"),
  ]);
  const samlIdp = IdentityProvider({
    entityID: origin + "/saml/idp",
    privateKey,
    signingCert,
    singleSignOnService: [
      {
        Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
        Location: origin + "/saml/sso",
      },
    ],
    singleLogoutService: [
      {
        Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
        Location: origin + "/saml/logout",
      },
    ],
  });
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 }),
    jwk = {
      ...keys.publicKey.export({ format: "jwk" }),
      kid: "p6-sso-idp",
      alg: "RS256",
      use: "sig",
    };
  const codes = new Map<
      string,
      {
        verifier: string;
        clientId: string;
        redirect: string;
        nonce: string | null;
        email: string;
      }
    >(),
    proofs = new Map<string, string>();
  const dns = createSocket("udp4");
  dns.on("message", (query, remote) => {
    if (query.length < 17) return;
    let end = 12;
    const labels: string[] = [];
    while (query[end] && end < query.length) {
      const length = query[end]!;
      labels.push(query.subarray(end + 1, end + 1 + length).toString("ascii"));
      end += length + 1;
    }
    end += 5;
    if (end > query.length) return;
    const proof = proofs.get(labels.join(".").toLowerCase()),
      header = Buffer.from(query.subarray(0, 12));
    header.writeUInt16BE(proof ? 0x8180 : 0x8183, 2);
    header.writeUInt16BE(proof ? 1 : 0, 6);
    const pieces = [header, query.subarray(12, end)];
    if (proof) {
      const text = Buffer.from(proof),
        answer = Buffer.alloc(13);
      answer.writeUInt16BE(0xc00c);
      answer.writeUInt16BE(16, 2);
      answer.writeUInt16BE(1, 4);
      answer.writeUInt32BE(0, 6);
      answer.writeUInt16BE(text.length + 1, 10);
      answer[12] = text.length;
      pieces.push(answer, text);
    }
    dns.send(Buffer.concat(pieces), remote.port, remote.address);
  });
  await new Promise<void>((resolve, reject) => {
    dns.once("error", reject);
    dns.bind(dnsPort, "127.0.0.1", resolve);
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    ...(tls ? { tls: { key: privateKey, cert: signingCert } } : {}),
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/oidc/.well-known/openid-configuration")
        return Response.json({
          issuer,
          authorization_endpoint: issuer + "/authorize",
          token_endpoint: issuer + "/token",
          jwks_uri: issuer + "/jwks",
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          token_endpoint_auth_methods_supported: ["client_secret_post"],
        });
      if (url.pathname === "/oidc/jwks") return Response.json({ keys: [jwk] });
      if (url.pathname === "/oidc/authorize") {
        const redirect = url.searchParams.get("redirect_uri");
        if (!redirect || new URL(redirect).origin !== appOrigin)
          return new Response("Unapproved synthetic callback", { status: 400 });
        const code = randomUUID();
        codes.set(code, {
          verifier: url.searchParams.get("code_challenge") ?? "",
          clientId: url.searchParams.get("client_id") ?? "",
          redirect,
          nonce: url.searchParams.get("nonce"),
          email: currentEmail,
        });
        const callback = new URL(redirect);
        callback.searchParams.set("code", code);
        callback.searchParams.set("state", url.searchParams.get("state") ?? "");
        return Response.redirect(callback.href, 302);
      }
      if (url.pathname === "/oidc/token") {
        const form = new URLSearchParams(await request.text()),
          code = form.get("code") ?? "",
          grant = codes.get(code);
        codes.delete(code);
        if (
          !grant ||
          form.get("client_secret") !== "synthetic-oidc-secret" ||
          form.get("client_id") !== grant.clientId ||
          form.get("redirect_uri") !== grant.redirect ||
          createHash("sha256")
            .update(form.get("code_verifier") ?? "")
            .digest("base64url") !== grant.verifier
        )
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        const header = Buffer.from(
            JSON.stringify({ alg: "RS256", kid: jwk.kid }),
          ).toString("base64url"),
          now = Math.floor(Date.now() / 1000);
        const payload = Buffer.from(
          JSON.stringify({
            iss: issuer,
            aud: grant.clientId,
            sub: `p6-oidc-${createHash("sha256").update(grant.email).digest("hex")}`,
            email: grant.email,
            email_verified: true,
            name: "Synthetic workplace identity",
            iat: now,
            exp: now + 300,
            ...(grant.nonce ? { nonce: grant.nonce } : {}),
          }),
        ).toString("base64url");
        const signature = sign(
          "RSA-SHA256",
          Buffer.from(`${header}.${payload}`),
          keys.privateKey,
        ).toString("base64url");
        return Response.json({
          access_token: "synthetic-provider-access",
          token_type: "Bearer",
          expires_in: 300,
          id_token: `${header}.${payload}.${signature}`,
        });
      }
      if (url.pathname === "/saml/metadata")
        return new Response(samlIdp.getMetadata(), {
          headers: { "content-type": "application/samlmetadata+xml" },
        });
      if (url.pathname === "/saml/sso") {
        const xml = inflateRawSync(
          Buffer.from(url.searchParams.get("SAMLRequest") ?? "", "base64"),
        ).toString("utf8");
        const requestId = /\bID="([^"]+)"/.exec(xml)?.[1],
          entityID = /<(?:\w+:)?Issuer\b[^>]*>([^<]+)</.exec(xml)?.[1],
          acs = /\bAssertionConsumerServiceURL="([^"]+)"/.exec(xml)?.[1];
        if (
          !requestId ||
          !entityID ||
          !acs ||
          new URL(acs).origin !== appOrigin
        )
          return new Response("Unapproved synthetic SAML request", {
            status: 400,
          });
        const sp = ServiceProvider({
          entityID,
          wantAssertionsSigned: true,
          assertionConsumerService: [
            {
              Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
              Location: acs,
            },
          ],
        });
        const signed = await samlIdp.createLoginResponse(
          sp,
          { extract: { request: { id: requestId } } },
          "post",
          { email: currentEmail },
        );
        return new Response(
          `<!doctype html><html><body><form method="post" action="${escape(acs)}"><input type="hidden" name="SAMLResponse" value="${escape(signed.context)}"><input type="hidden" name="RelayState" value="${escape(url.searchParams.get("RelayState") ?? "")}"><button type="submit">Continue with synthetic identity</button></form><script>document.forms[0].submit()</script></body></html>`,
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }
      return new Response("Synthetic SSO provider", { status: 404 });
    },
  });
  return {
    origin,
    issuer,
    tlsCertificate: signingCert,
    tlsPrivateKey: privateKey,
    setEmail(value: string) {
      if (!value.endsWith("@example.test"))
        throw Error("Synthetic identity required");
      currentEmail = value;
    },
    samlMetadata: samlIdp.getMetadata(),
    setProof(host: string, value: string) {
      if (!host.startsWith("_shortn-sso-") || !host.endsWith(".example.test"))
        throw Error("Synthetic TXT proof required");
      proofs.set(host.toLowerCase(), value);
    },
    async stop() {
      server.stop(true);
      dns.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

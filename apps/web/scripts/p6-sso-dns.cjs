// P6 browser-fixture transport only. Production never loads this file.
/* eslint-disable @typescript-eslint/no-require-imports -- Node preload must run synchronously before ESM imports. */
/* global process, require */
// Resolve only synthetic Shortn SSO TXT proofs through the local fixture;
// all other DNS calls keep the host's normal resolver.
if (process.env.SHORTN_P6_SSO_DNS === "1") {
  const dns = require("node:dns/promises");
  const resolver = new dns.Resolver();
  resolver.setServers(["127.0.0.1:53207"]);
  const resolveTxt = dns.resolveTxt;
  dns.resolveTxt = (hostname, ...args) =>
    typeof hostname === "string" &&
    hostname.startsWith("_shortn-sso-") &&
    hostname.endsWith(".example.test")
      ? resolver.resolveTxt(hostname, ...args)
      : resolveTxt(hostname, ...args);
  require("node:module").syncBuiltinESMExports();
}

import process from "node:process";
import { URL } from "node:url";
const { Request } = globalThis;

// Loaded only by the isolated browser-check Next process, before the SDK.
// Redirect provider calls to the local receiver; never contact real billing.
const receiver = process.env.SHORTN_TEST_POLAR_RECEIVER;
if (
  !receiver ||
  !["127.0.0.1", "localhost"].includes(new URL(receiver).hostname)
)
  throw new Error("Browser billing checks require a local receiver");
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (["api.polar.sh", "sandbox-api.polar.sh"].includes(url.hostname)) {
    const request = new Request(input, init);
    return originalFetch(
      new Request(new URL(url.pathname + url.search, receiver), request),
    );
  }
  return originalFetch(input, init);
};

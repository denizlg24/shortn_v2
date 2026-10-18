# API client IP restrictions behind a proxy

Direct API deployments leave `API_EDGE_AUTH_SECRET` unset and authenticate IP restrictions against the socket peer.

For reverse proxies, configure a distinct shared `API_EDGE_AUTH_SECRET` on the API and its trusted edge Worker. Route the API hostname through that Worker and set `API_PUBLIC_HOST` to the exact hostname. The Worker overwrites `x-shortn-api-auth` and `x-shortn-client-ip` using its secret and Cloudflare's incoming `CF-Connecting-IP`. The API accepts that address only after constant-time proof verification and IP validation. Restricted keys fail closed when proof is absent or invalid; unrestricted keys remain usable. Apply the setting to both REST and MCP.

The staging route is configured in `apps/edge/wrangler.toml`; production routing is unchanged. Deploy the edge with `wrangler deploy --env staging`. Store the secret with `wrangler secret put API_EDGE_AUTH_SECRET --env staging`, and set the same secret on the staging API target. Do not print or commit its value.

After deployment, test an actual caller-IP key, a denied-address key, forged forwarded headers, and a restricted key sent directly to the API origin. Removing the edge secret makes the configured API edge route return 503. Roll back both route and API configuration together; do not trust forwarded IP headers without proof.

Cloudflare documents the [incoming client IP header](https://developers.cloudflare.com/fundamentals/reference/http-headers/) and [origin routing](https://developers.cloudflare.com/workers/configuration/routing/routes/).

# MCP setup and implementation status

Shortn has a locally verified MCP endpoint at `/mcp`, using the official
TypeScript SDK's Streamable HTTP transport with JSON responses. Deployment is
disabled by default. API-key access and workspace OAuth consent are implemented
and verified locally. Manual supported-client and staging acceptance remain
open. These examples apply to an explicitly enabled deployment.

## Authentication and rollout

Use a scoped workspace API key as `Authorization: Bearer sk_live_…`. Session
cookies are not accepted. Current membership, role, expiry, IP restrictions and
revocation are checked on every request. MCP and REST share the same per-key
rate budget and `RateLimit-*` headers. Core services enforce resource permissions.

Operators enable `PLATFORM_MCP_ENABLED=1` and configure `MCP_PUBLIC_ORIGIN`,
`API_KEY_PEPPER`, and both Redis URLs. Production requires HTTPS and separate
cache/durable Redis instances. `PLATFORM_MCP_ROLLOUT` starts at zero; the
workspace's `platformFeatures.mcp` override takes precedence. MCP's gate is
independent of REST. The request Host must match the configured public host;
cross-origin browser requests are not enabled by this API-key implementation.

## Workspace OAuth

Enable `MCP_OAUTH_ENABLED=1` on both web and API, with the same
`MCP_PUBLIC_ORIGIN`. On the API, set `MCP_OAUTH_ISSUER` to the web auth issuer,
for example `https://app.shortn.at/api/auth`, and enable the MCP mount as above.
Production requires HTTPS. Keep the web and API workspace rollout configuration
consistent. OAuth remains disabled unless explicitly configured.

The API publishes `/.well-known/oauth-protected-resource/mcp` and includes its
address in the unauthenticated `WWW-Authenticate` challenge. The web publishes
`/.well-known/oauth-authorization-server/api/auth`. Clients discover the
provider and register a public client, then request an authorization code for
the exact MCP resource (`https://api.shortn.at/mcp`) with PKCE S256. The browser
asks the user to sign in, select an eligible workspace and review permissions.
Email and username sign-in both resume the connection. Cancel creates no grant.

A grant is limited by the user's current workspace role and requested scopes.
Access tokens expire after ten minutes; refresh requires `offline_access`.
Client, consent, membership and the originating login session are checked live;
signing out of that session ends access. Workspace selection changes between
review and approval are rejected. OAuth mutation audit actors identify the
verified client. Refresh preserves the rate-limit identity.

Registered callbacks must match exactly. HTTPS, loopback HTTP and supported
native/private-use callback schemes are accepted; callbacks with credentials
or fragments are rejected. Native client launch and Claude Desktop acceptance
have not yet been verified. The local browser fixture verifies discovery,
consent, PKCE exchange and an authenticated MCP call against a synthetic app.

## Tools and scopes

| Tool              | Required scopes                                                                  | Behavior                                                                |
| ----------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `create_link`     | `links:write`                                                                    | URL, optional key/domain/title/tags/UTM/expiry; returns a short URL     |
| `update_link`     | `links:write`                                                                    | Updates fields and rules by ID                                          |
| `archive_link`    | `links:write`                                                                    | Moves authorized links to 30-day trash; annotated destructive           |
| `get_link`        | `links:read`                                                                     | Reads by ID or key; custom domains can be specified                     |
| `search_links`    | `links:read`; `campaigns:read` for a campaign filter                             | Query/tag/campaign filters, up to 200 results and a next cursor         |
| `get_analytics`   | `analytics:read`; `links:read` for a link key or `campaigns:read` for a campaign | One link, tag, campaign or workspace; bounded breakdown and summary     |
| `create_qr_code`  | `qr:write`, `links:read`                                                         | Attaches a QR code; signed export URL or asynchronous export job when enabled         |
| `get_qr_export` | `qr:read` | Reads export progress and the finished expiring private download URL |
| `list_campaigns`  | `campaigns:read`                                                                 | Bounded cursor pages without full campaign link libraries               |
| `create_campaign` | `campaigns:write`                                                                | Creates a campaign                                                      |
| `add_bio_link`    | `bio:write`, `links:write`                                                       | Creates and appends atomically; a full/missing page rolls back creation |
| `get_usage`       | `workspace:read`                                                                 | Current period consumption and plan limits                              |

Wildcard scopes such as `qr:*` and `bio:*` include their read/write scopes.
Scoped viewers cannot mutate resources; members can archive only their own
links. Analytics retain plan and retention limits. Search and campaign listings
use server-side pagination: follow `nextCursor` to browse the full library.
Tool errors have stable codes and `isError: true`.

`create_qr_code` returns a signed `exportUrl` when the enabled worker finishes
within its bounded wait, or an `exportJobId` to poll. The added
`get_qr_export` tool requires `qr:read` and returns the finished private URL.
See [QR exports](/docs/qr-exports.md) for flags, formats, limits and remaining UI
and staging gates. Disabled export configuration reports `exportStatus: "disabled"`.

Mutations record durable intent in `audit_log` before calling core, with actor
`mcp:api-key:{keyId}`, real user ID and tool name, followed by succeeded/failed
status. If intent recording fails, the mutation does not run. If completion
recording fails after success, intent remains for reconciliation and the tool
retains its successful response to avoid encouraging a duplicate mutation.
Audit records omit raw arguments, destination URLs and secrets.

## Resources and prompts

- `shortn://links/{key}`: default-domain link; requires `links:read`.
- `shortn://analytics/summary`: last seven days; requires `analytics:read`.
- `weekly_link_report`: prompt to summarize that resource.
- `create_campaign_links`: prompt taking `title` and `urls` strings.

Prompts describe work; fetching one does not mutate data. Custom-domain links
use `get_link` with `domain` instead of the default-domain resource.

## Client configuration

Replace the origin below with the enabled deployment's origin. Create a key
with the scopes needed for the workflow.

For [Claude Code](https://code.claude.com/docs/en/mcp), set `SHORTN_API_KEY` in
your shell and add the HTTP server:

```sh
claude mcp add --transport http shortn https://api.shortn.at/mcp \
  --header "Authorization: Bearer ${SHORTN_API_KEY}"
```

For [Cursor](https://cursor.com/docs/mcp), use `.cursor/mcp.json` and provide
`SHORTN_API_KEY` in the environment used to start Cursor:

```json
{
  "mcpServers": {
    "shortn": {
      "url": "https://api.shortn.at/mcp",
      "headers": { "Authorization": "Bearer ${env:SHORTN_API_KEY}" }
    }
  }
}
```

For [VS Code](https://code.visualstudio.com/docs/agents/reference/mcp-configuration),
use `.vscode/mcp.json` with a masked input:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "shortnApiKey",
      "description": "Shortn API key",
      "password": true
    }
  ],
  "servers": {
    "shortn": {
      "type": "http",
      "url": "https://api.shortn.at/mcp",
      "headers": { "Authorization": "Bearer ${input:shortnApiKey}" }
    }
  }
}
```

These follow the clients' documented HTTP/header formats. Local verification
uses the SDK client and MCP Inspector; manual client and staging acceptance
remain open. OAuth-capable clients can use the discovery flow above on an
explicitly enabled deployment; native client acceptance is still pending.

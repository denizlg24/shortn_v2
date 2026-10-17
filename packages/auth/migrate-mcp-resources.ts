import { MongoClient } from "mongodb";
import { backfillMcpResourceLinks } from "./mcp-resource-migration";

// Explicit command: defaults to a read-only report; never runs during login.
const args = Bun.argv.slice(2);
if (
  args.length > 1 ||
  (args.length && !["--dry-run", "--apply"].includes(args[0]!))
)
  throw new Error(
    "Usage: bun packages/auth/migrate-mcp-resources.ts [--dry-run|--apply]",
  );
const { MONGODB_URL, MONGODB_DB, MCP_PUBLIC_ORIGIN } = process.env;
if (!MONGODB_URL || !MONGODB_DB || !MCP_PUBLIC_ORIGIN)
  throw new Error(
    "MONGODB_URL, MONGODB_DB, and MCP_PUBLIC_ORIGIN are required",
  );
const resource = new URL("/mcp", MCP_PUBLIC_ORIGIN).href;
const client = await new MongoClient(MONGODB_URL).connect();
try {
  console.log(
    JSON.stringify(
      await backfillMcpResourceLinks(
        client.db(MONGODB_DB),
        resource,
        args[0] === "--apply",
      ),
    ),
  );
} finally {
  await client.close();
}

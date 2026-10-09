export function confirmMongoTarget(
  url: string,
  database: string,
  args: string[],
  log: (message: string) => void = console.log,
) {
  const authority = /^mongodb(?:\+srv)?:\/\/([^/?#]+)/.exec(url)?.[1];
  if (!authority) throw new Error("Expected a MongoDB connection URL");
  const hosts = authority.slice(authority.lastIndexOf("@") + 1).split(",");
  const local = hosts.every((host) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(`http://${host}`).hostname.toLowerCase(),
    ),
  );
  log(
    `MongoDB target hosts=${JSON.stringify(hosts)} database=${JSON.stringify(database)}`,
  );
  if (!local && !args.includes("--yes"))
    throw new Error("Non-loopback MongoDB targets require --yes");
}

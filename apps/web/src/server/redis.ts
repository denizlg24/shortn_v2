import "server-only";
import { createRedisClients } from "@shortn/redis";
import { env } from "./env";

let clients: ReturnType<typeof createRedisClients> | undefined;

export function redis() {
  if (!clients) {
    const e = env();
    clients = createRedisClients(e);
    clients.catch(() => {
      clients = undefined;
    });
  }
  return clients;
}

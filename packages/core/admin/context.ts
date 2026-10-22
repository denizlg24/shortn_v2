import type { AccountStatusCache } from "@shortn/db";
import type { InvalidationStore } from "@shortn/redis";
import type { Db } from "mongodb";
import type { AdminRole } from "./permissions";

/** Everything a staff action needs (23 §3). Built per request by the admin
 * app from its verified session; never from client input. */
export interface AdminContext {
  db: Db;
  cache: InvalidationStore & AccountStatusCache;
  admin: { id: string; email: string; role: AdminRole };
  session: { id: string; elevatedAt?: Date | undefined };
  request: {
    ip?: string | undefined;
    userAgent?: string | undefined;
    requestId?: string | undefined;
  };
  linkDomain: string;
  now: () => Date;
}

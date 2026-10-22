import { findAccountSuspension } from "@shortn/db";
import { APIError } from "better-auth/api";
import type { Db } from "mongodb";

// Legacy shares the user and session collections with the rebuild, so a ban
// must hold here too until P7 (doc 23 §3.1).
export async function refuseSuspendedAccount(db: Db, userId: string) {
  if (!(await findAccountSuspension(db, userId))) return;
  throw new APIError("FORBIDDEN", {
    code: "ACCOUNT_SUSPENDED",
    message: "This account is suspended. Contact support@shortn.at.",
  });
}

import mongoose, { type ClientSession } from "mongoose";
import type { Db } from "mongodb";
import { coordinateLegacyCreation } from "@shortn/core";

export async function withLegacyCreation<T>(
  sub: string,
  metric: "links" | "qrCodes",
  write: (session: ClientSession) => Promise<T>,
) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Legacy database is disconnected");
  // The coordinator issues operations through this driver-owned Db/session.
  // Mongoose's bundled driver and the native workspace driver have distinct types.
  return coordinateLegacyCreation(db as unknown as Db, sub, metric, (session) =>
    write(session as unknown as ClientSession),
  );
}

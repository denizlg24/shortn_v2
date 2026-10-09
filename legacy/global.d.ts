import mongo from "mongoose";
import type { Db, MongoClient } from "mongodb";

declare global {
  var mongoose:
    | {
        conn: typeof mongo | null;
        promise: Promise<typeof mongo> | null;
      }
    | undefined;

  var authMongoCache:
    | {
        client: MongoClient;
        db: Db;
      }
    | undefined;
}

export {};

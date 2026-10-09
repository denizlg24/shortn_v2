import { MongoClient } from "mongodb";
export interface MongoConfig {
  url: string;
  database: string;
  maxPoolSize?: number;
}
let singleton:
  | {
      config: MongoConfig;
      client: MongoClient;
      connecting: Promise<MongoClient>;
    }
  | undefined;
export function getMongoClient(config: MongoConfig): Promise<MongoClient> {
  if (singleton) {
    if (
      singleton.config.url !== config.url ||
      singleton.config.database !== config.database ||
      singleton.config.maxPoolSize !== config.maxPoolSize
    )
      throw new Error("Mongo singleton already configured differently");
    return singleton.connecting;
  }
  const client = new MongoClient(config.url, {
    maxPoolSize: config.maxPoolSize ?? 20,
  });
  const connecting = client.connect().catch((error: Error) => {
    if (singleton?.client === client) singleton = undefined;
    throw error;
  });
  singleton = { config, client, connecting };
  return connecting;
}
export async function getDb(config: MongoConfig) {
  return (await getMongoClient(config)).db(config.database);
}
export async function closeMongoClient() {
  const current = singleton;
  singleton = undefined;
  if (current) await current.client.close();
}

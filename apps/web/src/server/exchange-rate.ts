import "server-only";
import { loadExchangeRate } from "@shortn/billing";
import { cache } from "react";
import { redis } from "./redis";

export const exchangeRate = cache(async () => {
  try {
    const client = (await redis()).cache;
    return await loadExchangeRate({
      cache: {
        get: (key) => client.get(key),
        set: (key, value, seconds, onlyIfMissing) =>
          onlyIfMissing
            ? client.set(key, value, "EX", seconds!, "NX")
            : seconds
              ? client.set(key, value, "EX", seconds)
              : client.set(key, value),
      },
    });
  } catch {
    return null;
  }
});

import type Redis from "ioredis";

/** BullMQ owns blocking-read deadlines; ordinary command timers break idle queues. */
export function blockingQueueRedis(durable: Redis) {
  const connection = durable.duplicate({ maxRetriesPerRequest: null });
  // ioredis treats zero as an immediate timeout. Remove the inherited timer
  // before any asynchronous connection command or BullMQ duplicate is issued.
  delete connection.options.commandTimeout;
  return connection;
}

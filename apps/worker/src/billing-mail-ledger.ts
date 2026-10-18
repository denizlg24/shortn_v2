import { collection } from "@shortn/db";
import { MongoServerError, type Db } from "mongodb";

/**
 * Durable once-only guard for billing mail, shared by every worker, so event
 * retries, Polar redeliveries and replays never send the same mail twice.
 */
export interface MailLedger {
  /** True when this worker may send `key` now. */
  claim(key: string, now: Date): Promise<boolean>;
  sent(key: string, now: Date): Promise<void>;
  /** Gives the key back after a failed send, so the next retry can send. */
  release(key: string): Promise<void>;
}

// Longer than any send takes; a claim left by a crashed worker expires so
// the mail is not lost.
const claimMs = 10 * 60_000;

export function mongoMailLedger(db: Db): MailLedger {
  const mail = collection(db, "billing_mail");
  return {
    async claim(key, now) {
      const claimedUntil = new Date(now.getTime() + claimMs);
      try {
        await mail.insertOne({ _id: key, createdAt: now, claimedUntil });
        return true;
      } catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000))
          throw error;
      }
      const reclaimed = await mail.updateOne(
        { _id: key, sentAt: { $exists: false }, claimedUntil: { $lt: now } },
        { $set: { claimedUntil } },
      );
      return reclaimed.modifiedCount === 1;
    },
    async sent(key, now) {
      await mail.updateOne(
        { _id: key },
        { $set: { sentAt: now }, $unset: { claimedUntil: "" } },
      );
    },
    async release(key) {
      await mail.deleteOne({ _id: key, sentAt: { $exists: false } });
    },
  };
}

/**
 * Sends at most once per key. If recording the send fails after the provider
 * accepted it, the claim expires and the retry reuses the same Resend
 * idempotency key, which Resend deduplicates for 24 hours.
 */
export async function sendOnce(
  ledger: MailLedger,
  key: string,
  now: Date,
  send: () => Promise<void>,
) {
  if (!(await ledger.claim(key, now))) return false;
  try {
    await send();
  } catch (error) {
    await ledger.release(key);
    throw error;
  }
  await ledger.sent(key, now);
  return true;
}

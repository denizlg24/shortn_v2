import { collection } from "@shortn/db";
import type { Db } from "mongodb";

/** Mail staff actions send, drained by the worker with the existing mailer
 * so SMTP credentials never reach the admin app (23 §3). */
export interface PlatformNotificationPayloads {
  accountSuspended: { reason?: string; until?: string };
  workspaceSuspended: {
    workspaceName: string;
    workspaceSlug: string;
    level: "locked" | "suspended";
    category: string;
    publicNote?: string;
  };
  workspaceRestored: { workspaceName: string; workspaceSlug: string };
  linkRemoved: {
    workspaceName: string;
    workspaceSlug: string;
    links: { shortUrl: string; category: string }[];
    publicNote?: string;
  };
  domainSuspended: { hostname: string; workspaceSlug: string; reason?: string };
  compExpiring: { workspaceName: string; plan: string; expiresAt: string };
  accountDeletionScheduled: { purgeAfter: string };
  accountDeleted: Record<string, never>;
}

export type PlatformNotificationKind = keyof PlatformNotificationPayloads;

/**
 * Queues one email. `key` makes it idempotent: a retried action never sends
 * twice (e.g. `workspaceSuspended:<workspaceId>:<at ms>`).
 */
export async function enqueuePlatformNotification<
  K extends PlatformNotificationKind,
>(
  db: Db,
  input: {
    key: string;
    kind: K;
    to: string;
    locale?: string;
    payload: PlatformNotificationPayloads[K];
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  await collection(db, "platform_notifications").updateOne(
    { _id: input.key },
    {
      $setOnInsert: {
        kind: input.kind,
        to: input.to,
        ...(input.locale ? { locale: input.locale } : {}),
        payload: input.payload,
        createdAt: now,
        attempts: 0,
        nextAttemptAt: now,
      },
    },
    { upsert: true },
  );
}

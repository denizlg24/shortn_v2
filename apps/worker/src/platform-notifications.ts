import { collection, physicalNames } from "@shortn/db";
import { isLocale, type Mailer } from "@shortn/emails";
import type { Db } from "mongodb";
const kinds = [
  "accountSuspended",
  "workspaceSuspended",
  "workspaceRestored",
  "linkRemoved",
  "domainSuspended",
  "compExpiring",
  "accountDeletionScheduled",
  "accountDeleted",
] as const;
export async function sendPlatformNotifications(
  db: Db,
  mailer: Pick<Mailer, "platformNotice">,
  now = new Date(),
) {
  const notices = collection(db, "platform_notifications");
  for (let n = 0; n < 20; n++) {
    const lease = crypto.randomUUID();
    const row = await notices.findOneAndUpdate(
      {
        sentAt: { $exists: false },
        attempts: { $lt: 10 },
        nextAttemptAt: { $lte: now },
        $or: [
          { claimedUntil: { $exists: false } },
          { claimedUntil: { $lt: now } },
        ],
      },
      {
        $set: { lease, claimedUntil: new Date(now.getTime() + 60000) },
        $inc: { attempts: 1 },
      },
      { returnDocument: "after", sort: { nextAttemptAt: 1 } },
    );
    if (!row) break;
    try {
      const to = row.to,
        payload = row.payload;
      if (!to || !payload) throw new Error("malformed_notification");
      const kind = kinds.find((k) => k === row.kind);
      if (!kind) throw new Error("unknown_notification_kind");
      const user = await db
        .collection(physicalNames.user)
        .findOne({ email: to }, { projection: { locale: 1 } });
      // Only explicitly public fields enter customer mail; internal notes never do.
      const fields = [
        "workspaceName",
        "hostname",
        "plan",
        "expiresAt",
        "purgeAfter",
        "until",
        "publicNote",
      ];
      const labels: Record<string, string> = {
        workspaceName: "Workspace",
        hostname: "Domain",
        plan: "Plan",
        expiresAt: "Expires",
        purgeAfter: "Deletion date",
        until: "Until",
        publicNote: "Note",
      };
      const details = fields.flatMap((key) =>
        typeof payload[key] === "string"
          ? [{ label: labels[key] ?? key, value: String(payload[key]) }]
          : [],
      );
      if (Array.isArray(payload.links)) {
        details.push({
          label: "Links removed",
          value: String(payload.links.length),
        });
        for (const link of payload.links.slice(0, 20))
          if (link && typeof link === "object" && "shortUrl" in link)
            details.push({ label: "Link", value: String(link.shortUrl) });
      }
      await mailer.platformNotice({
        to,
        locale: isLocale(row.locale)
          ? row.locale
          : isLocale(user?.locale)
            ? user.locale
            : "en",
        kind,
        details,
        idempotencyKey: `platform:${row._id}`,
      });
      await notices.updateOne(
        { _id: row._id, lease },
        {
          $set: { sentAt: now },
          $unset: {
            lease: "",
            claimedUntil: "",
            to: "",
            payload: "",
            error: "",
          },
        },
      );
    } catch (error) {
      await notices.updateOne(
        { _id: row._id, lease },
        {
          $set: {
            error: error instanceof Error ? error.message : "mail_failed",
            nextAttemptAt: new Date(
              now.getTime() + Math.min(86400000, 60000 * 2 ** row.attempts),
            ),
          },
          $unset: { lease: "", claimedUntil: "" },
        },
      );
    }
  }
}

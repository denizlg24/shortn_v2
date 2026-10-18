import { physicalNames } from "@shortn/db";
import { isLocale, type Mailer } from "@shortn/emails";
import { ObjectId, type Db } from "mongodb";

export async function sendWebhookNotifications(
  db: Db,
  mailer: Pick<Mailer, "webhookDisabled">,
  appUrl: string,
  now = new Date(),
) {
  const notices = db.collection(physicalNames.webhook_notifications);
  const due = {
    sentAt: { $exists: false },
    $and: [
      {
        $or: [
          { nextAttemptAt: { $exists: false } },
          { nextAttemptAt: { $lte: now } },
        ],
      },
      {
        $or: [
          { leaseUntil: { $exists: false } },
          { leaseUntil: { $lte: now } },
        ],
      },
    ],
  };
  for (const candidate of await notices
    .find(due)
    .sort({ createdAt: 1, _id: 1 })
    .limit(20)
    .toArray()) {
    const lease = crypto.randomUUID();
    const notice = await notices.findOneAndUpdate(
      { ...due, _id: candidate._id, createdAt: candidate.createdAt },
      { $set: { lease, leaseUntil: new Date(now.getTime() + 60000) } },
      { returnDocument: "after" },
    );
    if (!notice) continue;
    try {
      const workspace = await db
        .collection(physicalNames.workspaces)
        .findOne({ _id: notice.workspaceId });
      const owner =
        workspace && ObjectId.isValid(String(workspace.ownerUserId))
          ? await db
              .collection(physicalNames.user)
              .findOne({ _id: new ObjectId(String(workspace.ownerUserId)) })
          : null;
      if (!owner?.email || !workspace)
        throw new Error("Webhook notification owner unavailable");
      await mailer.webhookDisabled({
        to: String(owner.email),
        locale: isLocale(owner.locale) ? owner.locale : "en",
        name: String(notice.name ?? "Webhook"),
        endpoint: typeof notice.url === "string" ? notice.url : undefined,
        url: `${appUrl.replace(/\/$/, "")}/${encodeURIComponent(String(workspace.slug))}/settings`,
        idempotencyKey: `webhook-disabled-${notice._id}-${notice.generation ?? new Date(notice.createdAt).getTime()}`,
      });
      await notices.updateOne(
        { _id: notice._id, lease },
        {
          $set: { sentAt: now },
          $unset: {
            lease: "",
            leaseUntil: "",
            nextAttemptAt: "",
            lastError: "",
          },
        },
      );
    } catch {
      await notices.updateOne(
        { _id: notice._id, lease },
        {
          $set: {
            lastError: "mail_failed",
            nextAttemptAt: new Date(now.getTime() + 300000),
          },
          $unset: { lease: "", leaseUntil: "" },
        },
      );
    }
  }
}

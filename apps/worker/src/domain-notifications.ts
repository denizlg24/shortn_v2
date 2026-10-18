import { physicalNames } from "@shortn/db";
import { isLocale, type Mailer } from "@shortn/emails";
import { ObjectId, type Db } from "mongodb";
export async function sendDomainNotifications(
  db: Db,
  mailer: Pick<Mailer, "domainReady">,
  appUrl: string,
  now = new Date(),
) {
  const notices = db.collection(physicalNames.domain_notifications);
  for (const notice of await notices
    .find({
      sentAt: { $exists: false },
      $or: [
        { nextAttemptAt: { $exists: false } },
        { nextAttemptAt: { $lte: now } },
      ],
    })
    .limit(20)
    .toArray()) {
    const lease = crypto.randomUUID();
    if (
      !(
        await notices.updateOne(
          {
            _id: notice._id,
            $or: [
              { leaseUntil: { $exists: false } },
              { leaseUntil: { $lt: now } },
            ],
          },
          { $set: { lease, leaseUntil: new Date(now.getTime() + 60000) } },
        )
      ).modifiedCount
    )
      continue;
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
        throw new Error("Domain notification owner unavailable");
      await mailer.domainReady({
        to: String(owner.email),
        locale: isLocale(owner.locale) ? owner.locale : "en",
        hostname: String(notice.hostname),
        url: `${appUrl}/${workspace.slug}/settings/domains`,
        idempotencyKey: `domain-ready-${notice._id}`,
      });
      await notices.updateOne(
        { _id: notice._id, lease },
        { $set: { sentAt: now }, $unset: { lease: "", leaseUntil: "" } },
      );
    } catch (error) {
      await notices.updateOne(
        { _id: notice._id, lease },
        {
          $set: {
            lastError: error instanceof Error ? error.message : "mail_failed",
            nextAttemptAt: new Date(now.getTime() + 300000),
          },
          $unset: { lease: "", leaseUntil: "" },
        },
      );
    }
  }
}

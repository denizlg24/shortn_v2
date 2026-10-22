import "server-only";
import type { Db } from "mongodb";
export async function queueSummary(db: Db, name: string) {
  const now = new Date();
  const day = new Date(now.getTime() - 86400000);
  const week = new Date(now.getTime() - 7 * 86400000);
  return db
    .collection(name)
    .aggregate<{
      _id: string;
      count: number;
      stuck: number;
      oldest: Date | null;
      failed24: number;
      completed24: number;
      failed7: number;
      completed7: number;
    }>(
      [
        {
          $group: {
            _id: {
              $ifNull: [
                "$state",
                {
                  $ifNull: [
                    "$status",
                    {
                      $cond: [
                        "$processedAt",
                        "completed",
                        {
                          $cond: [
                            { $gte: ["$attempts", 10] },
                            "failed",
                            "pending",
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            count: { $sum: 1 },
            stuck: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $in: [
                          { $ifNull: ["$state", "$status"] },
                          ["running", "sending"],
                        ],
                      },
                      { $lt: ["$leaseUntil", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            oldest: { $min: { $ifNull: ["$createdAt", "$receivedAt"] } },
            failed24: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $gte: [{ $ifNull: ["$createdAt", "$receivedAt"] }, day],
                      },
                      {
                        $in: [
                          { $ifNull: ["$state", "$status"] },
                          ["failed", "dead"],
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            completed24: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $gte: [{ $ifNull: ["$createdAt", "$receivedAt"] }, day],
                      },
                      {
                        $in: [
                          { $ifNull: ["$state", "$status"] },
                          ["completed", "delivered"],
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            failed7: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $gte: [
                          { $ifNull: ["$createdAt", "$receivedAt"] },
                          week,
                        ],
                      },
                      {
                        $in: [
                          { $ifNull: ["$state", "$status"] },
                          ["failed", "dead"],
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            completed7: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $gte: [
                          { $ifNull: ["$createdAt", "$receivedAt"] },
                          week,
                        ],
                      },
                      {
                        $in: [
                          { $ifNull: ["$state", "$status"] },
                          ["completed", "delivered"],
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $limit: 30 },
      ],
      { maxTimeMS: 5000 },
    )
    .toArray();
}

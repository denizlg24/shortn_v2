import { getUserPlan } from "@/app/actions/polarActions";
import { auth } from "@/lib/auth";
import { polarClient } from "@/lib/polar";
import { connectDB } from "@/lib/mongodb";
import ScheduledChange from "@/models/subscription/ScheduledChange";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await auth.api.getSession({
      headers: req.headers,
    });

    if (!data?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { id } = await getUserPlan();
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "No active subscription found.",
        },
        { status: 400 },
      );
    }

    await connectDB();

    try {
      const scheduledChange = await ScheduledChange.findOne({
        subscriptionId: id,
        userId: data.user.id,
        status: "pending",
      });

      if (!scheduledChange) {
        return NextResponse.json(
          {
            success: false,
            message: "No pending change found for this subscription.",
          },
          { status: 404 },
        );
      }

      if (
        scheduledChange.changeType === "downgrade" &&
        scheduledChange.qstashMessageId
      ) {
        try {
          const { qstashClient } = await import("@/lib/qstash");

          await qstashClient.messages.delete(scheduledChange.qstashMessageId);
          console.log(
            `Deleted QStash message: ${scheduledChange.qstashMessageId}`,
          );
        } catch (qstashError) {
          console.error("Failed to delete QStash message:", qstashError);
        }
      }

      if (scheduledChange.changeType === "cancellation") {
        await polarClient.subscriptions.update({
          id,
          subscriptionUpdate: {
            cancelAtPeriodEnd: false,
          },
        });
        console.log(`Reactivated subscription ${id}`);
      }

      scheduledChange.status = "reverted";
      await scheduledChange.save();

      console.log(
        `Reverted scheduled ${scheduledChange.changeType} for subscription ${id}`,
      );

      return NextResponse.json({
        success: true,
        message: `Successfully reverted scheduled ${scheduledChange.changeType}`,
        changeType: scheduledChange.changeType,
      });
    } catch (polarError: unknown) {
      console.error("Polar API error:", polarError);

      const errorMessage =
        polarError instanceof Error ? polarError.message : String(polarError);

      return NextResponse.json(
        {
          success: false,
          message:
            "Failed to revert change. Please try again or contact support.",
          error: errorMessage,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred. Please try again.",
      },
      { status: 500 },
    );
  }
}

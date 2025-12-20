import mongoose, { Schema, Document } from "mongoose";

export interface IScheduledChange extends Document {
  userId: string;
  subscriptionId: string;
  changeType: "cancellation" | "downgrade";
  currentPlan: "basic" | "plus" | "pro";
  targetPlan: "free" | "basic" | "plus" | "pro";
  scheduledFor: Date;
  qstashMessageId?: string;
  reason?: string;
  comment?: string;
  status: "pending" | "executed" | "reverted";
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledChangeSchema = new Schema<IScheduledChange>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    subscriptionId: {
      type: String,
      required: true,
      index: true,
    },
    changeType: {
      type: String,
      enum: ["cancellation", "downgrade"],
      required: true,
    },
    currentPlan: {
      type: String,
      enum: ["basic", "plus", "pro"],
      required: true,
    },
    targetPlan: {
      type: String,
      enum: ["free", "basic", "plus", "pro"],
      required: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    qstashMessageId: {
      type: String,
      sparse: true,
    },
    reason: {
      type: String,
    },
    comment: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "executed", "reverted"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

ScheduledChangeSchema.index({ subscriptionId: 1, status: 1 });

ScheduledChangeSchema.index({ status: 1, scheduledFor: 1 });

const ScheduledChange: mongoose.Model<IScheduledChange> =
  mongoose.models.ScheduledChange ||
  mongoose.model<IScheduledChange>("ScheduledChange", ScheduledChangeSchema);

export default ScheduledChange;

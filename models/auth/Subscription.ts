"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDBSubscription extends Document {
  referenceId: string;
  plan: string;
  status: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<IDBSubscription>(
  {
    referenceId: { type: String, required: true, ref: "User" },
    plan: { type: String, required: true },
    status: { type: String, required: true },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String, unique: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "subscription",
    timestamps: true,
  },
);

export const Subscription: Model<IDBSubscription> =
  mongoose.models?.Subscription ||
  mongoose.model<IDBSubscription>("Subscription", subscriptionSchema);

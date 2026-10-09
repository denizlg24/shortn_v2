"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDBVerification extends Document {
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const verificationSchema = new Schema<IDBVerification>(
  {
    identifier: { type: String, required: true },
    value: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  {
    collection: "verification",
    timestamps: true,
  },
);

export const Verification: Model<IDBVerification> =
  mongoose.models?.Verification ||
  mongoose.model<IDBVerification>("Verification", verificationSchema);

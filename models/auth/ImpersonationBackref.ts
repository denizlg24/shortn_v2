"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDBImpersonationBackref extends Document {
  adminId: string;
  adminSessionId: string;
  impersonatedUserId: string;
  impersonatedSessionId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const impersonationBackrefSchema = new Schema<IDBImpersonationBackref>(
  {
    adminId: { type: String, required: true },
    adminSessionId: { type: String, required: true },
    impersonatedUserId: { type: String, required: true },
    impersonatedSessionId: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  {
    collection: "impersonation_backref",
    timestamps: true,
  },
);

impersonationBackrefSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ImpersonationBackref: Model<IDBImpersonationBackref> =
  mongoose.models?.ImpersonationBackref ||
  mongoose.model<IDBImpersonationBackref>(
    "ImpersonationBackref",
    impersonationBackrefSchema,
  );

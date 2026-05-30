"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDBImpersonationNonce extends Document {
  jti: string;
  adminId: string;
  userId: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const impersonationNonceSchema = new Schema<IDBImpersonationNonce>(
  {
    jti: { type: String, required: true, unique: true },
    adminId: { type: String, required: true },
    userId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  {
    collection: "impersonation_nonce",
    timestamps: true,
  },
);

impersonationNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ImpersonationNonce: Model<IDBImpersonationNonce> =
  mongoose.models?.ImpersonationNonce ||
  mongoose.model<IDBImpersonationNonce>(
    "ImpersonationNonce",
    impersonationNonceSchema,
  );

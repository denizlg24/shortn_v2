"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDBAccount extends Document {
  userId: string;
  accountId: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  password?: string;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IDBAccount>(
  {
    userId: { type: String, required: true, ref: "User" },
    accountId: { type: String, required: true },
    providerId: { type: String, required: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    password: { type: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    collection: "account",
    timestamps: true,
  },
);

export const Account: Model<IDBAccount> =
  mongoose.models?.Account ||
  mongoose.model<IDBAccount>("Account", accountSchema);

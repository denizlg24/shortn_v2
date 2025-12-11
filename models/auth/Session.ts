"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDBSession extends Document {
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<IDBSession>(
  {
    userId: { type: String, required: true, ref: "User" },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    collection: "session",
    timestamps: true,
  },
);

export const Session: Model<IDBSession> =
  mongoose.models?.Session ||
  mongoose.model<IDBSession>("Session", sessionSchema);

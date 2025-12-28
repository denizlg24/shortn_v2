"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDBSession extends Document {
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  geo?: {
    city?: string;
    country?: string;
    countryRegion?: string;
    region?: string;
    latitude?: string;
    longitude?: string;
  };
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
    geo: {
      type: {
        city: { type: String },
        country: { type: String },
        countryRegion: { type: String },
        region: { type: String },
        latitude: { type: String },
        longitude: { type: String },
      },
      required: false,
    },
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

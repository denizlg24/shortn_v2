"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDBSession extends Document {
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  geo_city?: string;
  geo_country?: string;
  geo_country_region?: string;
  geo_region?: string;
  geo_latitude?: string;
  geo_longitude?: string;
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
    geo_city: { type: String },
    geo_country: { type: String },
    geo_country_region: { type: String },
    geo_region: { type: String },
    geo_latitude: { type: String },
    geo_longitude: { type: String },
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

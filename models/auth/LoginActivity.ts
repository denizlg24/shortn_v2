"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

interface ILoginRecord extends Document {
  sub: string;
  ip: string;
  location: string;
  type: string;
  succeeded: boolean;
  at: Date;
}

export interface TLoginRecord {
  sub: string;
  ip: string;
  location: string;
  succeeded: boolean;
  type: string;
  at: Date;
}

const LoginRecordSchema = new Schema<ILoginRecord>({
  sub: { type: String },
  ip: { type: String },
  location: { type: String },
  succeeded: { type: Boolean },
  type: { type: String },
  at: { type: Date, default: Date.now },
});

export const LoginRecord: Model<ILoginRecord> =
  mongoose.models.LoginRecord ||
  mongoose.model<ILoginRecord>("LoginRecord", LoginRecordSchema);

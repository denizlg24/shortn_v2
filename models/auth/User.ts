"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IDBUser extends Document {
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
  sub: string;
  links_this_month: number;
  qr_codes_this_month: number;
  redirects_this_month: number;
  qr_code_redirects_this_month: number;
  stripeCustomerId?: string | null;
}

const userSchema = new Schema<IDBUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, required: true },
    image: { type: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },

    sub: { type: String, unique: true, index: true },
    links_this_month: { type: Number, default: 0 },
    qr_codes_this_month: { type: Number, default: 0 },
    redirects_this_month: { type: Number, default: 0 },
    qr_code_redirects_this_month: { type: Number, default: 0 },
    stripeCustomerId: { type: String, default: null },
  },
  {
    collection: "user",
    timestamps: true,
  },
);

export const User: Model<IDBUser> =
  mongoose.models?.User || mongoose.model<IDBUser>("User", userSchema);

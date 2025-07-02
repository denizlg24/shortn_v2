"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IResetToken extends Document {
    sub: string;
    token: string;
}

const tokenSchema = new Schema<IResetToken>({
    sub: { type: String, required: true },
    token: { type: String, required: true },
});

export const ResetToken: Model<IResetToken> =
    mongoose.models?.ResetToken || mongoose.model<IResetToken>("ResetToken", tokenSchema);
"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IVerificationToken extends Document {
    _userId: Schema.Types.ObjectId;
    token: string;
    expireAt: Date;
}

const tokenSchema = new Schema<IVerificationToken>({
    _userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    token: { type: String, required: true },
    expireAt: { type: Date, default: Date.now, index: { expires: 86400000 } }
});

export const VerificationToken: Model<IVerificationToken> =
    mongoose.models?.VerificationTokens || mongoose.model<IVerificationToken>("VerificationTokens", tokenSchema);
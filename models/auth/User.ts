"use server";

import mongoose, { Document, Schema, Model } from "mongoose";

export interface IPlan {
    subscription: string;
    lastPaid: Date;
}

export interface IUser extends Document {
    sub: string;
    displayName: string;
    stripeId: string;
    username: string;
    email: string;
    password: string;
    profilePicture?: string;
    emailVerified: boolean;
    createdAt: Date;
    plan: IPlan;
    links_this_month: number;
}

const userSchema = new Schema<IUser>({
    sub: {
        type: String,
        required: true,
        unique: [true, "A user with that sub already exists"],
    },
    displayName: {
        type: String,
    },
    stripeId: {
        type: String,
    },
    username: {
        type: String,
    },
    email: {
        type: String,

    },
    password: {
        type: String,

    },
    profilePicture: {
        type: String,

    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    plan: {
        type: Object,
        default: {
            subscription: "free",
            lastPaid: new Date(),
        },
    },
    links_this_month: {
        type: Number,
        default: 0,
    },
});

export const User: Model<IUser> =
    mongoose.models?.User || mongoose.model<IUser>("User", userSchema);
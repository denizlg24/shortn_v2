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
        default: "",
        unique: [true, "A user with that sub already exists"],
    },
    displayName: {
        type: String,
        required: true,
        default: "",
    },
    stripeId: {
        type: String,
        required: true,
        default: "",
    },
    username: {
        type: String,
        required: [true, "username not provided"],
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        required: [true, "email not provided"],
        validate: {
            validator: function (v: string) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: (props: any) => `${props.value} is not a valid email!`,
        },
    },
    password: {
        type: String,
        required: true,
    },
    profilePicture: {
        type: String,
        default: "",
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
    mongoose.models.User || mongoose.model<IUser>("User", userSchema);
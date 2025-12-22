import mongoose, { Schema, Document } from "mongoose";

export interface IRateLimit extends Document {
  identifier: string;
  attempts: number;
  lastAttempt: Date;
  blockedUntil?: Date;
  createdAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>({
  identifier: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  attempts: {
    type: Number,
    required: true,
    default: 0,
  },
  lastAttempt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  blockedUntil: {
    type: Date,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // Automatically delete documents after 24 hours
  },
});

const RateLimit =
  mongoose.models.RateLimit ||
  mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

export default RateLimit;

import mongoose, { Schema, Document, Model } from "mongoose";
import { tagSchema } from "./Tag";

export interface IUrl extends Document {
  sub?: string;
  urlCode: string;
  customCode: boolean;
  longUrl: string;
  qrCodeId?: string;
  isQrCode: boolean;
  title?: string;
  date: Date;
  tags?: { id: string; tagName: string; sub: string; _id: unknown }[];
  clicks: {
    total: number;
    lastClick: Date | null;
  };
  utmLinks?: {
    _id?: unknown;
    source?: string;
    medium?: string;
    campaign?: {
      _id: unknown;
      title: string;
    };
    term?: string;
    content?: string;
  }[];
  passwordProtected: boolean;
  passwordHash?: string;
  passwordHint?: string;
  riskScore: number;
  safetyStatus: SafetyStatus;
  flagged: boolean;
  disabled: boolean;
  disabledReason?: string;
  reportCount: number;
  lastScannedAt: Date | null;
  scanProvider?: string;
  requiresInterstitial: boolean;
  recordClick: () => Promise<IUrl>;
}

export type SafetyStatus =
  | "pending"
  | "safe"
  | "suspicious"
  | "malicious"
  | "blocked";

export interface TUrl {
  _id: string;
  sub?: string;
  urlCode: string;
  customCode: boolean;
  longUrl: string;
  qrCodeId?: string;
  isQrCode: boolean;
  title?: string;
  date: Date;
  tags?: { id: string; tagName: string; sub: string; _id: unknown }[];
  clicks: {
    total: number;
    lastClick: Date | null;
  };
  utmLinks?: {
    _id?: unknown;
    source?: string;
    medium?: string;
    campaign?: {
      _id: unknown;
      title: string;
    };
    term?: string;
    content?: string;
  }[];
  passwordProtected: boolean;
  passwordHash?: string;
  passwordHint?: string;
  riskScore: number;
  safetyStatus: SafetyStatus;
  flagged: boolean;
  disabled: boolean;
  disabledReason?: string;
  reportCount: number;
  lastScannedAt: Date | null;
  scanProvider?: string;
  requiresInterstitial: boolean;
}

const UrlSchema = new Schema<IUrl>({
  sub: { type: String, index: true },
  urlCode: { type: String, required: true },
  customCode: { type: Boolean, default: false },
  longUrl: { type: String, required: true },
  qrCodeId: String,
  isQrCode: { type: Boolean, default: false },
  title: String,
  date: { type: Date, default: Date.now },
  tags: { type: [tagSchema], default: [], index: true },
  utmLinks: {
    type: [
      {
        source: { type: String },
        medium: { type: String },
        campaign: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "Campaigns" },
          title: { type: String },
        },
        term: { type: String },
        content: { type: String },
      },
    ],
    default: [],
  },
  clicks: {
    total: { type: Number, default: 0 },
    lastClick: { type: Date, default: null },
  },
  passwordProtected: { type: Boolean, default: false, index: true },
  passwordHash: { type: String },
  passwordHint: { type: String, maxlength: 100 },
  riskScore: { type: Number, default: 0, index: true },
  safetyStatus: {
    type: String,
    enum: ["pending", "safe", "suspicious", "malicious", "blocked"],
    default: "pending",
    index: true,
  },
  flagged: { type: Boolean, default: false, index: true },
  disabled: { type: Boolean, default: false, index: true },
  disabledReason: { type: String },
  reportCount: { type: Number, default: 0, index: true },
  lastScannedAt: { type: Date, default: null },
  scanProvider: { type: String },
  requiresInterstitial: { type: Boolean, default: false },
});

UrlSchema.methods.recordClick = async function () {
  this.clicks.total++;
  this.clicks.lastClick = new Date();
  return this.save();
};

UrlSchema.index({
  urlCode: "text",
  longUrl: "text",
  title: "text",
  tags: "text",
});

const UrlV3: Model<IUrl> =
  mongoose.models.UrlV3 || mongoose.model<IUrl>("UrlV3", UrlSchema);

export default UrlV3;

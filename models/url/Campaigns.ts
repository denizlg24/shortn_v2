import mongoose, { Schema, Document, Model } from "mongoose";
import UrlV3, { IUrl } from "./UrlV3";
import { ok } from "assert";

ok(UrlV3);

export interface IUtmDefaults {
  sources: string[];
  mediums: string[];
  terms: string[];
  contents: string[];
}

export interface ICampaign extends Document {
  title: string;
  sub: string;
  createdAt: Date;
  links: mongoose.Types.ObjectId[] | IUrl[];
  description?: string;
  utmDefaults?: IUtmDefaults;
}

const UtmDefaultsSchema = new Schema<IUtmDefaults>(
  {
    sources: { type: [String], default: [] },
    mediums: { type: [String], default: [] },
    terms: { type: [String], default: [] },
    contents: { type: [String], default: [] },
  },
  { _id: false },
);

const CampaignSchema = new Schema<ICampaign>(
  {
    title: { type: String, required: true },
    sub: { type: String, required: true },
    links: [{ type: Schema.Types.ObjectId, ref: "UrlV3" }],
    description: { type: String },
    utmDefaults: { type: UtmDefaultsSchema },
  },
  { timestamps: true },
);

CampaignSchema.index({ title: "text" });

export const Campaigns: Model<ICampaign> =
  mongoose.models.Campaigns ||
  mongoose.model<ICampaign>("Campaigns", CampaignSchema);

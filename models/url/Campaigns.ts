import mongoose, { Schema, Document, Model } from "mongoose";
import { IUrl } from "./UrlV3";

export interface ICampaign extends Document {
  title: string;
  sub: string;
  createdAt: Date;
  links: mongoose.Types.ObjectId[] | IUrl[];
}

const CampaignSchema = new Schema<ICampaign>(
  {
    title: { type: String, required: true },
    sub: { type: String, required: true },
    links: [{ type: Schema.Types.ObjectId, ref: "UrlV3" }],
  },
  { timestamps: true },
);

export const Campaigns: Model<ICampaign> =
  mongoose.models.Campaigns ||
  mongoose.model<ICampaign>("Campaigns", CampaignSchema);
